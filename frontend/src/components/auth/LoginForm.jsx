import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api, { loginWithFacebook } from "../../api.js";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../../constants.js";
import "../../styles/auth/Login&ForgotPasswordForm.css";
import LoadingIndicator from "../LoadingIndicator.jsx";

function LoginForm() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Nếu đã login thì redirect
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

  // ================== EMAIL / PASSWORD ==================
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

      if (roleId === 1 || roleId === "1") {
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

  // ================== GOOGLE ==================
  const handleGoogleCallback = (response) => {
    (async () => {
      setLoading(true);
      try {
        const id_token = response.credential;
        if (!id_token) throw new Error("Unable to retrieve the id_token from Google.");

        const res = await api.post("auth/login/google/", { id_token });
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

        if (roleId === 1 || roleId === "1") navigate("/admin/home");
        else navigate("/home");
      } catch (err) {
        console.error("Google login error:", err.response?.data || err);
        alert(
          "Google login failed: " +
            (err.response?.data?.detail || err.message)
        );
      } finally {
        setLoading(false);
      }
    })();
  };

  // khởi tạo Google Identity Services + RENDER NÚT
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    console.log("FE VITE_GOOGLE_CLIENT_ID:", clientId);

    if (!clientId) {
      console.error("VITE_GOOGLE_CLIENT_ID is not set in .env");
      return;
    }

    if (!window.google?.accounts?.id) {
      console.error("Google SDK has not been loaded yet.");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCallback,
      use_fedcm_for_prompt: false,
    });

    // 👉 ĐỂ GOOGLE TỰ VẼ NÚT VÀO DIV
    const btnDiv = document.getElementById("googleSignInDiv");
    if (btnDiv) {
      window.google.accounts.id.renderButton(btnDiv, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        shape: "pill",
        text: "continue_with",
        locale: "en",
      });
    }
  }, []);

  // ================== FACEBOOK ================== (GIỮ NGUYÊN)
  const handleFacebookLogin = () => {
    if (!window.FB) return;

    setLoading(true);

    window.FB.login(
      function (response) {
        (async () => {
          if (response.authResponse) {
            const fbAccessToken = response.authResponse.accessToken;
            try {
              const data = await loginWithFacebook(fbAccessToken);
              localStorage.setItem(ACCESS_TOKEN, data.access);
              localStorage.setItem(REFRESH_TOKEN, data.refresh);

              const userRes = await api.get("auth/me/");
              const roleId = userRes.data.role_id;
              localStorage.setItem("ROLE_ID", roleId);

              login({
                email: userRes.data.email,
                user_id: userRes.data.user_id,
                role_id: userRes.data.role_id,
                role_name: userRes.data.role_name,
              });

              if (roleId === 1 || roleId === "1") navigate("/admin/home");
              else navigate("/home");
            } catch (err) {
              console.error(
                "Facebook login error:",
                err.response?.data || err
              );
              alert(
                "Facebook login failed: " +
                  (err.response?.data?.detail || err.message)
              );
            } finally {
              setLoading(false);
            }
          } else {
            setLoading(false);
          }
        })();
      },
      { scope: "public_profile" }
    );
  };

  // ================== UI ==================
  const handleRegister = () => navigate("/register");
  const handleForgotPassword = () => navigate("/forgot-password");

  return (
    <div className="login">
      <div className="login-container">
        <div className="left-side">
          <div className="welcome-text">
            <h1>Welcome back!</h1>
            <p>Don't have an account?</p>
          </div>
          <button className="btn btn-secondary-custom" onClick={handleRegister}>
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

            {/* Password */}
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
                  showPassword ? "/images/eye.png" : "/images/eye-crossed.png"
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

            <button
              type="submit"
              className="btn btn-primary login-btn"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            {/* Divider “hoặc” */}
            <div className="divider">
              <span>or</span>
            </div>

            {/* GOOGLE: SDK tự render vào div này */}
            <div
              id="googleSignInDiv"
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                marginBottom: "8px",
              }}
            ></div>

            {/* FACEBOOK: nút custom, giữ nguyên logic + CSS */}
            <button
              type="button"
              className="google-clone-facebook"
              onClick={handleFacebookLogin}
              disabled={loading}
            >
              <img
                src="/images/f_logo_RGB-Blue_1024.png"
                alt="facebook"
                className="fb-icon-left"
              />
              <span className="fb-text">Sign in with Facebook</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
