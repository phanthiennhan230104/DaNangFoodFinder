import React from "react";
import "../../../styles/LandingPage/HeroMain.css";

export default function HeroMain() {
  return (
    <section id="home" className="hero">
      <div className="hero-content">
        <h1>Discover Da Nang Cuisine </h1>
        <p>
          An intelligent food discovery system that helps you explore the best local dishes 
          through personalized recommendations and natural language search.
        </p>
        <div className="hero-buttons">
          <a href="/login" className="btn btn-primary">Start Exploring</a>
          <a href="#features" className="btn btn-secondary">See More</a>
        </div>
      </div>
    </section>
  );
}
