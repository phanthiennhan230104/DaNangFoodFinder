// frontend/src/components/sections/HeroSection.jsx

import { useState } from "react";
import { useTranslation } from "react-i18next";   // ⬅️ import i18n hook
import "../../styles/HomePage.css";

function HeroSection({ onSearch }) {
  const { t } = useTranslation();                // ⬅️ khởi tạo i18n
  const [query, setQuery] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
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
          <button type="submit" className="hero-search-button">
            <i className="fas fa-search"></i> {t("hero.searchButton")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default HeroSection;
