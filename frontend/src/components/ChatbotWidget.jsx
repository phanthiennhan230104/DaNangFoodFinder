import React, { useState } from "react";
import { FaComments, FaTimes } from "react-icons/fa";

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello 👋! How can I help you today?" },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
  if (input.trim() === "") return;

  // Add user's message
  setMessages([...messages, { from: "user", text: input }]);
  const userText = input.toLowerCase();
  setInput("");

  // Default bot reply
  let botReply = "Sorry, I didn’t quite understand that 😅";

  // --- simple rule-based chatbot ---
  if (userText.includes("seafood")) {
    botReply = "Suggestion: Uyen Chi Seafood Restaurant – 25 Nguyen Van Linh, Da Nang 🦞";
  } else if (userText.includes("coffee")) {
    botReply = "You can try 1990 Coffee at 10 Bach Dang ☕";
  } else if (userText.includes("bun cha")) {
    botReply = "Try Hanoi Bun Cha – 15 Le Duan 🍜";
  }

  // Send bot reply after delay
  setTimeout(() => {
    setMessages((prev) => [
      ...prev,
      { from: "bot", text: botReply },
    ]);
  }, 600);
};


  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        right: "20px",
        transform: "translateY(-50%)",

        zIndex: 9999,
        fontFamily: "Poppins, sans-serif",
      }}
    >
      {/* Chatbox */}
      {isOpen && (
        <div
          style={{
            width: "320px",
            height: "420px",
            backgroundColor: "#fff",
            borderRadius: "16px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: "#2563eb",
              color: "#fff",
              padding: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontWeight: "bold" }}>Chatbot Assistant</span>
            <FaTimes
              onClick={() => setIsOpen(false)}
              style={{ cursor: "pointer" }}
            />
          </div>

          {/* Messages area */}
          <div
            style={{
              flex: 1,
              padding: "10px",
              backgroundColor: "#f9fafb",
              overflowY: "auto",
            }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  textAlign: msg.from === "user" ? "right" : "left",
                  margin: "8px 0",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor:
                      msg.from === "user" ? "#2563eb" : "#e5e7eb",
                    color: msg.from === "user" ? "#fff" : "#000",
                    padding: "8px 12px",
                    borderRadius: "18px",
                    maxWidth: "80%",
                    wordWrap: "break-word",
                  }}
                >
                  {msg.text}
                </span>
              </div>
            ))}
          </div>

          {/* Input */}
          <div
            style={{
              display: "flex",
              borderTop: "1px solid #ddd",
              padding: "10px",
              background: "#fff",
            }}
          >
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              style={{
                flex: 1,
                padding: "8px 10px",
                border: "1px solid #ccc",
                borderRadius: "8px",
                outline: "none",
                fontSize: "14px",
              }}
            />
            <button
              onClick={handleSend}
              style={{
                backgroundColor: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 12px",
                marginLeft: "8px",
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            backgroundColor: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: "60px",
            height: "60px",
            cursor: "pointer",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
          }}
        >
          <FaComments size={26} />
        </button>
      )}
    </div>
  );
};

export default ChatbotWidget;
