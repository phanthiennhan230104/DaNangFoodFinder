import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Login from './auth/Login';
import '../styles/LandingPage.css';
import { ACCESS_TOKEN } from '../constants';

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Nếu đã login thì redirect
    const accessToken = localStorage.getItem(ACCESS_TOKEN);
    const roleId = localStorage.getItem('ROLE_ID');
    if (accessToken) {
      if (roleId === '1') navigate('/admin/home');
      else navigate('/home');
    }
  }, [navigate]);

  return (
    <div className={`landing-container ${showLogin ? 'hide-banner' : ''}`}>
      {/* Banner chính */}
      <div className="banner-content">
        <div className="background-pattern" />
        
        <div className="content-wrapper">
          <img src="/images/dnff_logo.png" alt="DNFF Logo" className="dnff-logo" />
          <h1 className="main-title">
            Da Nang <span className="highlight">Food Finder</span>
          </h1>
          <p className="subtitle">
            Intelligent Food Discovery System - Find Your Perfect Meal Now
          </p>
          
          <button
            onClick={() => setShowLogin(true)}
            className="explore-btn"
          >
            <span className="btn-text">Explore Now</span>
            <div className="btn-hover-effect" />
          </button>
        </div>

        <div className="decorative-circle left" />
        <div className="decorative-circle right" />
      </div>

      {/* Hiệu ứng rèm trái */}
      <div className={`curtain curtain-left ${showLogin ? 'open' : ''}`}>
        <div className="curtain-overlay" />
      </div>

      {/* Hiệu ứng rèm phải */}
      <div className={`curtain curtain-right ${showLogin ? 'open' : ''}`}>
        <div className="curtain-overlay" />
      </div>

      {/* Login Component */}
      <div className={`login-wrapper ${showLogin ? 'show' : ''}`}>
        <Login onBack={() => setShowLogin(false)} />
      </div>
    </div>
  );
}