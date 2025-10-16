import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api.js";
import "../../styles/auth/Login&ForgotPasswordForm.css";
import { CheckIcon } from "lucide-react";

export default function ForgotPasswordForm() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const handleApiError = (err) => {
    console.error(err);
    if (err.response?.data) {
      if (typeof err.response.data === "object") {
        const errors = Object.entries(err.response.data)
          .map(
            ([key, value]) =>
              `${key}: ${
                Array.isArray(value) ? value.join(", ") : value
              }`
          )
          .join("\n");
        setMessage(errors);
      } else {
        setMessage(err.response.data.toString());
      }
    } else {
      setMessage("Something went wrong. Please try again.");
    }
  };

  // STEP 1: gửi email OTP
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setMessage("Please enter a valid email");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await api.post("auth/forgot-password/", { email });
      setMessage("OTP sent! Check your email.");
      setStep(2);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: verify OTP và nhận reset_token
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp) {
      setMessage("Enter OTP");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await api.post("auth/verify-reset-otp/", { email, otp });
      setResetToken(res.data.reset_token);
      setMessage("OTP verified. Enter new password.");
      setStep(3);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: reset password
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await api.post("auth/reset-password/", {
        reset_token: resetToken,
        password1: password,
        password2: confirmPassword,
      });
      setMessage(
        <div className="success-message">
          <CheckIcon className="check-icon" />
          <span>Password reset successfully!</span>
        </div>
      );
      setStep(4);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-container">
        {/* Left Side */}
        <div className="left-side">
          <div className="welcome-text">
            <h1>Hello, Welcome!</h1>
            <p>Let's help you reset your password</p>
          </div>
          <button className="btn-register1" onClick={() => navigate("/login")}>
            Login
          </button>
        </div>

        {/* Right Side */}
        <div className="right-side">
          {step === 1 && (
            <>
              <h2>Forgot Password</h2>
              <form onSubmit={handleEmailSubmit}>
                <div className="input-group">
                  <img className="icon" src="/images/envelope.svg" alt="email" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {message && <p className="message">{message}</p>}
                <button type="submit" className="btn-login1" disabled={loading}>
                  {loading ? "Sending..." : "Get OTP"}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Enter OTP</h2>
              <form onSubmit={handleOtpSubmit}>
                <div className="input-group">
                  <img className="icon" src="/images/lock.svg" alt="otp" />
                  <input
                    type="text"
                    placeholder="OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {message && <p className="message">{message}</p>}
                <button type="submit" className="btn-login1" disabled={loading}>
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <h2>Set New Password</h2>
              <form onSubmit={handlePasswordSubmit}>
                {/* New Password */}
                <div className="input-group">
                  <img className="icon" src="/images/lock.svg" alt="password" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <img
                    src={showPassword ? "/images/eye.png" : "/images/eye-crossed.png"}
                    alt="toggle password visibility"
                    className="toggle-eye"
                    onClick={() => setShowPassword(!showPassword)}
                  />
                </div>

                {/* Confirm Password */}
                <div className="input-group">
                  <img className="icon" src="/images/lock.svg" alt="confirm password" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <img
                    src={showConfirmPassword ? "/images/eye.png" : "/images/eye-crossed.png"}
                    alt="toggle confirm password visibility"
                    className="toggle-eye"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                </div>

                {message && <p className="message">{message}</p>}
                <button type="submit" className="btn-login1" disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            </>
          )}

          {step === 4 && (
            <div className="success-container">
              <p>{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
