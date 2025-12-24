import React from "react";
import { MapPin, Star } from "lucide-react";
import { motion } from "framer-motion";

const RestaurantCard = ({ restaurant, onAddToJourney, isInJourney, canAdd = true, budget = 300000, journey = {} }) => {
  const getMealIcon = (mealType) => {
    switch (mealType) {
      case "breakfast":
        return "🌅";
      case "lunch":
        return "☀️";
      case "dinner":
        return "🌙";
      default:
        return "🍽";
    }
  };

  // Calculate total of OTHER meals (not including current meal type)
  const otherMealsTotal = Object.entries(journey)
    .filter(([key]) => key !== restaurant.meal_type)
    .reduce((sum, [, r]) => sum + (r?.price || 0), 0);

  const wouldExceedBudget = budget && otherMealsTotal + restaurant.price > budget;

  return (
    <motion.div
      className={`restaurant-card ${wouldExceedBudget ? "would-exceed" : ""} ${isInJourney ? "selected" : ""}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={canAdd && !isInJourney ? { scale: 1.03, boxShadow: "0 8px 20px rgba(0,0,0,0.1)" } : {}}
      whileTap={canAdd && !isInJourney ? { scale: 0.97 } : {}}
      transition={{ duration: 0.3 }}
      style={{ cursor: canAdd && !isInJourney ? "pointer" : "not-allowed", opacity: canAdd || isInJourney ? 1 : 0.5 }}
    >
      <div className="restaurant-header">
        <div className="restaurant-name">🏠 {restaurant.name}</div>
        <div className="meal-badge">{getMealIcon(restaurant.meal_type)} {restaurant.meal_type}</div>
      </div>
      <div className="restaurant-details">
        <MapPin className="inline w-3 h-3 mr-1" />
        {restaurant.address}
        <br />
        🍽 {restaurant.cuisine_type} • 💵 {restaurant.price_range}
      </div>
      <div className="restaurant-meta">
        <span className="rating">
          <Star className="inline w-4 h-4" style={{ fill: "#FFD700" }} />
          {restaurant.average_rating || "N/A"}
        </span>
        <span className="price-estimate">
          Est: {restaurant.price ? restaurant.price.toLocaleString() : "N/A"} VND
        </span>
      </div>
      {isInJourney ? (
        <motion.div
          className="slot-status"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          ✅ Selected in your journey
        </motion.div>
      ) : (
        <>
          {wouldExceedBudget && (
            <motion.div
              className="slot-status warning"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              ⚠️ Exceeds budget
            </motion.div>
          )}
          <motion.button
            className="btn-add-journey"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onAddToJourney(restaurant)}
          >
            ➕ Switch to this
          </motion.button>
        </>
      )}
    </motion.div>
  );
};

export default RestaurantCard;
