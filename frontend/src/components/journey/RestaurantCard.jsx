import { MapPin, Clock, DollarSign, Star, Heart } from "lucide-react";

const RestaurantCard = ({ restaurant, onAddToJourney, isInJourney }) => {
  const formatPrice = (price) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  const getTimeSlotLabel = (type) => {
    const labels = {
      breakfast: { label: "Sáng", color: "bg-yellow-100 text-yellow-800" },
      lunch: { label: "Trưa", color: "bg-orange-100 text-orange-800" },
      dinner: { label: "Tối", color: "bg-purple-100 text-purple-800" },
    };
    return labels[type] || labels.lunch;
  };

  const timeLabel = getTimeSlotLabel(restaurant.meal_type);

  return (
    <div className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{restaurant.image || "🍽️"}</div>
          <div>
            <h3 className="font-semibold text-gray-900">{restaurant.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className={`px-2 py-1 rounded-full text-xs ${timeLabel.color}`}>
                {timeLabel.label}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                {restaurant.rating || restaurant.average_rating || "N/A"}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onAddToJourney(restaurant)}
          disabled={isInJourney}
          className={`p-2 rounded-full transition-all ${
            isInJourney
              ? "bg-green-100 text-green-600"
              : "bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600"
          }`}
        >
          <Heart className={`w-4 h-4 ${isInJourney ? "fill-current" : ""}`} />
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin className="w-3 h-3" />
          {restaurant.address}
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-3 h-3" />
          {restaurant.opening_hours || "N/A"}
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <DollarSign className="w-3 h-3" />
          {formatPrice(restaurant.price || 0)}
        </div>
      </div>
    </div>
  );
};

export default RestaurantCard;
