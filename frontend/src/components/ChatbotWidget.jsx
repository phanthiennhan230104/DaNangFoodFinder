import React, { useState } from "react";
import { FaComments, FaTimes, FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello 👋! How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);

  // Gửi tin nhắn của người dùng
  const sendMessage = async (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { from: "user", text: trimmed }]);
    setInput("");

    // Trả lời mặc định (có thể đổi bằng API gọi backend)
    const botReply = `🔎 Looking for a dish or restaurant that matches your request: "${trimmed}"...`;

    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text: botReply }]);
    }, 500);

    // TODO: Gọi API tìm kiếm thực tế ở đây
    // Ví dụ:
    // const res = await api.post("/chatbot/search", { query: trimmed });
    // setMessages((prev) => [...prev, { from: "bot", text: res.data.answer }]);
  };

  const handleSend = () => sendMessage(input);

  // === Nhận giọng nói (Web Speech API) ===
  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("❌ Your browser does not support speech recognition yet (try Chrome).");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    try {
      recognition.start();
      setListening(true);
    } catch (e) {
      console.warn("Recognition start error:", e);
      setListening(false);
      return;
    }

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      sendMessage(transcript);
      setListening(false);
    };

    recognition.onerror = (err) => {
      console.warn("Speech recognition error:", err);
      setListening(false);
    };

    recognition.onend = () => setListening(false);
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
            height: "460px",
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
            <span style={{ fontWeight: "bold" }}>DNFF Assistant</span>
            <FaTimes onClick={() => setIsOpen(false)} style={{ cursor: "pointer" }} />
          </div>

          {/* Messages */}
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
                    backgroundColor: msg.from === "user" ? "#2563eb" : "#e5e7eb",
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

          {/* Input + Voice + Send */}
          <div
            style={{
              display: "flex",
              borderTop: "1px solid #ddd",
              padding: "10px",
              background: "#fff",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {/* Nút Voice */}
            <button
              onClick={startListening}
              disabled={listening}
              title={listening ? "Đang nghe..." : "Nói"}
              style={{
                backgroundColor: listening ? "#facc15" : "#f3f4f6",
                border: "none",
                borderRadius: "8px",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: listening ? "not-allowed" : "pointer",
              }}
            >
              {listening ? <FaMicrophoneSlash size={16} /> : <FaMicrophone size={16} />}
            </button>

            {/* Ô nhập */}
            <input
              type="text"
              placeholder="Nhập hoặc nói món ăn..."
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

            {/* Gửi */}
            <button
              onClick={handleSend}
              style={{
                backgroundColor: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Gửi
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
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
