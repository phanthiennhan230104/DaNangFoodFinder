import React from "react";
import "../../../styles/LandingPage/About.css";

export default function About() {
  return (
    <section id="about" className="about">
      <div className="container">
        <h2 className="section-title">About DNFF</h2>
        <div className="about-content">
          <div className="about-text">
            <h3>🤖 Artificial Intelligence</h3>
            <p>
              DNFF uses advanced AI technology to understand natural language 
              and provide personalized suggestions based on your preferences.
            </p>
            <p>
              With the ability to learn from user behavior, the system 
              continuously improves its understanding of each individual’s 
              taste and dining needs.
            </p>
            <a href="#" className="btn btn-primary">Contact Us</a>
          </div>
          <div className="about-image">
            <h4>🎯 C1.90SE Team</h4>
            <p>
              A team of students from Duy Tan University committed to delivering 
              the best culinary experience.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
