// frontend/src/components/sections/Homepage/QuickActions.jsx

import React from "react";
import { useNavigate } from "react-router-dom";
import "../../../styles/user/HomePage.css";

export default function QuickActions({ onScrollToFilters }) {
  const navigate = useNavigate();

  const goNearby = () => navigate("/nearby");

  const goFavorites = () => navigate("/favorites");
  const goPlanner = () => navigate("/journey");

  return (
    <div className="quick-actions">
      <button className="quick-action" onClick={goNearby} aria-label="Nearby restaurants">
        <i className="fa-solid fa-location-dot action-icon" />
        <span className="action-label">Nearby restaurants</span>
      </button>

      <button className="quick-action" onClick={goFavorites} aria-label="Favourite restaurants">
        <i className="fa-solid fa-heart action-icon" />
        <span className="action-label">Favourite restaurants</span>
      </button>

      <button className="quick-action" onClick={goPlanner} aria-label="Food Journey Planner">
        <i className="fa-solid fa-route action-icon" />
        <span className="action-label">Food Journey Planner</span>
      </button>

      <button className="quick-action explore" onClick={onScrollToFilters}>
        <i className="fa-solid fa-sliders action-icon" />
        <span>Advanced filters</span>
      </button>
    </div>
  );
}
