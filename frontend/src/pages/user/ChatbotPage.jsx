import React from "react";
import ChatbotWidget from "../../components/ChatbotWidget";

const ChatbotPage = () => {
  return (
    <div
      style={{
        backgroundColor: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh", // 👈 cho full màn hình
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* 🟢 Floating Chatbot Widget */}
      <div
        style={{
          position: "fixed",
          top: "50%",                     
          right: "20px",                  
          transform: "translateY(-50%)",  
          width: "400px",
          height: "500px",
          backgroundColor: "white",
          borderRadius: "10px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
          overflow: "hidden",
          zIndex: 1000,
        }}
      >
        <ChatbotWidget />
      </div>
    </div>
  );
};

export default ChatbotPage;
