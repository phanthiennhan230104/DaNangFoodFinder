import React from "react";
import "../../styles/LandingPage/Footer.css";

export default function Footer() {
  return (
    <footer className="footer" id="contact">
      <div className="container footer-content">
        <div className="footer-section">
          <h4>DNFF</h4>
          <p>
            An AI-powered intelligent food discovery system for Da Nang, helping users explore the city’s authentic cuisine effortlessly.
          </p>
        </div>

        <div className="footer-section">
          <h4>Quick Links</h4>
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#why-choose">Why Choose Us</a>
          <a href="#contact">Contact</a>
        </div>

        <div className="footer-section">
          <h4>Contact</h4>
          <p>Email: phanthiennhan230104@gmail.com</p>
          <p>Phone: +84 944 068 045</p>
          <p>Address: Duy Tan University, Da Nang, Vietnam</p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; 2025 DNFF. All rights reserved.</p>
      </div>
    </footer>
  );
}
