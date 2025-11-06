export function Input(props) {
  return (
    <input
      {...props}
      className={`border border-gray-300 rounded-lg p-2 w-full focus:ring-2 focus:ring-yellow-400 focus:outline-none ${props.className || ""}`}
    />
  );
}
