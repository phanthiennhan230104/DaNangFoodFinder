import React from "react";
import "../../../styles/LandingPage/Features.css";

export default function Features() {
  const features = [
    {
      icon: "🔍",
      title: "Smart Food Search",
      desc: "Search for dishes or restaurants using keywords or natural language questions, with smart filters for budget, distance, and ratings."
    },
    {
      icon: "🎯",
      title: "Personalized Recommendations",
      desc: "AI suggests dishes and restaurants based on your preferences, history, location, and reason-based explanations."
    },
    {
      icon: "🗓️",
      title: "Food Journey Planner",
      desc: "Create a daily dining plan (breakfast–lunch–dinner) that fits your budget and taste preferences."
    },
    {
      icon: "💖",
      title: "Favorites & History",
      desc: "Save favorite restaurants or dishes, view search history, and send feedback to improve the system."
    },
    {
      icon: "🌐",
      title: "Google Maps Integration",
      desc: "Display maps, calculate distances, and get optimized directions for your food journey."
    },
    {
      icon: "🛡️",
      title: "Role-Based Access & Security",
      desc: "Clear role management between users and admins with authentication, authorization, and data protection."
    }
  ];

  return (
    <section id="features" className="features">
      <div className="container">
        <h2 className="features-title">Key Features</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
