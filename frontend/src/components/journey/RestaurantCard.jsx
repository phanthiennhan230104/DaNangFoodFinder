import React from "react";
import { MapPin } from "lucide-react";
import { motion } from "framer-motion";

const RestaurantCard = ({ restaurant, onAddToJourney, isInJourney }) => {
  return (
    <motion.div
      className="restaurant-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03, boxShadow: "0 8px 20px rgba(0,0,0,0.1)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.3 }}
      onClick={() => !isInJourney && onAddToJourney(restaurant)}
    >
      <div className="restaurant-name">🏠 {restaurant.name}</div>
      <div className="restaurant-details">
        <MapPin className="inline w-3 h-3 mr-1" />
        {restaurant.address}
        <br />
        🍽 {restaurant.cuisine_type} • 💵 {restaurant.price_range}
      </div>
      {isInJourney && (
        <motion.div
          className="slot-status"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          ✅ Already in your journey
        </motion.div>
      )}
    </motion.div>
  );
};

export default RestaurantCard;
