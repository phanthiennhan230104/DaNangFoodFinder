import { useState, useEffect } from "react";
import "../../../styles/user/HomePage.css";

function HeroSection({ onExplore }) {
  const [currentImage, setCurrentImage] = useState(0);

  const images = ["/images/bg1.jpg", "/images/bg2.jpg", "/images/bg3.jpg", "/images/bg4.jpg"];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hero-slideshow-container">
      {images.map((img, index) => (
        <div
          key={index}
          className={`hero-slide ${index === currentImage ? "active" : ""}`}
          style={{ backgroundImage: `url(${img})` }}
        />
      ))}

      <div className="hero-overlay" aria-hidden="true" />

      <div className="hero-content">
        <h1 className="hero-title">
          DISCOVER CUISINE
          <br></br> 
          <span>DA NANG</span> 
        </h1>
        <p className="hero-subtitle">Find your favorite dishes and restaurants smartly.</p>
        <button className="hero-button" onClick={onExplore}>
          Explore Now
        </button>
      </div>
    </div>
  );
}

export default HeroSection;
