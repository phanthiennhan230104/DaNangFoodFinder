import { DollarSign } from "lucide-react";

const BudgetSelector = ({ budget, setBudget }) => {
  const budgetRanges = [
    { label: "Budget (< 100k)", value: 100000, color: "bg-green-100 text-green-800" },
    { label: "Medium (100k - 300k)", value: 300000, color: "bg-yellow-100 text-yellow-800" },
    { label: "Premium (> 300k)", value: 999999, color: "bg-purple-100 text-purple-800" }
  ];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        <DollarSign className="inline w-4 h-4 mr-1" />
        Budget Range
      </label>
      <div className="flex flex-wrap gap-2">
        {budgetRanges.map((range) => (
          <button
            key={range.value}
            onClick={() => setBudget(range.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              budget === range.value
                ? range.color
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BudgetSelector;
