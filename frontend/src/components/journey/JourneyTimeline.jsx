import React from "react";
import { Calendar, Coffee, Sandwich, UtensilsCrossed } from "lucide-react";
import { motion } from "framer-motion";

const JourneyTimeline = ({ journey, onRemoveFromJourney, totalBudget }) => {
  const slots = [
    { key: "breakfast", label: "Breakfast", icon: <Coffee className="inline w-4 h-4 mr-1" /> },
    { key: "lunch", label: "Lunch", icon: <Sandwich className="inline w-4 h-4 mr-1" /> },
    { key: "dinner", label: "Dinner", icon: <UtensilsCrossed className="inline w-4 h-4 mr-1" /> },
  ];

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

      <div className="budget-display">
        <div className="budget-label">Total Budget:</div>
        <div className="budget-amount">💵 {totalBudget.toLocaleString()} VND</div>
      </div>

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
    </motion.div>
  );
};

export default JourneyTimeline;
