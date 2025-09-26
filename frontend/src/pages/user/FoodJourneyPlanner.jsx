import { useState, useEffect } from "react";
import api from "../../api";
import BudgetSelector from "../../components/journey/BudgetSelector";
import CuisineSelector from "../../components/journey/CuisineSelector";
import RestaurantCard from "../../components/journey/RestaurantCard";
import JourneyTimeline from "../../components/journey/JourneyTimeline";
import { Calendar, Search } from "lucide-react";
import "../../styles/FoodJourneyPlanner.css";


const FoodJourneyPlanner = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [budget, setBudget] = useState(300000);
  const [preferences, setPreferences] = useState(["Vietnamese"]);
  const [journey, setJourney] = useState({ breakfast: null, lunch: null, dinner: null });
  const [searchQuery, setSearchQuery] = useState("");
  const [restaurants, setRestaurants] = useState([]);

  // 👉 gọi API backend
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const params = new URLSearchParams();
        params.append("budget", budget);
        params.append("preferences", preferences.join(","));
        if (searchQuery) params.append("search", searchQuery);

        const res = await api.get(`journey/restaurants/?${params.toString()}`);
        setRestaurants(res.data || []);
      } catch (error) {
        console.error("Lỗi khi lấy restaurants:", error);
        setRestaurants([]);
      }
    };
    fetchRestaurants();
  }, [budget, preferences, searchQuery]);

  // 👉 Tính tổng chi phí
  const totalBudget = Object.values(journey)
    .filter(Boolean)
    .reduce((sum, r) => sum + (r.price || 0), 0);

  // 👉 Hàm xử lý journey
  const addToJourney = (restaurant) => {
    setJourney((prev) => ({
      ...prev,
      [restaurant.meal_type]: restaurant,
    }));
  };

  const removeFromJourney = (slot) => {
    setJourney((prev) => ({ ...prev, [slot]: null }));
  };

  const isRestaurantInJourney = (restaurant) =>
    Object.values(journey).some((j) => j && j.id === restaurant.id);

  // 👉 Nhóm nhà hàng theo meal_type
  const groupedRestaurants = {
    breakfast: restaurants.filter((r) => r.meal_type === "breakfast"),
    lunch: restaurants.filter((r) => r.meal_type === "lunch"),
    dinner: restaurants.filter((r) => r.meal_type === "dinner"),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Food Journey Planner</h1>
          <p className="text-gray-600">Create your perfect day of dining in Da Nang</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar - Filters */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border shadow-sm p-6 space-y-6 sticky top-6">
              {/* Chọn ngày */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <BudgetSelector budget={budget} setBudget={setBudget} />
              <CuisineSelector preferences={preferences} setPreferences={setPreferences} />

              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Search className="inline w-4 h-4 mr-1" />
                  Search Restaurants
                </label>
                <input
                  type="text"
                  placeholder="Search by name or dish..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Middle - Recommendations */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {["breakfast", "lunch", "dinner"].map((mealType) => {
                const restaurantsList = groupedRestaurants[mealType];
                const mealLabels = {
                  breakfast: "Breakfast Recommendations",
                  lunch: "Lunch Recommendations",
                  dinner: "Dinner Recommendations",
                };

                return (
                  <div key={mealType}>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      {mealLabels[mealType]}
                    </h2>
                    <div className="space-y-4">
                      {restaurantsList.length > 0 ? (
                        restaurantsList.map((restaurant) => (
                          <RestaurantCard
                            key={restaurant.id}
                            restaurant={restaurant}
                            onAddToJourney={addToJourney}
                            isInJourney={isRestaurantInJourney(restaurant)}
                          />
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No restaurants found for {mealType}</p>
                          <p className="text-sm">Try adjusting your filters</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Sidebar - Journey */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <JourneyTimeline
                journey={journey}
                onRemoveFromJourney={removeFromJourney}
                totalBudget={totalBudget}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodJourneyPlanner;
