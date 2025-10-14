import React from "react";
import "../../../styles/LandingPage/Header.css";

export default function Header() {
  return (
    <header className="header">
      <nav className="nav">
        <div className="logo">🍜 DNFF</div>
        <ul className="nav-links">
          <li><a href="#home" data-scroll>Home</a></li>
          <li><a href="#about" data-scroll>About</a></li>
          <li><a href="#features" data-scroll>Features</a></li>
          <li><a href="#why-choose" data-scroll>Why Choose Us</a></li>
          <li><a href="#contact" data-scroll>Contact</a></li>
        </ul>
        <div className="auth-buttons">
          <a href="/login" className="btn btn-secondary">Login</a>
          <a href="/register" className="btn btn-primary">Sign Up</a>
        </div>
      </nav>
    </header>
  );
}
