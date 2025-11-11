import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, LogOut, Send, ChevronDown } from "lucide-react";
import "../../styles/layout/Header.css";
import { ACCESS_TOKEN } from "../../constants";
import api from "../../api";
import { LanguageSwitcher } from "../AutoTranslateProvider";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const toggleMenu = () => setOpen(!open);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  useEffect(() => {
    if (isLoggedIn) {
      api
        .get("/profiles/me/")
        .then((res) => {
          if (res.status === 200 && res.data?.fullName) {
            setFullName(res.data.fullName);
          }
        })
        .catch(() => {
          setFullName("");
        });
    }
  }, [isLoggedIn]);

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

  if (isLoggedIn && roleId !== "1") {
    return (
      <header className="header user-header">
        <nav className="nav">
          <a className="logo" onClick={() => navigate("/home")} style={{ cursor: "pointer" }}>
            DNFF
          </a>

          <ul className="nav-links">
            <li><a href="/home">Home</a></li>
            <li><a href="/journey">Food Journey</a></li>
            <li><a href="/favorites">Favorite</a></li>
            <li><a href="/nearby">Nearby Restaurant</a></li>
          </ul>

          <div className="auth-buttons" ref={menuRef}>
            <button className="btn btn-secondary dropdown-toggle" onClick={toggleMenu}>
              <span>Hi, {fullName || username}</span>
              <ChevronDown className={`chevron-icon ${open ? "rotate" : ""}`} size={18} />
            </button>
             <LanguageSwitcher />

            <div className={`dropdown-card ${open ? "open" : ""}`}>
              <a href="/profiles" className="dropdown-item">
                <User className="icon" /> Profiles
              </a>

              <a href="/feedback" className="dropdown-item">
                <Send className="icon" /> Send Feedback
              </a>

              <div className="divider"></div>

              <button className="dropdown-item logout-btn" onClick={handleLogout}>
                <LogOut className="icon" /> Log out
              </button>
            </div>
          </div>
        </nav>
      </header>
    );
  }

  return null;
}
