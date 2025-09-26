// frontend/src/components/sections/FilterSection.jsx

import React from "react";
import { useTranslation } from "react-i18next";
import "../../styles/HomePage.css";

function FilterSection({ onFilterChange, currentFilter, cuisines }) {
  const { t } = useTranslation();

  return (
    <div className="filter-container">
      {/* Khu vực */}
      <div className="filter-group">
        <label htmlFor="area-select" className="filter-label">
          {t("filter.area")}
        </label>
        <select
          id="area-select"
          className="filter-select"
          onChange={(e) => onFilterChange("address", e.target.value)}
        >
          <option value="">{t("filter.allAreas")}</option>
          <option value="Hải Châu">Hải Châu</option>
          <option value="Sơn Trà">Sơn Trà</option>
          <option value="Ngũ Hành Sơn">Ngũ Hành Sơn</option>
        </select>
      </div>

      {/* Loại ẩm thực */}
      <div className="filter-group">
        <label htmlFor="cuisine-select" className="filter-label">
          {t("filter.cuisine")}
        </label>
        <select
          id="cuisine-select"
          className="filter-select"
          value={currentFilter}
          onChange={(e) => onFilterChange("cuisine_type", e.target.value)}
        >
          <option value="">{t("filter.allCuisines")}</option>
          {cuisines.map((cuisine) => (
            <option key={cuisine} value={cuisine}>
              {cuisine}
            </option>
          ))}
        </select>
      </div>

      {/* Map button */}
      <button className="map-button">
        <i className="fas fa-map-marker-alt icon"></i>
        {t("filter.map")}
      </button>
    </div>
  );
}

export default FilterSection;
