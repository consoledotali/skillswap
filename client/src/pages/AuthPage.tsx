import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowRight,
  Code2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Palette,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import "./auth.css";

export function AuthHeroPane() {
  return (
    <div className="auth-hero-pane">
      <div className="auth-hero-glow-1" />
      <div className="auth-hero-glow-2" />
      <div className="auth-hero-grid-pattern" />

      <div className="auth-hero-brand">
        <div className="auth-hero-logo-box">
          <ArrowLeftRight size={22} />
        </div>
        <span>SkillSwap</span>
      </div>

      <div className="auth-hero-middle">
        <div className="auth-hero-pill">
          <Sparkles size={14} /> Pakistan's Peer-to-Peer Skill Network
        </div>
        <h1 className="auth-hero-title">
          Skills grow <span>when shared.</span>
        </h1>
        <p className="auth-hero-desc">
          Connect with developers, designers, and creators across Pakistan. Teach what you know, learn what you need — completely free.
        </p>

        <div className="auth-hero-exchange-card">
          <div className="auth-hero-peer-row">
            <div className="auth-hero-peer">
              <div className="auth-hero-peer-icon code">
                <Code2 size={20} />
              </div>
              <div className="auth-hero-peer-info">
                <b>Ali Hamza</b>
                <small>Teaching React &amp; TypeScript</small>
              </div>
            </div>
            <div className="auth-hero-swap-badge">
              <ArrowLeftRight size={12} /> SWAPPING
            </div>
          </div>

          <div className="auth-hero-exchange-divider">
            <span className="auth-hero-exchange-line" />
            <span className="auth-hero-swap-circle">
              <ArrowLeftRight size={13} />
            </span>
            <span className="auth-hero-exchange-line" />
          </div>

          <div className="auth-hero-peer-row">
            <div className="auth-hero-peer">
              <div className="auth-hero-peer-icon design">
                <Palette size={20} />
              </div>
              <div className="auth-hero-peer-info">
                <b>Sarah Khan</b>
                <small>Teaching UI/UX &amp; Figma</small>
              </div>
            </div>
            <div className="auth-hero-swap-badge verified">
              <ShieldCheck size={12} /> VERIFIED
            </div>
          </div>
        </div>
      </div>

      <div className="auth-hero-footer">
        <div className="auth-hero-stat">
          <b>5,000+</b>
          <span>Skill Swappers</span>
        </div>
        <div className="auth-hero-stat-sep" />
        <div className="auth-hero-stat">
          <b>100%</b>
          <span>Free Exchange</span>
        </div>
        <div className="auth-hero-stat-sep" />
        <div className="auth-hero-stat">
          <b>4.9 ★</b>
          <span>Community Rating</span>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="auth-social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z"
      />
      <path
        fill="#34A853"
        d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.03H3.26v2.53A9.74 9.74 0 0 0 12 21.5Z"
      />
      <path
        fill="#FBBC05"
        d="M6.51 13.58A5.85 5.85 0 0 1 6.2 12c0-.55.11-1.09.31-1.58V7.89H3.26A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.01 4.11l3.25-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.39c1.43 0 2.71.49 3.73 1.46l2.8-2.8C16.84 3.46 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.74 5.39l3.25 2.53C7.29 8.11 9.45 6.39 12 6.39Z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg className="auth-social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.18c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.69 1.26 3.35.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.73 0-1.27.45-2.3 1.19-3.11-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.19A10.95 10.95 0 0 1 12 6.01c.98 0 1.97.13 2.89.38 2.2-1.5 3.17-1.19 3.17-1.19.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.11 0 4.45-2.71 5.43-5.29 5.72.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function SocialButton({
  provider,
  icon,
  children,
}: {
  provider: "google" | "github";
  icon: ReactNode;
  children: ReactNode;
}) {
  const begin = () => {
    window.location.assign(
      `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/auth/oauth/${provider}`
    );
  };
  return (
    <button type="button" className="auth-social-btn" onClick={begin}>
      {icon} {children}
    </button>
  );
}

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password) || /[A-Z]/.test(password)) strength++;

  const label = strength === 1 ? "Weak" : strength === 2 ? "Good" : "Strong";
  const stateClass = strength === 1 ? "weak" : strength === 2 ? "medium" : "strong";

  return (
    <div className="auth-strength-meter">
      <div className="auth-strength-bars">
        <div className={`auth-strength-bar ${strength >= 1 ? stateClass : ""}`} />
        <div className={`auth-strength-bar ${strength >= 2 ? stateClass : ""}`} />
        <div className={`auth-strength-bar ${strength >= 3 ? stateClass : ""}`} />
      </div>
      <div className="auth-strength-text">
        <span>Password strength</span>
        <span style={{ color: strength === 1 ? "#ef4444" : strength === 2 ? "#f59e0b" : "#10b981" }}>
          {label}
        </span>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, completeOAuth } = useAuth();
  const oauthProcessingRef = useRef<string | null>(null);

  const isRegisterRoute = location.pathname === "/register";
  const [isRegister, setIsRegister] = useState(isRegisterRoute);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = localStorage.getItem("skillswap_remember_me");
    return saved === null ? true : saved === "1";
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setIsRegister(location.pathname === "/register");
  }, [location.pathname]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthCode = params.get("oauth_code");
    const oauthError = params.get("oauth_error");

    if (!oauthCode && !oauthError) return;
    window.history.replaceState({}, document.title, location.pathname);

    if (oauthError) {
      toast.error("Social sign in failed", {
        description: oauthError.replaceAll("+", " "),
      });
      return;
    }

    if (!oauthCode || oauthProcessingRef.current === oauthCode) return;
    oauthProcessingRef.current = oauthCode;

    void completeOAuth(oauthCode)
      .then(() => {
        toast.success("Signed in successfully", {
          description: "Welcome to SkillSwap!",
        });
        navigate("/dashboard", { replace: true });
      })
      .catch((error: any) => {
        oauthProcessingRef.current = null;
        toast.error(error.response?.data?.message || "Unable to complete social sign in.");
      });
  }, [completeOAuth, location.pathname, location.search, navigate]);

  const handleTabSwitch = (toRegister: boolean) => {
    setIsRegister(toRegister);
    navigate(toRegister ? "/register" : "/login", { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    try {
      if (isRegister) {
        if (!fullName.trim()) {
          toast.error("Please enter your full name.");
          setBusy(false);
          return;
        }
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters long.");
          setBusy(false);
          return;
        }

        await register(fullName.trim(), email.trim(), password);
        toast.success("Account created successfully!", {
          description: "Please enter the 6-digit OTP code sent to your email.",
        });
        navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
      } else {
        await login(email.trim(), password, rememberMe);
        toast.success("Welcome back!", {
          description: "You have signed in to SkillSwap.",
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || "Authentication failed.";
      const code = error.response?.data?.code;
      const requiresOtp = error.response?.data?.requires_otp;

      if (code === "EMAIL_NOT_VERIFIED" || requiresOtp) {
        toast.error("OTP verification required", {
          description: "Redirecting you to enter your 6-digit verification code...",
        });
        navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-split-grid">
        <AuthHeroPane />

        <div className="auth-form-pane">
          <div className="auth-form-container">
            <div className="auth-tab-switcher">
              <button
                type="button"
                className={`auth-tab-btn ${!isRegister ? "active" : ""}`}
                onClick={() => handleTabSwitch(false)}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${isRegister ? "active" : ""}`}
                onClick={() => handleTabSwitch(true)}
              >
                Create Account
              </button>
            </div>

            <div className="auth-header-text">
              <h2>{isRegister ? "Start swapping skills today" : "Welcome back to SkillSwap"}</h2>
              <p>
                {isRegister
                  ? "Join Pakistan's largest free peer-to-peer learning network."
                  : "Sign in with your email or social account to continue."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {isRegister && (
                <div className="auth-input-group">
                  <label htmlFor="reg-name">Full Name</label>
                  <div className="auth-input-wrapper">
                    <span className="auth-input-icon">
                      <User size={18} />
                    </span>
                    <input
                      id="reg-name"
                      type="text"
                      className="auth-input"
                      placeholder="e.g. Ali Ahmed"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="auth-input-group">
                <label htmlFor="auth-email">Email Address</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <Mail size={18} />
                  </span>
                  <input
                    id="auth-email"
                    type="email"
                    className="auth-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label htmlFor="auth-password">
                  <span>Password</span>
                  {!isRegister && (
                    <Link to="/forgot-password" className="auth-link">
                      Forgot password?
                    </Link>
                  )}
                </label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <Lock size={18} />
                  </span>
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    className="auth-input"
                    placeholder={isRegister ? "At least 8 characters" : "Enter your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-input-trailing"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {isRegister && <PasswordStrengthMeter password={password} />}
              </div>

              {!isRegister && (
                <div className="auth-actions-row">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      className="auth-checkbox"
                      checked={rememberMe}
                      onChange={(e) => {
                        setRememberMe(e.target.checked);
                        localStorage.setItem("skillswap_remember_me", e.target.checked ? "1" : "0");
                      }}
                    />
                    <span>Remember me on this device</span>
                  </label>
                </div>
              )}

              <button type="submit" className="auth-submit-btn" disabled={busy}>
                {busy ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <span>{isRegister ? "Create Account" : "Sign In"}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-divider">Or continue with</div>

            <div className="auth-social-grid">
              <SocialButton provider="google" icon={<GoogleIcon />}>
                Google
              </SocialButton>
              <SocialButton provider="github" icon={<GithubIcon />}>
                GitHub
              </SocialButton>
            </div>

            <div className="auth-bottom-switch">
              {isRegister ? (
                <span>
                  Already have an account?{" "}
                  <button type="button" onClick={() => handleTabSwitch(false)}>
                    Sign In
                  </button>
                </span>
              ) : (
                <span>
                  Don't have an account yet?{" "}
                  <button type="button" onClick={() => handleTabSwitch(true)}>
                    Create Account
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
