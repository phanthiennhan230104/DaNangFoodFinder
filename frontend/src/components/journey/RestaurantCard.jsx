import React from "react";
import { MapPin } from "lucide-react";

const RestaurantCard = ({ restaurant, onAddToJourney, isInJourney }) => {
  return (
    <div
      className="restaurant-card"
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
        <div className="slot-status">✅ Already in your journey</div>
      )}
    </div>
  );
};

export default RestaurantCard;
