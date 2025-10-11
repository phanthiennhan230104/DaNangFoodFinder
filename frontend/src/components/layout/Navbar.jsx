import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import api from "../../api";
import "../../styles/Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { logout } = useAuth(); // ✅ THÊM

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        await api.post("/logout/", { refresh: refreshToken });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      logout(); // ✅ SỬA: dùng context logout
      navigate("/login");
    }
  };

  return (
    <div className="navbar-container">
      <div
        className="navbar-left"
        onClick={() => navigate("/")}
        style={{ cursor: "pointer" }}
      >
        <img
          src="/images/logo_dnff.png"
          alt="DNFF Logo"
          className="navbar-logo"
        />
      </div>

      <div className="navbar-center">
        <h1 className="navbar-title">Da Nang Food Finder</h1>
      </div>

      <div className="navbar-right">
        <button className="navbar-button logout" onClick={handleLogout}>
          {t("logout")}
        </button>
        <select
          className="navbar-select"
          onChange={(e) => changeLanguage(e.target.value)}
        >
          <option value="vn">VN</option>
          <option value="en">EN</option>
        </select>
      </div>
    </div>
  );
}

export default Navbar;