export function Button({ children, onClick, className, variant }) {
  const base =
    "px-4 py-2 rounded-lg font-semibold transition duration-200 ease-in-out";
  const styles =
    variant === "outline"
      ? "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
      : "bg-yellow-500 text-white hover:bg-yellow-600";

  return (
    <button onClick={onClick} className={`${base} ${styles} ${className || ""}`}>
      {children}
    </button>
  );
}
