const CuisineSelector = ({ preferences, setPreferences }) => {
  const cuisines = [
    { name: "Vietnamese", emoji: "🇻🇳" },
    { name: "Seafood", emoji: "🦐" },
    { name: "Street Food", emoji: "🍢" },
    { name: "International", emoji: "🌍" },
    { name: "Vegetarian", emoji: "🥬" },
    { name: "Dessert", emoji: "🍰" },
  ];

  const togglePreference = (cuisine) => {
    setPreferences((prev) =>
      prev.includes(cuisine)
        ? prev.filter((p) => p !== cuisine)
        : [...prev, cuisine]
    );
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Cuisine Preferences
      </label>
      <div className="flex flex-wrap gap-2">
        {cuisines.map((cuisine) => (
          <button
            key={cuisine.name}
            onClick={() => togglePreference(cuisine.name)}
            className={`px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              preferences.includes(cuisine.name)
                ? "bg-blue-100 text-blue-800 ring-2 ring-blue-300"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <span>{cuisine.emoji}</span>
            {cuisine.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CuisineSelector;
