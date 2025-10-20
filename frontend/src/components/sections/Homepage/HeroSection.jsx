// frontend/src/components/sections/HeroSection.jsx

import { useState, useEffect } from "react";
import "../../../styles/user/HomePage.css";

function HeroSection({ onSearch }) {
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

  // Background images
  const images = [
    "/images/bg1.jpg",
    "/images/bg2.jpg",
    "/images/bg3.jpg",
    "/images/bg4.jpg",
  ];

  // Auto slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Voice recognition
  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("❌ The browser does not support Speech Recognition (Chrome is recommended).");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.start();
    setListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      if (onSearch) onSearch(transcript);
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() !== "") {
      onSearch(query.trim());
    }
  };

  return (
    <div className="hero-slideshow-container">
      {images.map((img, index) => (
        <div
          key={index}
          className={`hero-slide ${index === currentImage ? "active" : ""}`}
          style={{ backgroundImage: `url(${img})` }}
        />
      ))}

      <div className="hero-content">
        <h1>Discover Da Nang Cuisine</h1>
        <p>Find your favorite dishes and restaurants smartly.</p>

        <form onSubmit={handleSubmit} className="hero-search-form">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to eat today? (e.g., fish noodle soup near Dragon Bridge)"
            className="hero-search-input"
          />
          <button
            type="button"
            className={`hero-voice-button ${listening ? "listening" : ""}`}
            onClick={startListening}
          >
            {listening ? (
              <i className="fas fa-microphone-slash"></i>
            ) : (
              <i className="fas fa-microphone"></i>
            )}
          </button>
          <button type="submit" className="hero-search-button">
            <i className="fas fa-search"></i> Search
          </button>
        </form>
      </div>

      <div className="hero-overlay"></div>
    </div>
  );
}

export default HeroSection;
