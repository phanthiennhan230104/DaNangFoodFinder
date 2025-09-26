import { useState } from "react";
import api from "../../api.js";
import { useNavigate, Link } from "react-router-dom";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../../constants.js";
import "../../styles/Form.css";
import LoadingIndicator from "../LoadingIndicator.jsx";

function LoginForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post("token/", {
        email: formData.email,
        password: formData.password,
      });

      localStorage.setItem(ACCESS_TOKEN, res.data.access);
      localStorage.setItem(REFRESH_TOKEN, res.data.refresh);
      navigate("/");
    } catch (error) {
      alert(error.response?.data?.detail || "Error!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h1>LOGIN</h1>
      <h2>Get access to more...</h2>

      <div className="input-wrapper">
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          required
        />
        <span className="icon">
          <i className="fas fa-envelope"></i>
        </span>
      </div>

      <div className="input-wrapper">
        <input
          type={showPassword ? "text" : "password"}
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Password"
          required
        />
        <span
          className="icon"
          onClick={() => setShowPassword(!showPassword)}
          style={{ cursor: "pointer" }}
        >
          <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
        </span>
      </div>

      {loading && <LoadingIndicator />}

      <button className="form-button" type="submit" disabled={loading}>
        {loading ? "Processing..." : "LOGIN"}
      </button>

      <div className="form-links">
        <p>
          <a href="#">Forgot your password?</a>
        </p>
        <p>
          Don’t have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </form>
  );
}

export default LoginForm;
