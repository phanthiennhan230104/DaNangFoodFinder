// frontend/src/components/sections/HeroSection.jsx

import { useState } from "react";
import { useTranslation } from "react-i18next";  
import "../../styles/HomePage.css";

function HeroSection({ onSearch }) {
  const { t } = useTranslation();         
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);

  // Submit khi nhấn nút search
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() !== "") {
      onSearch(query.trim());
    }
  };

  // Nhận diện giọng nói
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("❌ Trình duyệt không hỗ trợ Speech Recognition (khuyến nghị dùng Chrome).");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";  // Ngôn ngữ tiếng Việt
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.start();
    setListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      if (onSearch) {
        onSearch(transcript);
      }
      setListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };
  };

  return (
    <div className="hero-container">
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

          {/* 🎤 Micro nằm trước nút tìm kiếm */}
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

          {/* 🔍 Nút search */}
          <button type="submit" className="hero-search-button">
            <i className="fas fa-search"></i> {t("hero.searchButton")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default HeroSection;
