import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthHeroPane } from "./AuthPage";
import { api } from "../lib/api";
import "./auth.css";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address || loading) return;

    setLoading(true);
    try {
      const response = await api.post("/auth/forgot-password", { email: address });
      setSubmitted(true);
      toast.success("Reset code sent!", {
        description: "Check your inbox for the 6-digit password reset code.",
      });

      if (response.data?.devOtp) {
        setDevOtp(response.data.devOtp);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to request a reset link.");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToReset = () => {
    navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <div className="auth-root">
      <div className="auth-split-grid">
        <AuthHeroPane />

        <div className="auth-form-pane">
          <div className="auth-form-container">
            <div className={`auth-otp-icon-wrap ${submitted ? "success" : ""}`}>
              {submitted ? <CheckCircle2 size={32} /> : <KeyRound size={32} />}
            </div>

            {!submitted ? (
              <>
                <div className="auth-header-text" style={{ textAlign: "center" }}>
                  <h2>Forgot Password?</h2>
                  <p>
                    Enter your registered email address and we'll send you a 6-digit OTP code to reset your password.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                  <div className="auth-input-group">
                    <label htmlFor="forgot-email">Email Address</label>
                    <div className="auth-input-wrapper">
                      <span className="auth-input-icon">
                        <Mail size={18} />
                      </span>
                      <input
                        id="forgot-email"
                        type="email"
                        className="auth-input"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button type="submit" className="auth-submit-btn" disabled={loading || !email.trim()}>
                    {loading ? (
                      <span>Sending reset code...</span>
                    ) : (
                      <>
                        <span>Send 6-Digit Code</span>
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div className="auth-header-text">
                  <h2>Code Sent!</h2>
                  <p>
                    We've dispatched a 6-digit verification code to <b>{email}</b>.
                  </p>
                </div>

                {devOtp && (
                  <div className="auth-dev-badge" style={{ marginBottom: "20px" }}>
                    <strong>🔧 Local Development Note:</strong>
                    Reset Code: <b>{devOtp}</b>
                  </div>
                )}

                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={handleProceedToReset}
                  style={{ marginBottom: "16px" }}
                >
                  Enter 6-Digit Code <ArrowRight size={18} />
                </button>

                <p style={{ fontSize: "13px", color: "#64748b", margin: "16px 0 0" }}>
                  Didn't receive the email? Check your spam folder or{" "}
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#2563eb",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    try another email
                  </button>
                  .
                </p>
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: "24px" }}>
              <Link to="/login" className="auth-back-link">
                <ArrowLeft size={16} /> Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
