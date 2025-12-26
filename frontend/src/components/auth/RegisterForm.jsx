import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Key, Lock, CheckIcon } from "lucide-react";
import api from "../../api.js";
import "../../styles/auth/Login&ForgotPasswordForm.css";
import LoadingIndicator from "../LoadingIndicator.jsx";


export default function RegisterForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    const email = formData.email.trim().toLowerCase();
    const { password, confirmPassword } = formData;

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match!");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // ✅ CHỈ REGISTER – KHÔNG VERIFY Ở ĐÂY
      await api.post("auth/register/", { email, password });

      // ✅ đồng bộ email đã chuẩn hoá
      setFormData(prev => ({ ...prev, email }));

      setMessage("OTP sent! Check your email.");
      setStep(2);
    } catch (err) {
      setMessage(
        err.response?.data?.detail ||
        err.response?.data?.email?.[0] ||
        "Register failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp) {
      setMessage("Enter OTP");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await api.post("auth/verify-otp/", { email: formData.email, otp });
      setMessage(
        <div className="success-message">
          <CheckIcon className="check-icon" />
          <span>Registration verified successfully!</span>
        </div>
      );
      setStep(3);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* === THAY ĐỔI 3: Dùng class CSS chung === */
    <div className="login">
      <div className="login-container">
        <div className="left-side">
          <div className="welcome-text">
            <h1>Join us today!</h1>
            <p>Already have an account?</p>
          </div>
          <button
            className="btn btn-secondary-custom"
            onClick={() => navigate("/login")}
          >
            Login
          </button>
        </div>
        <div className="right-side">
          {step === 1 && (
            <>
              <h2>Registration</h2>
              <form onSubmit={handleRegisterSubmit}>
                <div className="input-group">
                  <Mail className="icon" />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="input-group password-group">
                  <Lock className="icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <img
                    src={
                      showPassword
                        ? "/images/eye.png"
                        : "/images/eye-crossed.png"
                    }
                    alt="toggle password visibility"
                    className="icon-eye"
                    onClick={() => setShowPassword(!showPassword)}
                  />
                </div>

                <div className="input-group password-group">
                  <Lock className="icon" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                  <img
                    src={
                      showConfirmPassword
                        ? "/images/eye.png"
                        : "/images/eye-crossed.png"
                    }
                    alt="toggle confirm password visibility"
                    className="icon-eye"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                  />
                </div>

                {message && <p className="message">{message}</p>}
                {loading && <LoadingIndicator />}
                <button
                  type="submit"
                  className="btn btn-primary login-btn"
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Register"}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Verify OTP</h2>
              <p style={{ textAlign: "center", marginBottom: "1rem" }}>
                Enter the OTP sent to {formData.email}
              </p>
              <form onSubmit={handleOtpSubmit}>
                <div className="input-group">
                  <Key className="icon" />
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
                {loading && <LoadingIndicator />}
                <button
                  type="submit"
                  className="btn btn-primary login-btn"
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
              </form>
            </>
          )}

          {step === 3 && (
            <div className="success-container">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}