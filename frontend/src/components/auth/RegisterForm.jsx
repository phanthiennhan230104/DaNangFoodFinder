import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Key, Lock, CheckIcon } from "lucide-react";
import api from "../../api.js";
import "../../styles/auth/Register.css";

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
    const { email, password, confirmPassword } = formData;

    if (password !== confirmPassword) {
      setMessage("Passwords do not match!");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await api.post("auth/register/", { email, password });
      setMessage("OTP sent! Check your email.");
      setStep(2);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.email?.[0] ||
          err.response?.data?.detail ||
          "Error registering"
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
        <div className="input-group success-message">
          <CheckIcon className="check-icon" />
          <p>Registration verified successfully!</p>
        </div>
      );
      setStep(3);
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        {/* Left Side */}
        <div className="register-left">
          {step === 1 && (
            <>
              <h1 className="register-title">Registration</h1>
              <form onSubmit={handleRegisterSubmit} className="register-form">
                {/* Email */}
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

                {/* Password */}
                <div className="input-group" style={{ position: "relative" }}>
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
                    className="toggle-eye"
                    onClick={() => setShowPassword(!showPassword)}
                  />
                </div>

                {/* Confirm Password */}
                <div className="input-group" style={{ position: "relative" }}>
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
                    className="toggle-eye"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                  />
                </div>

                {message && <p className="message">{message}</p>}
                <button
                  type="submit"
                  className="btn-register"
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Register"}
                </button>
              </form>
            </>
          )}

          {/* STEP 2: OTP */}
          {step === 2 && (
            <>
              <h1 className="register-title">Verify OTP</h1>
              <p>Enter the OTP sent to {formData.email}</p>
              <form onSubmit={handleOtpSubmit} className="register-form">
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
                <button
                  type="submit"
                  className="btn-register"
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
              </form>
            </>
          )}

          {/* STEP 3: Success */}
          {step === 3 && (
            <div className="register-success">
              {message}
              {/* Nút "Go to Login" đã bị xoá */}
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="register-right">
          <div className="welcome-text">
            <h2>Welcome Back!</h2>
            <p>Already have an account?</p>
          </div>
          <button className="btn-login" onClick={() => navigate("/login")}>
            Login
          </button>
        </div>
      </div>
    </div>
  );
}
