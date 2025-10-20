// frontend/src/components/sections/FilterSection.jsx

import React from "react";
import "../../../styles/user/HomePage.css";

function FilterSection({ onFilterChange, filters, areas, cuisines }) {
  return (
    <div className="filter-container">
      <div className="filter-groups">
        {/* Area select */}
        <div className="filter-group">
          <label htmlFor="area-select" className="filter-label">
            Area:
          </label>
          <select
            id="area-select"
            className="filter-select"
            value={filters.address}
            onChange={(e) => onFilterChange("address", e.target.value)}
          >
            <option value="">-- All areas --</option>
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
            Cuisine:
          </label>
          <select
            id="cuisine-select"
            className="filter-select"
            value={filters.cuisine_type}
            onChange={(e) => onFilterChange("cuisine_type", e.target.value)}
          >
            <option value="">-- All cuisines --</option>
            {cuisines.map((cuisine) => (
              <option key={cuisine} value={cuisine}>
                {cuisine}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default FilterSection;
