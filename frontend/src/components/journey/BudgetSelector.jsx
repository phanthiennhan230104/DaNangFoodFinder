import React from "react";
import { Wallet } from "lucide-react";

const BudgetSelector = ({ budget, setBudget }) => {
  const budgetOptions = [100000, 200000, 300000, 500000];

  return (
    <div>
      <div className="control-label">
        <Wallet className="inline w-4 h-4 mr-1" />
        Select Budget
      </div>
      <div className="budget-options">
        {budgetOptions.map((amount) => (
          <button
            key={amount}
            className={`budget-option ${budget === amount ? "selected" : ""}`}
            onClick={() => setBudget(amount)}
          >
            💰 {amount.toLocaleString()} VND
          </button>
        ))}
      </div>
    </div>
  );
};

export default BudgetSelector;
