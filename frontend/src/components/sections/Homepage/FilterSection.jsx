// frontend/src/components/sections/FilterSection.jsx

import React from "react";
import "../../../styles/user/HomePage.css";

function FilterSection({ onFilterChange, filters, areas, cuisinesByCountry, foodTypes }) {
  return (
    <div className="filter-container">
      <div className="filter-groups">
        {/* Area/Location select */}
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

        {/* Cuisine by Country select */}
        <div className="filter-group">
          <label htmlFor="country-cuisine-select" className="filter-label">
            Cuisine:
          </label>
          <select
            id="country-cuisine-select"
            className="filter-select"
            value={filters.cuisine_country}
            onChange={(e) => onFilterChange("cuisine_country", e.target.value)}
          >
            <option value="">-- All cuisines --</option>
            {cuisinesByCountry.map((cuisine) => (
              <option key={cuisine} value={cuisine}>
                {cuisine}
              </option>
            ))}
          </select>
        </div>

        {/* Food Type select */}
        <div className="filter-group">
          <label htmlFor="food-type-select" className="filter-label">
            Food Type:
          </label>
          <select
            id="food-type-select"
            className="filter-select"
            value={filters.food_type}
            onChange={(e) => onFilterChange("food_type", e.target.value)}
          >
            <option value="">-- All types --</option>
            {foodTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default FilterSection;
