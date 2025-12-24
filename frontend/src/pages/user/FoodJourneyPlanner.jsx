import { useState, useEffect } from "react";
import { Calendar, Search } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../api";
import BudgetSelector from "../../components/journey/BudgetSelector";
import CuisineSelector from "../../components/journey/CuisineSelector";
import RestaurantCard from "../../components/journey/RestaurantCard";
import JourneyTimeline from "../../components/journey/JourneyTimeline";
import Footer from "../../components/layout/Footer";
import "../../styles/user/FoodJourneyPlanner.css";

const FoodJourneyPlanner = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [budget, setBudget] = useState(300000);
  const [cuisineSearch, setCuisineSearch] = useState("");
  const [cuisineSuggestions, setCuisineSuggestions] = useState([]);
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  const [journey, setJourney] = useState({ breakfast: null, lunch: null, dinner: null });
  const [restaurants, setRestaurants] = useState([]);

  // Fetch restaurants based on selected cuisines and budget
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const params = new URLSearchParams();
        params.append("budget", budget);
        if (selectedCuisines.length > 0) {
          params.append("preferences", selectedCuisines.join(","));
        }
        const res = await api.get(`journey/restaurants/?${params.toString()}`);
        const data = res.data;
        if (data.top_candidates) {
          const combined = [
            ...(data.top_candidates.breakfast || []),
            ...(data.top_candidates.lunch || []),
            ...(data.top_candidates.dinner || []),
          ];
          
          // Filter by cuisine search locally
          let filtered = combined;
          if (cuisineSearch.trim()) {
            filtered = combined.filter(r => 
              r.cuisine_type && r.cuisine_type.toLowerCase().includes(cuisineSearch.toLowerCase())
            );
          }
          
          setRestaurants(filtered);
          
          // Auto-set best plan
          if (data.best_plan) {
            const newJourney = { breakfast: null, lunch: null, dinner: null };
            if (data.best_plan.breakfast) newJourney.breakfast = data.best_plan.breakfast;
            if (data.best_plan.lunch) newJourney.lunch = data.best_plan.lunch;
            if (data.best_plan.dinner) newJourney.dinner = data.best_plan.dinner;
            setJourney(newJourney);
          }
        } else {
          setRestaurants([]);
        }
      } catch {
        setRestaurants([]);
      }
    };
    fetchRestaurants();
  }, [budget, selectedCuisines, cuisineSearch]);

  const totalBudget = Object.values(journey)
    .filter(Boolean)
    .reduce((sum, r) => sum + (r.price || 0), 0);

  const addToJourney = (restaurant) => {
    setJourney((prev) => ({ ...prev, [restaurant.meal_type]: restaurant }));
  };

  const removeFromJourney = (slot) => setJourney((prev) => ({ ...prev, [slot]: null }));

  const isRestaurantInJourney = (restaurant) =>
    Object.values(journey).some((j) => j && j.id === restaurant.id);

  const handleSelectCuisine = (cuisine) => {
    if (selectedCuisines.includes(cuisine)) {
      setSelectedCuisines(selectedCuisines.filter((c) => c !== cuisine));
    } else {
      setSelectedCuisines([...selectedCuisines, cuisine]);
    }
  };

  const groupedRestaurants = {
    breakfast: restaurants.filter((r) => r.meal_type === "breakfast"),
    lunch: restaurants.filter((r) => r.meal_type === "lunch"),
    dinner: restaurants.filter((r) => r.meal_type === "dinner"),
  };

  return (
    <motion.div
      className="food-journey-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
    <main className="main-content container">
      <div className="controls-section">
        <div className="control-group">
          <div className="date-container">
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
        </div>

        <div className="control-group">
          <BudgetSelector budget={budget} setBudget={setBudget} />
        </div>

        <div className="control-group">
          <CuisineSelector 
            cuisineSearch={cuisineSearch}
            setCuisineSearch={setCuisineSearch}
            suggestions={cuisineSuggestions}
            setSuggestions={setCuisineSuggestions}
            onCuisineSelect={handleSelectCuisine}
          />
        </div>

        {selectedCuisines.length > 0 && (
          <div className="selected-cuisines">
            <label className="control-label">Selected Cuisines:</label>
            <div className="cuisine-tags">
              {selectedCuisines.map((cuisine) => (
                <motion.button
                  key={cuisine}
                  className="cuisine-tag selected"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectCuisine(cuisine)}
                >
                  🍲 {cuisine} ✕
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="recommendations-section">
        {["breakfast", "lunch", "dinner"].map((mealType) => {
          const mealIcons = {
            breakfast: "🌅",
            lunch: "☀️",
            dinner: "🌙"
          };
          return (
            <motion.div
              key={mealType}
              className="meal-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <h2 className="meal-title">
                {mealIcons[mealType]} {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
              </h2>
              {groupedRestaurants[mealType].length > 0 ? (
                groupedRestaurants[mealType].map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    onAddToJourney={addToJourney}
                    isInJourney={isRestaurantInJourney(restaurant)}
                    canAdd={true}
                    budget={budget}
                    journey={journey}
                  />
                ))
              ) : (
                <div className="no-results">
                  No restaurants found for {mealType}
                  <div className="filter-suggestion">Try adjusting your filters</div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <JourneyTimeline
        journey={journey}
        onRemoveFromJourney={removeFromJourney}
        totalBudget={totalBudget}
        budget={budget}
        selectedDate={selectedDate}
      />
    </main>
    <Footer />
    </motion.div>
  );
};

export default FoodJourneyPlanner;