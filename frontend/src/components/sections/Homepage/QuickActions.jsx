// frontend/src/components/sections/Homepage/QuickActions.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../../../styles/user/HomePage.css";

export default function QuickActions({ coords, onScrollToFilters }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const goNearby = () => {
    // Gắn lat/lon vào query nếu có
    const q = coords?.lat && coords?.lon ? `?lat=${coords.lat}&lon=${coords.lon}` : "";
    navigate(`/nearby${q}`);
  };

  const goFavorites = () => navigate("/favorites");
  // Đổi đường dẫn này theo route thực tế của bạn: /journey-planner hoặc /food-journey-planner
  const goPlanner = () => navigate("/journey");

  return (
    <div className="quick-actions">
      <button className="quick-action" onClick={goNearby} aria-label="Nhà hàng gần đây">
        <i className="fa-solid fa-location-dot action-icon" />
        {t("filter.map")}
      </button>

      <button className="quick-action" onClick={goFavorites} aria-label="Yêu thích">
        <i className="fa-solid fa-heart action-icon" />
        <span className="action-label">Yêu thích</span>
      </button>

      <button className="quick-action" onClick={goPlanner} aria-label="Food Journey Planner">
        <i className="fa-solid fa-route action-icon" />
        <span className="action-label">Food Journey Planner</span>
      </button>

      <button className="quick-action explore" onClick={onScrollToFilters}>
        <i className="fa-solid fa-sliders action-icon" />
        <span>Bộ lọc nâng cao</span>
      </button>
    </div>
  );
}
