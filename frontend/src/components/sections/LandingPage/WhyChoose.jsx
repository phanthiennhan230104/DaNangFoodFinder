import React from "react";
import "../../../styles/LandingPage/WhyChoose.css";

export default function WhyChoose() {
  const benefits = [
    { icon: "⚡", title: "Fast & Responsive", desc: "Get search and recommendation results in under 3 seconds." },
    { icon: "🎯", title: "Accurate Data", desc: "Clean, standardized, and frequently updated food and restaurant data." },
    { icon: "🧠", title: "AI-Powered Intelligence", desc: "Continuously learns from user behavior to improve personalized results." },
    { icon: "📱", title: "24/7 Availability", desc: "Accessible anytime, anywhere for both locals and tourists." },
  ];

  return (
    <section id="why-choose" className="why-choose">
      <div className="container">
        <h2 className="section-title">Why Choose DNFF?</h2>
        <div className="benefits-grid">
          {benefits.map((b, i) => (
            <div key={i} className="benefit-item">
              <div className="benefit-icon">{b.icon}</div>
              <h5>{b.title}</h5>
              <p>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
