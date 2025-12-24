import React from "react";
import { Wallet } from "lucide-react";
import { motion } from "framer-motion";

const BudgetSelector = ({ budget, setBudget }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="budget-container"
    >
      <label className="control-label">
        <Wallet className="inline w-4 h-4 mr-1" />
        Select Budget
      </label>
      <div className="budget-input-wrapper">
        <span className="budget-icon">💰</span>
        <input
          type="text"
          className="budget-input"
          placeholder="Nhập số tiền..."
          value={budget ? budget.toLocaleString() : ""}
          onChange={(e) => {
            const rawValue = e.target.value.replace(/,/g, "").replace(/\./g, "");
            if (rawValue === "" || /^\d+$/.test(rawValue)) {
              setBudget(rawValue === "" ? "" : parseInt(rawValue, 10));
            }
          }}
        />
        <span className="budget-suffix">VND</span>
      </div>
    </motion.div>
  );
};

export default BudgetSelector;