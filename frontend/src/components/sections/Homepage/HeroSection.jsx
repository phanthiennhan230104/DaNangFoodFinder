// frontend/src/components/sections/HeroSection.jsx

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../../styles/user/HomePage.css";

function HeroSection({ onSearch }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

  // Danh sách các ảnh nền
  const images = [
    "/images/bg1.jpg",
    "/images/bg2.jpg",
    "/images/bg3.jpg",
    "/images/bg4.jpg",
  ];

  // Tự động đổi ảnh
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Nhận diện giọng nói
  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("❌ Trình duyệt không hỗ trợ Speech Recognition (khuyến nghị dùng Chrome).");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
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
        <h1>{t("hero.title")}</h1>
        <p>{t("hero.subtitle")}</p>

        <form onSubmit={handleSubmit} className="hero-search-form">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("hero.searchPlaceholder")}
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
            <i className="fas fa-search"></i> {t("hero.searchButton")}
          </button>
        </form>
      </div>

      <div className="hero-overlay"></div>
    </div>
  );
}

export default HeroSection;
