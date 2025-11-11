import React from "react";
import { Utensils } from "lucide-react";
import { motion } from "framer-motion";

const cuisines = ["Vietnam", "Korean", "Italian", "Japanese", "Central Cuisine"];

const CuisineSelector = ({ preferences, setPreferences }) => {
  const toggleCuisine = (cuisine) => {
    if (preferences.includes(cuisine))
      setPreferences(preferences.filter((c) => c !== cuisine));
    else setPreferences([...preferences, cuisine]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="control-label">
        <Utensils className="inline w-4 h-4 mr-1" />
        Select Cuisine
      </div>
      <div className="cuisine-tags">
        {cuisines.map((cuisine) => (
          <motion.button
            key={cuisine}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className={`cuisine-tag ${
              preferences.includes(cuisine) ? "selected" : ""
            }`}
            onClick={() => toggleCuisine(cuisine)}
          >
            🍲 {cuisine}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default CuisineSelector;
