import { useEffect, useRef, useState, type FormEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { api, storeTokens } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { AuthHeroPane } from "./AuthPage";
import "./auth.css";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const queryEmail = params.get("email") || "";
  const queryOtp = params.get("otp") || params.get("token") || "";

  const [email, setEmail] = useState(queryEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(!queryEmail);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [isSuccess, setIsSuccess] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (queryOtp && queryOtp.length === 6) {
      const chars = queryOtp.split("").slice(0, 6);
      setOtpDigits(chars);
      verifyCode(queryOtp, email);
    }
  }, [queryOtp]);

  const verifyCode = async (codeToVerify: string, targetEmail: string) => {
    if (codeToVerify.length !== 6 || loading) return;
    setLoading(true);

    try {
      const response = await api.post("/auth/verify-email", {
        otp: codeToVerify,
        email: targetEmail.trim() || undefined,
      });

      if (response.data.token) {
        storeTokens(response.data.token, response.data.refresh_token, true);
        await refreshUser();
      }

      setIsSuccess(true);
      toast.success("Account Verified & Activated!", {
        description: response.data.message || "Your account is now fully active.",
      });

      setTimeout(() => {
        navigate(response.data.token ? "/dashboard" : "/login", { replace: true });
      }, 1500);
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        "The verification code is invalid or has expired.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    const digit = val.slice(-1).replace(/[^0-9]/g, "");
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = updated.join("");
    if (fullCode.length === 6 && !updated.includes("")) {
      verifyCode(fullCode, email);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim().replace(/[^0-9]/g, "");
    if (!pasteData) return;

    const chars = pasteData.slice(0, 6).split("");
    const updated = ["", "", "", "", "", ""];
    chars.forEach((c, i) => {
      if (i < 6) updated[i] = c;
    });

    setOtpDigits(updated);
    const lastFilled = Math.min(chars.length - 1, 5);
    inputRefs.current[lastFilled]?.focus();

    if (chars.length === 6) {
      verifyCode(chars.join(""), email);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    if (!email.trim()) {
      toast.error("Please enter your email address first.");
      setIsEditingEmail(true);
      return;
    }

    setResending(true);
    try {
      const response = await api.post("/auth/resend-verification", {
        email: email.trim(),
      });

      toast.success("New verification code sent!", {
        description: "Please check your inbox or spam folder.",
      });

      if (response.data.devOtp) {
        setDevOtp(response.data.devOtp);
      }

      setCooldown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to resend code.");
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const fullCode = otpDigits.join("");
    if (fullCode.length < 6) {
      toast.error("Please enter all 6 digits.");
      return;
    }
    verifyCode(fullCode, email);
  };

  return (
    <div className="auth-root">
      <div className="auth-split-grid">
        <AuthHeroPane />

        <div className="auth-form-pane">
          <div className="auth-otp-card">
            <div className={`auth-otp-icon-wrap ${isSuccess ? "success" : ""}`}>
              {isSuccess ? <CheckCircle2 size={34} /> : <ShieldCheck size={34} />}
            </div>

            {isSuccess ? (
              <div>
                <h2>Email Verified!</h2>
                <p className="auth-header-text" style={{ margin: "10px 0 24px", color: "#64748b" }}>
                  Your SkillSwap account is verified and ready. Redirecting you to sign in...
                </p>
                <Link to="/login" className="auth-submit-btn">
                  Continue to Sign In <ArrowRight size={18} />
                </Link>
              </div>
            ) : (
              <div>
                <div className="auth-header-text">
                  <h2>Verify your email</h2>
                  <p>We've sent a 6-digit confirmation code to your email address.</p>
                </div>

                {isEditingEmail ? (
                  <div style={{ margin: "14px 0 20px" }}>
                    <div className="auth-input-wrapper">
                      <span className="auth-input-icon">
                        <Mail size={16} />
                      </span>
                      <input
                        type="email"
                        className="auth-input"
                        placeholder="Enter your registered email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="auth-email-badge">
                    <Mail size={14} />
                    <span>{email || "your email address"}</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingEmail(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#2563eb",
                        fontSize: "12px",
                        fontWeight: 700,
                        marginLeft: "6px",
                        cursor: "pointer",
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}

                {devOtp && (
                  <div className="auth-dev-badge">
                    <strong>🔧 Local Development Note:</strong>
                    Code: <b>{devOtp}</b>{" "}
                    <button
                      type="button"
                      onClick={() => {
                        const chars = devOtp.split("").slice(0, 6);
                        setOtpDigits(chars);
                        verifyCode(devOtp, email);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#2563eb",
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      (Auto-fill &amp; Verify)
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="auth-otp-inputs">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className={`auth-otp-box ${digit ? "filled" : ""}`}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        onPaste={handlePaste}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loading || otpDigits.join("").length < 6}
                  >
                    {loading ? (
                      <span>Verifying code...</span>
                    ) : (
                      <>
                        <span>Verify &amp; Activate</span>
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>

                <div className="auth-resend-area">
                  <span>Didn't receive the code?</span>
                  <button
                    type="button"
                    className="auth-resend-btn"
                    onClick={handleResend}
                    disabled={cooldown > 0 || resending}
                  >
                    {resending ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" /> Sending...
                      </>
                    ) : cooldown > 0 ? (
                      `Resend in ${cooldown}s`
                    ) : (
                      "Resend Code"
                    )}
                  </button>
                </div>

                <Link to="/login" className="auth-back-link">
                  <ArrowLeft size={16} /> Back to Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
