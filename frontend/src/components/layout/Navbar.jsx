// frontend/src/components/layout/Navbar.jsx

import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../../api";
import "../../styles/Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        await api.post("/logout/", { refresh: refreshToken });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      logout();
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
          LOG OUT
        </button>
      </div>
    </div>
  );
}

export default Navbar;
