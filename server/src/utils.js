import jwt from "jsonwebtoken";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import prisma from "./config/db.js";

const developmentSecret = "dev-secret-change-me";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production")
    throw new Error("JWT_SECRET must be configured in production.");
  return secret || developmentSecret;
}

function signToken(user, { rememberMe = false } = {}) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role || "USER" },
    jwtSecret(),
    {
      expiresIn: rememberMe
        ? process.env.JWT_REMEMBER_EXPIRES_IN || "30d"
        : process.env.JWT_SESSION_EXPIRES_IN || "1d",
    },
  );
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret());
}

function hashToken(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function refreshTtlMs(rememberMe) {
  const raw = rememberMe
    ? process.env.JWT_REFRESH_REMEMBER_EXPIRES_IN || "30d"
    : process.env.JWT_REFRESH_EXPIRES_IN || "7d";
  const match = String(raw).match(/^(\d+)([smhd])$/);
  if (!match) return (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  return { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[match[2]] * n;
}

async function createRefreshToken(userId, { rememberMe = false, familyId } = {}) {
  const raw = randomBytes(48).toString("hex");
  const family = familyId || randomUUID();
  const expiresAt = new Date(Date.now() + refreshTtlMs(rememberMe));
  await prisma.refreshToken.create({
    data: {
      token_hash: hashToken(raw),
      family_id: family,
      user_id: userId,
      expires_at: expiresAt,
    },
  });
  return { raw, familyId: family };
}

async function rotateRefreshToken(rawToken, { rememberMe } = {}) {
  const hash = hashToken(rawToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { token_hash: hash },
    include: {
      user: {
        include: {
          skills: { include: { skill: { include: { category: true } } } },
          reviews_received: { select: { rating: true } },
        },
      },
    },
  });

  if (!stored) {
    const err = new Error("Refresh token not recognised.");
    err.code = "INVALID_REFRESH";
    throw err;
  }

  const isOriginalRememberMe =
    stored.expires_at.getTime() - stored.created_at.getTime() > 10 * 864e5;
  const effectiveRememberMe =
    rememberMe !== undefined ? !!rememberMe : isOriginalRememberMe;

  if (stored.revoked) {
    const recentlyRotated = await prisma.refreshToken.findFirst({
      where: {
        family_id: stored.family_id,
        revoked: false,
        created_at: { gte: new Date(Date.now() - 30_000) },
      },
      orderBy: { created_at: "desc" },
    });

    if (recentlyRotated && recentlyRotated.expires_at > new Date()) {
      return {
        user: stored.user,
        raw: null,
        familyId: stored.family_id,
        isRememberMe: effectiveRememberMe,
      };
    }

    await prisma.refreshToken.updateMany({
      where: { family_id: stored.family_id },
      data: { revoked: true },
    });
    const err = new Error(
      "Refresh token reuse detected. All sessions from this login have been revoked.",
    );
    err.code = "REFRESH_REUSE";
    throw err;
  }

  if (stored.expires_at < new Date()) {
    const err = new Error("Refresh token has expired. Please sign in again.");
    err.code = "REFRESH_EXPIRED";
    throw err;
  }

  if (!stored.user || !stored.user.is_active || !stored.user.is_verified) {
    const err = new Error("User account is inactive or unverified.");
    err.code = "INACTIVE_USER";
    throw err;
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  });

  const { raw, familyId } = await createRefreshToken(stored.user_id, {
    rememberMe: effectiveRememberMe,
    familyId: stored.family_id,
  });

  return {
    user: stored.user,
    raw,
    familyId,
    isRememberMe: effectiveRememberMe,
  };
}

async function revokeAllRefreshTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked: false },
    data: { revoked: true },
  });
}

async function purgeExpiredRefreshTokens(olderThanMs = 30 * 864e5) {
  const cutoff = new Date(Date.now() - olderThanMs);
  await prisma.refreshToken.deleteMany({
    where: { expires_at: { lt: cutoff } },
  });
}

function publicUser(user) {
  if (!user) return null;
  const received = Array.isArray(user.reviews_received)
    ? user.reviews_received
    : [];
  const total = received.reduce(
    (sum, review) => sum + Number(review.rating || 0),
    0,
  );
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    avatar_url: user.avatar_url || null,
    location: user.location,
    bio: user.bio,
    proficiency_level:
      user.proficiency_level ||
      user.skills?.find((s) => s.skill_type === "TEACH")?.proficiency_level ||
      user.skills?.[0]?.proficiency_level ||
      "Intermediate",
    role: user.role || "USER",
    is_verified: user.is_verified,
    is_active: user.is_active,
    created_at: user.created_at,
    skills: user.skills || [],
    average_rating: received.length
      ? Number((total / received.length).toFixed(2))
      : 0,
    review_count: received.length,
  };
}

async function createNotification(
  prisma,
  io,
  { userId, type, title, message, referenceType = null, referenceId = null },
) {
  const notification = await prisma.notification.create({
    data: {
      user_id: userId,
      type,
      title,
      message,
      reference_type: referenceType,
      reference_id: referenceId,
    },
  });
  if (io) io.to(`user:${userId}`).emit("notification", notification);
  return notification;
}

function normalizeError(error) {
  if (error?.code === "P2002")
    return { status: 409, message: "Email or value already exists." };
  if (error?.code === "P2025")
    return { status: 404, message: "Requested record was not found." };
  if (error?.code === "P2021")
    return {
      status: 503,
      message:
        "SkillSwap database tables are not initialized. Run `npm run prisma:push` and `npm run seed` in the server folder.",
    };
  if (error && ["P1001", "P1003", "P1017"].includes(error.code))
    return {
      status: 503,
      message:
        "SkillSwap could not connect to PostgreSQL. Check server/.env DATABASE_URL and make sure PostgreSQL is running.",
    };
  return {
    status: error?.status || 500,
    message: error?.message || "Internal server error.",
  };
}

export {
  signToken,
  verifyToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  purgeExpiredRefreshTokens,
  publicUser,
  createNotification,
  normalizeError,
};
