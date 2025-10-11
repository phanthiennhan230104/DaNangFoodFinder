// frontend/src/components/sections/FilterSection.jsx

import React from "react";
import { useTranslation } from "react-i18next";
import "../../styles/HomePage.css";

function FilterSection({ onFilterChange, filters, areas, cuisines }) {
  const { t } = useTranslation();

  return (
    <div className="filter-container">
      <div className="filter-groups">
        {/* Area select */}
        <div className="filter-group">
          <label htmlFor="area-select" className="filter-label">
            {t("filter.area")}
          </label>
          <select
            id="area-select"
            className="filter-select"
            value={filters.address}
            onChange={(e) => onFilterChange("address", e.target.value)}
          >
            <option value="">{t("filter.allAreas")}</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        {/* Cuisine select */}
        <div className="filter-group">
          <label htmlFor="cuisine-select" className="filter-label">
            {t("filter.cuisine")}
          </label>
          <select
            id="cuisine-select"
            className="filter-select"
            value={filters.cuisine_type}
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
