import { useState } from "react";
import api from "../../api.js";
import { useNavigate } from "react-router-dom";
import "../../styles/Form.css";
import LoadingIndicator from "../LoadingIndicator.jsx";

function RegisterForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
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

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      setLoading(false);
      return;
    }

    try {
      await api.post("/register/", {
        email: formData.email,
        password: formData.password,
      });

      alert("Đăng ký thành công! Hãy đăng nhập.");
      navigate("/login/");
    } catch (error) {
      if (error.response && error.response.data) {
        const errors = error.response.data;
        if (errors.email) {
          alert("Email: " + errors.email[0]);
        } else if (errors.password) {
          alert("Password: " + errors.password[0]);
        } else if (errors.detail) {
          alert(errors.detail);
        } else {
          alert("Có lỗi xảy ra!");
        }
      } else {
        alert("Không thể kết nối server!");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h1>REGISTER</h1>
      <h2>Create your account</h2>

      {/* Email */}
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

      {/* Password */}
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

      {/* Confirm Password */}
      <div className="input-wrapper">
        <input
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Confirm Password"
          required
        />
        <span className="icon">
          <i className="fas fa-lock"></i>
        </span>
      </div>

      {loading && <LoadingIndicator />}

      {/* Submit */}
      <button className="form-button" type="submit" disabled={loading}>
        {loading ? "Processing..." : "REGISTER"}
      </button>
    </form>
  );
}

export default RegisterForm;
