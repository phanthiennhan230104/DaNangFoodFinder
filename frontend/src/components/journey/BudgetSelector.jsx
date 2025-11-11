import React from "react";
import { Wallet } from "lucide-react";
import { motion } from "framer-motion";

const BudgetSelector = ({ budget, setBudget }) => {
  const budgetOptions = [100000, 200000, 300000, 500000];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="control-label">
        <Wallet className="inline w-4 h-4 mr-1" />
        Select Budget
      </div>
      <div className="budget-options">
        {budgetOptions.map((amount) => (
          <motion.button
            key={amount}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className={`budget-option ${budget === amount ? "selected" : ""}`}
            onClick={() => setBudget(amount)}
          >
            💰 {amount.toLocaleString()} VND
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default BudgetSelector;
