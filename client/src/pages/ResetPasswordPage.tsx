import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api";
import { AuthHeroPane } from "./AuthPage";
import "./auth.css";

function PasswordStrengthBar({ password }: { password: string }) {
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

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const queryEmail = params.get("email") || "";
  const queryOtp = params.get("otp") || params.get("token") || "";

  const [email, setEmail] = useState(queryEmail);
  const [otpDigits, setOtpDigits] = useState<string[]>(() => {
    if (queryOtp && queryOtp.length === 6) {
      return queryOtp.split("").slice(0, 6);
    }
    return ["", "", "", "", "", ""];
  });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (queryOtp && queryOtp.length === 6) {
      setOtpDigits(queryOtp.split("").slice(0, 6));
    }
  }, [queryOtp]);

  const handleDigitChange = (index: number, val: string) => {
    const digit = val.slice(-1).replace(/[^0-9]/g, "");
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
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
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const fullOtp = otpDigits.join("");

    if (fullOtp.length < 6) {
      return toast.error("Please enter the 6-digit reset code.");
    }
    if (password.length < 8) {
      return toast.error("New password must be at least 8 characters.");
    }
    if (password !== confirm) {
      return toast.error("Passwords do not match.");
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: email.trim() || undefined,
        otp: fullOtp,
        password,
      });

      setIsSuccess(true);
      toast.success("Password reset successfully!", {
        description: "You can now sign in with your new password.",
      });

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "This reset code is invalid or has expired."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-split-grid">
        <AuthHeroPane />

        <div className="auth-form-pane">
          <div className="auth-form-container">
            <div className={`auth-otp-icon-wrap ${isSuccess ? "success" : ""}`}>
              {isSuccess ? <CheckCircle2 size={34} /> : <Lock size={34} />}
            </div>

            {isSuccess ? (
              <div style={{ textAlign: "center" }}>
                <h2>Password Reset!</h2>
                <p className="auth-header-text" style={{ margin: "10px 0 24px", color: "#64748b" }}>
                  Your password has been securely updated. Redirecting you to sign in...
                </p>
                <Link to="/login" className="auth-submit-btn">
                  Continue to Sign In <ArrowRight size={18} />
                </Link>
              </div>
            ) : (
              <>
                <div className="auth-header-text" style={{ textAlign: "center" }}>
                  <h2>Create New Password</h2>
                  <p>Enter the 6-digit code sent to your email and pick a strong password.</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                  <div className="auth-input-group">
                    <label htmlFor="reset-email">Email Address</label>
                    <div className="auth-input-wrapper">
                      <span className="auth-input-icon">
                        <Mail size={18} />
                      </span>
                      <input
                        id="reset-email"
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
                    <label style={{ textAlign: "center", display: "block" }}>
                      6-Digit Reset Code
                    </label>
                    <div className="auth-otp-inputs" style={{ margin: "8px 0" }}>
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
                        />
                      ))}
                    </div>
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="new-password">New Password</label>
                    <div className="auth-input-wrapper">
                      <span className="auth-input-icon">
                        <Lock size={18} />
                      </span>
                      <input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        className="auth-input"
                        placeholder="Minimum 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
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
                    <PasswordStrengthBar password={password} />
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="confirm-password">Confirm New Password</label>
                    <div className="auth-input-wrapper">
                      <span className="auth-input-icon">
                        <ShieldCheck size={18} />
                      </span>
                      <input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        className="auth-input"
                        placeholder="Re-enter your new password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>
                    {confirm && password !== confirm && (
                      <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: 600 }}>
                        Passwords do not match.
                      </span>
                    )}
                  </div>

                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? (
                      <span>Updating password...</span>
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>

                <div style={{ textAlign: "center", marginTop: "24px" }}>
                  <Link to="/login" className="auth-back-link">
                    <ArrowLeft size={16} /> Back to Sign In
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
