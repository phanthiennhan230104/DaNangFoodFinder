import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../../api.js";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../../constants.js";
import "../../styles/Login&ForgotPasswordForm.css";
import LoadingIndicator from "../LoadingIndicator.jsx";

function LoginForm() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // 👁️ thêm state con mắt
  const navigate = useNavigate();
  const { login } = useAuth();

  // ✅ Nếu đã đăng nhập thì tự động chuyển sang /home hoặc /admin/home
  useEffect(() => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN);
    const roleId = localStorage.getItem("ROLE_ID");
    if (accessToken) {
      if (roleId === "1") navigate("/admin/home");
      else navigate("/home");
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post("auth/login/", {
        email: formData.email,
        password: formData.password,
      });

      localStorage.setItem(ACCESS_TOKEN, res.data.access);
      localStorage.setItem(REFRESH_TOKEN, res.data.refresh);

      const userRes = await api.get("auth/me/");
      const roleId = userRes.data.role_id;

      localStorage.setItem("ROLE_ID", roleId);

      login({
        email: userRes.data.email,
        user_id: userRes.data.user_id,
        role_id: userRes.data.role_id,
        role_name: userRes.data.role_name,
      });

      if (roleId === 1) {
        navigate("/admin/home");
      } else {
        navigate("/home");
      }
    } catch (error) {
      console.error("Login error:", error.response?.data);
      const errorMsg =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        "Login failed!";
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => navigate("/register");
  const handleForgotPassword = () => navigate("/forgot-password");

  return (
    <div className="login">
      <div className="login-container">
        <div className="left-side">
          <div className="welcome-text">
            <h1>Hello, Welcome!</h1>
            <p>Don't have an account?</p>
          </div>
          <button className="btn-register1" onClick={handleRegister}>
            Register
          </button>
        </div>

        <div className="right-side">
          <h2>Login</h2>
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="input-group">
              <img className="icon" src="/images/envelope.svg" alt="email" />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* Password có con mắt 👁️ */}
            <div className="input-group password-group">
              <img className="icon" src="/images/lock.svg" alt="password" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <img
                className="icon-eye"
                src={
                  showPassword
                    ? "/images/eye.png"
                    : "/images/eye-crossed.png"
                }
                alt="toggle password visibility"
                onClick={() => setShowPassword(!showPassword)}
                style={{ cursor: "pointer" }}
              />
            </div>

            <div className="forgot-password" onClick={handleForgotPassword}>
              Forgot password?
            </div>

            {loading && <LoadingIndicator />}
            <button type="submit" className="btn-login1" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
