import { MapPin, DollarSign, Navigation } from "lucide-react";

const JourneyTimeline = ({ journey, onRemoveFromJourney, totalBudget }) => {
  const formatPrice = (price) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  const timeSlots = [
    { key: "breakfast", label: "Sáng (6:00 - 10:00)", color: "border-yellow-300" },
    { key: "lunch", label: "Trưa (11:00 - 15:00)", color: "border-orange-300" },
    { key: "dinner", label: "Tối (17:00 - 22:00)", color: "border-purple-300" },
  ];

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Your Food Journey</h3>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Budget</p>
          <p className="text-lg font-semibold text-green-600">{formatPrice(totalBudget)}</p>
        </div>
      </div>

      <div className="space-y-6">
        {timeSlots.map((slot) => {
          const restaurant = journey[slot.key];
          return (
            <div key={slot.key} className={`border-l-4 ${slot.color} pl-4`}>
              <h4 className="font-medium text-gray-900 mb-2">{slot.label}</h4>
              {restaurant ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium">{restaurant.name}</h5>
                    <button
                      onClick={() => onRemoveFromJourney(slot.key)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {restaurant.address}
                    </p>
                    <p className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {formatPrice(restaurant.price || 0)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500">
                  <p>No restaurant selected</p>
                  <p className="text-sm">Browse recommendations to add</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.values(journey).filter(Boolean).length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
            <Navigation className="w-4 h-4" />
            View on Map & Get Directions
          </button>
        </div>
      )}
    </div>
  );
};

export default JourneyTimeline;
