import React from "react";
import { Utensils } from "lucide-react";

const cuisines = ["Vietnam", "Korean", "Italian", "Japanese", "Central Cuisine"];

const CuisineSelector = ({ preferences, setPreferences }) => {
  const toggleCuisine = (cuisine) => {
    if (preferences.includes(cuisine)) {
      setPreferences(preferences.filter((c) => c !== cuisine));
    } else {
      setPreferences([...preferences, cuisine]);
    }
  };

  return (
    <div>
      <div className="control-label">
        <Utensils className="inline w-4 h-4 mr-1" />
        Select Cuisine
      </div>
      <div className="cuisine-tags">
        {cuisines.map((cuisine) => (
          <button
            key={cuisine}
            className={`cuisine-tag ${
              preferences.includes(cuisine) ? "selected" : ""
            }`}
            onClick={() => toggleCuisine(cuisine)}
          >
            🍲 {cuisine}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CuisineSelector;
