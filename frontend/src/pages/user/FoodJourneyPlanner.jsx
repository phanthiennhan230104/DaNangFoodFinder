import { useState, useEffect } from "react";
import api from "../../api";
import BudgetSelector from "../../components/journey/BudgetSelector";
import CuisineSelector from "../../components/journey/CuisineSelector";
import RestaurantCard from "../../components/journey/RestaurantCard";
import JourneyTimeline from "../../components/journey/JourneyTimeline";
import { Calendar, Search } from "lucide-react";
import "../../styles/FoodJourneyPlanner.css";

const FoodJourneyPlanner = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [budget, setBudget] = useState(300000);
  const [preferences, setPreferences] = useState(["Vietnamese"]);
  const [journey, setJourney] = useState({
    breakfast: null,
    lunch: null,
    dinner: null,
  });
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
      const data = res.data;

      if (data.top_candidates) {
        // Gộp hết các candidate vào 1 array để map
        const combined = [
          ...(data.top_candidates.breakfast || []),
          ...(data.top_candidates.lunch || []),
          ...(data.top_candidates.dinner || []),
        ];
        setRestaurants(combined);
      } else {
        setRestaurants([]);
      }
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
    <div className="food-journey-container">
      {/* Controls */}
      <div className="controls-section">
        {/* Chọn ngày */}
        <div className="control-group">
          <label className="control-label">
            <Calendar className="inline w-4 h-4 mr-1" />
            Select Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-input"
          />
        </div>

        {/* Budget */}
        <div className="control-group">
          <span className="control-label">💰 Budget Range</span>
          <BudgetSelector budget={budget} setBudget={setBudget} />
        </div>

        {/* Cuisine */}
        <div className="control-group">
          <span className="control-label">🍲 Cuisine Preferences</span>
          <CuisineSelector
            preferences={preferences}
            setPreferences={setPreferences}
          />
        </div>

        {/* Search */}
        <div className="search-section">
          <label className="control-label">
            <Search className="inline w-4 h-4 mr-1" />
            Search Restaurants
          </label>
          <input
            type="text"
            placeholder="Search by name or dish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Recommendations */}
      <div className="recommendations-section">
        {["breakfast", "lunch", "dinner"].map((mealType) => (
          <div className="meal-section" key={mealType}>
            <h2 className="meal-title">
              {mealType.charAt(0).toUpperCase() + mealType.slice(1)}{" "}
              Recommendations
            </h2>
            {groupedRestaurants[mealType].length > 0 ? (
              groupedRestaurants[mealType].map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  onAddToJourney={addToJourney}
                  isInJourney={isRestaurantInJourney(restaurant)}
                />
              ))
            ) : (
              <div className="no-results">
                No restaurants found for {mealType}
                <div className="filter-suggestion">
                  Try adjusting your filters
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="journey-timeline">
        <JourneyTimeline
          journey={journey}
          onRemoveFromJourney={removeFromJourney}
          totalBudget={totalBudget}
        />
      </div>
    </div>
  );
};

export default FoodJourneyPlanner;
