import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../styles/layout/Header.css";
import { ACCESS_TOKEN } from "../../constants";
import api from "../../api";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const isLoggedIn = !!localStorage.getItem(ACCESS_TOKEN);
  const roleId = localStorage.getItem("ROLE_ID");
  const username = localStorage.getItem("USERNAME") || "User";
  const [fullName, setFullName] = useState("");

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        await api.post("/logout/", { refresh });
      }
    } catch (e) {
      console.warn("Logout failed", e);
    } finally {
      localStorage.clear();
      navigate("/login");
    }
  };

  // 🟡 Lấy fullname từ API profiles
  useEffect(() => {
    if (isLoggedIn) {
      api
        .get("/profiles/me/") // 👉 endpoint bạn dùng để lấy thông tin người dùng hiện tại
        .then((res) => {
          if (res.status === 200 && res.data?.fullname) {
            setFullName(res.data.fullname);
          }
        })
        .catch(() => {
          // fallback: không có fullname
          setFullName("");
        });
    }
  }, [isLoggedIn]);

  // 🌐 Landing Page Header (chưa login)
  if (!isLoggedIn && location.pathname === "/") {
    return (
      <header className="header">
        <nav className="nav">
          <a href="#home" className="logo">DNFF</a>
          <ul className="nav-links">
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#why-choose">Why Choose Us</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
          <div className="auth-buttons">
            <a href="/login" className="btn btn-secondary">Login</a>
            <a href="/register" className="btn btn-primary">Sign Up</a>
          </div>
        </nav>
      </header>
    );
  }

  // 🧭 ADMIN Header
  if (isLoggedIn && roleId === "1") {
    return (
      <header className="header admin-header">
        <nav className="nav">
          <a className="logo" onClick={() => navigate("/admin/home")} style={{ cursor: "pointer" }}>
            DNFF
          </a>

          <ul className="nav-links">
            <li><a href="/admin/accounts">Accounts</a></li>
            <li><a href="/admin/roles">Roles</a></li>
            <li><a href="/admin/crawl">Crawl Data</a></li>
          </ul>
          <div className="auth-buttons">
            <span className="welcome-text">
              {fullName ? `Welcome, ${fullName}` : "Welcome, Admin"}
            </span>
            <button className="btn btn-secondary" onClick={handleLogout}>Log out</button>
          </div>
        </nav>
      </header>
    );
  }

  // 👤 USER Header
  if (isLoggedIn && roleId !== "1") {
    return (
      <header className="header user-header">
        <nav className="nav">
          <a className="logo" onClick={() => navigate("/home")} style={{ cursor: "pointer" }}>
            DNFF
          </a>
          <ul className="nav-links">
            <li><a href="/home">Home</a></li>
            <li><a href="/journey">My Journey</a></li>
            <li><a href="/favorites">Favorites</a></li>
            <li><a href="/feedback">Feedback</a></li>
          </ul>
          <div className="auth-buttons">
            <span className="welcome-text">
              {fullName ? `Hi, ${fullName}` : `Hi, ${username}`}
            </span>
            <button className="btn btn-secondary" onClick={handleLogout}>Log out</button>
          </div>
        </nav>
      </header>
    );
  }

  return null;
}
