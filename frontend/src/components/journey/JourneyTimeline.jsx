import React, { useState } from "react";
import { Calendar, Coffee, Sandwich, UtensilsCrossed, AlertCircle, Save } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../api";

const JourneyTimeline = ({ journey, onRemoveFromJourney, totalBudget, budget = 300000, selectedDate }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const slots = [
    { key: "breakfast", label: "Breakfast", icon: <Coffee className="inline w-4 h-4 mr-1" /> },
    { key: "lunch", label: "Lunch", icon: <Sandwich className="inline w-4 h-4 mr-1" /> },
    { key: "dinner", label: "Dinner", icon: <UtensilsCrossed className="inline w-4 h-4 mr-1" /> },
  ];

  const isOverBudget = totalBudget > budget;

  const handleSaveJourney = async () => {
    // Check if at least one meal is selected
    const hasSelectedMeal = Object.values(journey).some(meal => meal !== null);
    if (!hasSelectedMeal) {
      setSaveMessage("⚠️ Please select at least one restaurant!");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      const journeyData = {
        date: selectedDate,
        breakfast_id: journey.breakfast?.id || null,
        lunch_id: journey.lunch?.id || null,
        dinner_id: journey.dinner?.id || null,
      };

      console.log("Saving journey data:", journeyData);

      const response = await api.post("journey/", journeyData);
      
      console.log("Save response:", response);

      if (response.status === 200 || response.status === 201) {
        setSaveMessage("✅ Journey saved successfully!");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        setSaveMessage(`❌ Unexpected response status: ${response.status}`);
        setTimeout(() => setSaveMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error saving journey:", error);
      let errorMsg = "❌ Failed to save journey. Please try again.";
      
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
        if (error.response.status === 401) {
          errorMsg = "❌ Please login to save your journey!";
        } else if (error.response.data?.detail) {
          errorMsg = `❌ Error: ${error.response.data.detail}`;
        } else if (error.response.data) {
          errorMsg = `❌ Error: ${JSON.stringify(error.response.data)}`;
        }
      }
      
      setSaveMessage(errorMsg);
      setTimeout(() => setSaveMessage(""), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      className="journey-timeline"
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="timeline-title">
        <Calendar className="inline w-5 h-5 mr-2" />
        Your Journey
      </h2>

      <div className={`budget-display ${isOverBudget ? "over-budget" : ""}`}>
        <div className="budget-info">
          <div className="budget-label">Total Spent:</div>
          <div className={`budget-amount ${isOverBudget ? "error" : ""}`}>
            💵 {totalBudget.toLocaleString()} VND
          </div>
        </div>
        <div className="budget-info">
          <div className="budget-label">Budget:</div>
          <div className="budget-amount">🎯 {budget.toLocaleString()} VND</div>
        </div>
      </div>

      {isOverBudget && (
        <motion.div
          className="budget-warning"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <AlertCircle className="inline w-5 h-5 mr-2" />
          Exceeded budget by {(totalBudget - budget).toLocaleString()} VND!
          Remove a restaurant to stay within budget.
        </motion.div>
      )}

      <div className="time-slots">
        {slots.map(({ key, label, icon }) => (
          <motion.div
            key={key}
            className="time-slot"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <div className="time-label">
              {icon}
              {label}
            </div>
            {journey[key] ? (
              <>
                <div className="restaurant-name">🏠 {journey[key].name}</div>
                <div className="restaurant-details">
                  🍽 {journey[key].cuisine_type} • 💵 {journey[key].price_range}
                </div>
                <div className="meal-price">
                  Est: {journey[key].price ? journey[key].price.toLocaleString() : "N/A"} VND
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => onRemoveFromJourney(key)}
                  className="btn btn-secondary"
                  style={{ marginTop: "0.5rem" }}
                >
                  ❌ Remove
                </motion.button>
              </>
            ) : (
              <>
                <div className="slot-status">No restaurant selected</div>
                <div className="browse-suggestion">Browse recommendations above</div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {saveMessage && (
        <motion.div
          className="save-message"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {saveMessage}
        </motion.div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSaveJourney}
        disabled={isSaving}
        className="btn btn-save"
      >
        <Save className="inline w-4 h-4 mr-2" />
        {isSaving ? "Saving..." : "Save Journey"}
      </motion.button>
    </motion.div>
  );
};

export default JourneyTimeline;