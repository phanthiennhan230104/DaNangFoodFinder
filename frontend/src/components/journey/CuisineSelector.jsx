import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../api";

const CuisineSelector = ({ 
  cuisineSearch, 
  setCuisineSearch, 
  suggestions, 
  setSuggestions, 
  onCuisineSelect 
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // Disable API search - just clear suggestions
  useEffect(() => {
    setSuggestions([]);
  }, [cuisineSearch, setSuggestions]);

  const handleSelectRestaurant = (restaurant) => {
    // When user clicks a restaurant, select its cuisine type
    onCuisineSelect(restaurant.cuisine_type);
    setCuisineSearch(""); // Clear search
    setSuggestions([]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="cuisine-search-container"
    >
      <label className="control-label">
        <Search className="inline w-4 h-4 mr-1" />
        Search Cuisine
      </label>
      <div style={{ position: 'relative' }} className="cuisine-search-wrapper">
        <input
          type="text"
          placeholder="Enter cuisine type to filter..."
          value={cuisineSearch}
          onChange={(e) => setCuisineSearch(e.target.value)}
          className="cuisine-search-input"
        />
      </div>

    </motion.div>
  );
};

export default CuisineSelector;