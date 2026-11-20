import bcrypt from "bcrypt";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import prisma from "../config/db.js";
import {
  signToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  publicUser,
} from "../utils.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../config/mailer.js";

const oauthCodes = new Map();
const oauthStates = new Map();

const USER_INCLUDE = {
  skills: { include: { skill: { include: { category: true } } } },
  reviews_received: { select: { rating: true } },
};

function clientUrl() {
  return process.env.CLIENT_URL || "http://localhost:5173";
}

function oauthCallbackUrl(provider) {
  return `${process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`}/api/auth/oauth/${provider}/callback`;
}

function cleanProvider(provider) {
  return String(provider || "")
    .trim()
    .toLowerCase();
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function issueOneTimeCode(accessToken, refreshTokenRaw, user) {
  const code = randomUUID();
  oauthCodes.set(code, {
    accessToken,
    refreshTokenRaw,
    user,
    expiresAt: Date.now() + 60_000,
  });
  return code;
}

function pruneOAuthCodes() {
  const now = Date.now();
  for (const [code, entry] of oauthCodes)
    if (entry.expiresAt <= now) oauthCodes.delete(code);
  for (const [state, entry] of oauthStates)
    if (entry.expiresAt <= now) oauthStates.delete(state);
}

function issueOAuthState(provider) {
  const state = randomBytes(24).toString("hex");
  oauthStates.set(state, { provider, expiresAt: Date.now() + 10 * 60_000 });
  return state;
}

function generateOtp() {
  return String(randomInt(100000, 1000000));
}

async function issueEmailToken(userId, kind) {
  const otp = generateOtp();
  const data =
    kind === "verify"
      ? {
          email_verification_token_hash: hashToken(otp),
          email_verification_expires_at: new Date(Date.now() + 15 * 60 * 1000),
        }
      : {
          password_reset_token_hash: hashToken(otp),
          password_reset_expires_at: new Date(Date.now() + 15 * 60 * 1000),
        };
  await prisma.user.update({ where: { id: userId }, data });
  return otp;
}

function refreshCookieOptions(rememberMe) {
  const maxAge = (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge,
  };
}

async function register(req, res, next) {
  try {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password || password.length < 8)
      return res.status(400).json({
        message:
          "Full name, valid email, and a password of at least 8 characters are required.",
      });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return res.status(409).json({
        message:
          "An account with this email address already exists. Please sign in instead.",
      });
    }
    const password_hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        full_name: String(full_name).trim(),
        email: normalizedEmail,
        password_hash,
        role: "USER",
        is_verified: false,
        is_active: false,
      },
    });
    const verificationOtp = await issueEmailToken(user.id, "verify");
    await sendVerificationEmail(user, verificationOtp);

    const io = req.app.get("io");
    if (io) {
      io.to("admin").emit("admin:user_created", { user: publicUser(user) });
    }

    res.status(201).json({
      token: signToken(user),
      user: publicUser(user),
      verification_required: true,
      email: user.email,
      ...(process.env.DEV_OTP_ENABLED === "true"
        ? { devOtp: verificationOtp }
        : {}),
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      include: USER_INCLUDE,
    });

    if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!user.is_verified) {
      let verificationOtp = null;
      if (
        !user.email_verification_expires_at ||
        user.email_verification_expires_at <= new Date()
      ) {
        verificationOtp = await issueEmailToken(user.id, "verify");
        await sendVerificationEmail(user, verificationOtp);
      }

      return res.status(403).json({
        message:
          "Please enter your 6-digit OTP code to verify and activate your account.",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
        requires_otp: true,
        ...(process.env.DEV_OTP_ENABLED === "true" && verificationOtp
          ? { devOtp: verificationOtp }
          : {}),
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        message:
          "Your account has been deactivated or suspended by an administrator.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    const rememberMe = req.body?.remember_me === true;

    const { raw: refreshTokenRaw } = await createRefreshToken(user.id, {
      rememberMe,
    });

    res.cookie(
      "skillswap_rt",
      refreshTokenRaw,
      refreshCookieOptions(rememberMe),
    );

    const io = req.app.get("io");
    if (io) {
      io.to("admin").emit("admin:user_login", {
        user: publicUser(user),
        loginAt: Date.now(),
      });
    }

    res.json({
      token: signToken(user, { rememberMe }),
      refresh_token: refreshTokenRaw,
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const rawToken =
      String(req.body?.refresh_token || "") ||
      String(req.cookies?.skillswap_rt || "");

    if (!rawToken)
      return res.status(401).json({ message: "No refresh token provided." });

    const rememberMeReq =
      req.body?.remember_me === true || req.body?.remember_me === "true";

    const {
      user,
      raw: newRaw,
      isRememberMe,
    } = await rotateRefreshToken(rawToken, {
      rememberMe:
        req.body?.remember_me !== undefined ? rememberMeReq : undefined,
    });

    const finalRememberMe = isRememberMe ?? rememberMeReq;

    if (newRaw) {
      res.cookie("skillswap_rt", newRaw, refreshCookieOptions(finalRememberMe));
    }

    res.json({
      token: signToken(user, { rememberMe: finalRememberMe }),
      refresh_token: newRaw || rawToken,
    });
  } catch (error) {
    if (error.code === "REFRESH_REUSE") {
      res.clearCookie("skillswap_rt", { path: "/api/auth" });
      return res.status(401).json({
        message: error.message,
        code: "REFRESH_REUSE",
      });
    }
    if (
      error.code === "INVALID_REFRESH" ||
      error.code === "REFRESH_EXPIRED" ||
      error.code === "INACTIVE_USER"
    ) {
      res.clearCookie("skillswap_rt", { path: "/api/auth" });
      return res.status(401).json({
        message:
          error.message || "Refresh session expired. Please sign in again.",
        code: error.code,
      });
    }
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const rawToken =
      String(req.body?.refresh_token || "") ||
      String(req.cookies?.skillswap_rt || "");

    if (rawToken) {
      const hash = createHash("sha256").update(rawToken).digest("hex");
      await prisma.refreshToken
        .updateMany({
          where: { token_hash: hash, revoked: false },
          data: { revoked: true },
        })
        .catch(() => {});
    }

    res.clearCookie("skillswap_rt", { path: "/api/auth" });
    res.json({ message: "Logged out successfully." });
  } catch (error) {
    next(error);
  }
}

async function logoutAll(req, res, next) {
  try {
    await revokeAllRefreshTokens(req.user.id);
    res.clearCookie("skillswap_rt", { path: "/api/auth" });
    res.json({ message: "Logged out from all devices." });
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: USER_INCLUDE,
    });
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

function oauthStart(req, res) {
  const provider = cleanProvider(req.params.provider);
  const callback = oauthCallbackUrl(provider);
  const state = issueOAuthState(provider);
  if (provider === "google") {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
      return res.status(503).json({
        message:
          "Google OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and SERVER_PUBLIC_URL to the server environment.",
      });
    const query = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: callback,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state,
    });
    return res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${query}`,
    );
  }
  if (provider === "github") {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET)
      return res.status(503).json({
        message:
          "GitHub OAuth is not configured. Add GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and SERVER_PUBLIC_URL to the server environment.",
      });
    const query = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: callback,
      scope: "read:user user:email",
      state,
    });
    return res.redirect(`https://github.com/login/oauth/authorize?${query}`);
  }
  return res.status(404).json({ message: "Unsupported OAuth provider." });
}

async function exchangeGoogleCode(code) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: oauthCallbackUrl("google"),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok)
    throw new Error("Google authorization code exchange failed.");
  const tokenData = await tokenResponse.json();
  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  );
  if (!profileResponse.ok) throw new Error("Google profile request failed.");
  const profile = await profileResponse.json();
  return {
    email: String(profile.email || "").toLowerCase(),
    full_name: profile.name || profile.email,
    avatar_url: profile.picture || null,
  };
}

async function exchangeGithubCode(code) {
  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "SkillSwap",
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        redirect_uri: oauthCallbackUrl("github"),
      }),
    },
  );
  if (!tokenResponse.ok)
    throw new Error("GitHub authorization code exchange failed.");
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token)
    throw new Error("GitHub did not return an access token.");
  const headers = {
    Authorization: `Bearer ${tokenData.access_token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "SkillSwap",
  };
  const profileResponse = await fetch("https://api.github.com/user", {
    headers,
  });
  if (!profileResponse.ok) throw new Error("GitHub profile request failed.");
  const profile = await profileResponse.json();
  let email = profile.email;
  if (!email) {
    const emailsResponse = await fetch("https://api.github.com/user/emails", {
      headers,
    });
    if (emailsResponse.ok) {
      const emails = await emailsResponse.json();
      email =
        emails.find((item) => item.primary && item.verified)?.email ||
        emails.find((item) => item.verified)?.email;
    }
  }
  return {
    email: String(email || "").toLowerCase(),
    full_name: profile.name || profile.login || email,
    avatar_url: profile.avatar_url || null,
  };
}

async function findOrCreateOAuthUser(profile) {
  if (!profile.email)
    throw new Error(
      "The OAuth provider did not return a verified email address.",
    );
  const existing = await prisma.user.findUnique({
    where: { email: profile.email },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        avatar_url: profile.avatar_url || existing.avatar_url,
        is_verified: true,
      },
      include: USER_INCLUDE,
    });
  }
  const password_hash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  return prisma.user.create({
    data: {
      full_name: String(profile.full_name || profile.email).trim(),
      email: profile.email,
      password_hash,
      avatar_url: profile.avatar_url,
      role: "USER",
      is_verified: true,
    },
    include: USER_INCLUDE,
  });
}

async function oauthCallback(req, res) {
  const provider = cleanProvider(req.params.provider);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const stateEntry = oauthStates.get(state);
    oauthStates.delete(state);
    if (
      !stateEntry ||
      stateEntry.expiresAt <= Date.now() ||
      stateEntry.provider !== provider
    )
      throw new Error("OAuth session validation failed. Please try again.");
    if (!code)
      throw new Error("OAuth provider did not return an authorization code.");
    const profile =
      provider === "google"
        ? await exchangeGoogleCode(code)
        : provider === "github"
          ? await exchangeGithubCode(code)
          : null;
    if (!profile)
      return res.redirect(
        `${clientUrl()}/login?oauth_error=unsupported-provider`,
      );
    const user = await findOrCreateOAuthUser(profile);
    pruneOAuthCodes();

    const { raw: refreshTokenRaw } = await createRefreshToken(user.id, {
      rememberMe: true,
    });

    const exchangeCode = issueOneTimeCode(
      signToken(user, { rememberMe: true }),
      refreshTokenRaw,
      user,
    );
    res.redirect(
      `${clientUrl()}/login?oauth_code=${encodeURIComponent(exchangeCode)}`,
    );
  } catch (error) {
    res.redirect(
      `${clientUrl()}/login?oauth_error=${encodeURIComponent(error.message || "oauth-failed")}`,
    );
  }
}

function oauthExchange(req, res) {
  pruneOAuthCodes();
  const code = String(req.body?.code || "");
  const entry = oauthCodes.get(code);
  if (!entry || entry.expiresAt <= Date.now())
    return res
      .status(401)
      .json({ message: "OAuth session expired. Please try again." });
  oauthCodes.delete(code);

  const rememberMe = true;
  res.cookie(
    "skillswap_rt",
    entry.refreshTokenRaw,
    refreshCookieOptions(rememberMe),
  );

  res.json({
    token: entry.accessToken,
    refresh_token: entry.refreshTokenRaw,
  });
}

async function verifyEmail(req, res, next) {
  try {
    const rawOtp = String(req.body?.otp || req.body?.token || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!rawOtp) {
      return res
        .status(400)
        .json({ message: "Verification code is required." });
    }

    const hashed = hashToken(rawOtp);
    const user = await prisma.user.findFirst({
      where: {
        ...(email ? { email } : {}),
        email_verification_token_hash: hashed,
        email_verification_expires_at: { gt: new Date() },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "This verification code is invalid or has expired." });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        is_verified: true,
        is_active: true,
        email_verification_token_hash: null,
        email_verification_expires_at: null,
      },
      include: USER_INCLUDE,
    });

    const serialized = publicUser(updated);

    const io = req.app.get("io");
    if (io) {
      io.to("admin").emit("admin:user_updated", { user: serialized });
      io.emit("user:status_changed", {
        userId: updated.id,
        user_id: updated.id,
        is_active: true,
        user: serialized,
      });
    }

    const rememberMe = true;
    const { raw: refreshTokenRaw } = await createRefreshToken(updated.id, {
      rememberMe,
    });
    res.cookie(
      "skillswap_rt",
      refreshTokenRaw,
      refreshCookieOptions(rememberMe),
    );

    res.json({
      token: signToken(updated, { rememberMe }),
      refresh_token: refreshTokenRaw,
      user: serialized,
      message:
        "Account verified and activated successfully! Welcome to SkillSwap.",
    });
  } catch (error) {
    next(error);
  }
}

async function resendVerification(req, res, next) {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    let devOtp;
    if (user && !user.is_verified) {
      const otp = await issueEmailToken(user.id, "verify");
      await sendVerificationEmail(user, otp);
      if (process.env.DEV_OTP_ENABLED === "true") devOtp = otp;
    }
    res.json({
      message:
        "If the account exists and needs verification, a fresh 6-digit code has been sent.",
      ...(devOtp ? { devOtp } : {}),
    });
  } catch (error) {
    next(error);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email address is required." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    let devOtp;
    if (user) {
      const otp = await issueEmailToken(user.id, "reset");
      await sendPasswordResetEmail(user, otp);
      if (process.env.DEV_OTP_ENABLED === "true") devOtp = otp;
    }
    res.json({
      message:
        "If an account exists for this email, a 6-digit reset code has been sent.",
      ...(devOtp ? { devOtp } : {}),
    });
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const otp = String(req.body?.otp || req.body?.token || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!otp) {
      return res
        .status(400)
        .json({ message: "6-digit reset code is required." });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters." });
    }

    const user = await prisma.user.findFirst({
      where: {
        ...(email ? { email } : {}),
        password_reset_token_hash: hashToken(otp),
        password_reset_expires_at: { gt: new Date() },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "This reset code is invalid or has expired." });
    }

    const password_hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        password_reset_token_hash: null,
        password_reset_expires_at: null,
      },
    });

    await revokeAllRefreshTokens(user.id);
    res.clearCookie("skillswap_rt", { path: "/api/auth" });
    res.json({
      message:
        "Password reset successfully. Please sign in with your new password.",
    });
  } catch (error) {
    next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const currentPassword = String(
      req.body?.currentPassword || req.body?.current_password || "",
    );
    const newPassword = String(
      req.body?.newPassword || req.body?.new_password || "",
    );

    if (!currentPassword) {
      return res
        .status(400)
        .json({ message: "Existing password is required." });
    }
    if (!newPassword || newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "New password must be at least 8 characters long." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from your existing password.",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Incorrect existing password. Please try again." });
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
      },
    });

    await revokeAllRefreshTokens(user.id);

    res.json({ ok: true, message: "Password updated successfully." });
  } catch (error) {
    next(error);
  }
}

export {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  me,
  oauthStart,
  oauthCallback,
  oauthExchange,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  changePassword,
};
