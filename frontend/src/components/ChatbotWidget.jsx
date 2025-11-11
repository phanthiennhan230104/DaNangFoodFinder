import React, { useState, useRef, useEffect } from "react";
import { FaComments, FaTimes, FaMicrophone, FaMicrophoneSlash, FaMapMarkerAlt, FaPhone, FaStar, FaUtensils } from "react-icons/fa";
import axios from "axios";

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: "Xin chào! Tôi có thể giúp bạn tìm món ăn và quán ăn." },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const messagesEndRef = useRef(null);

  const RAG_API_URL = "http://localhost:8000/api/chatbot/rag-local/";
  const FALLBACK_SEARCH_URL = "http://localhost:8000/api/chatbot/search/";
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { from: "user", text: trimmed }]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await (async () => {
        try {
          return await axios.post(
            RAG_API_URL,
            { query: trimmed },
            { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
          );
        } catch (err) {
          return await axios.post(
            FALLBACK_SEARCH_URL,
            { query: trimmed },
            { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
          );
        }
      })();

      const { answer, results } = response.data || { answer: "", results: [] };
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: answer || "Xin lỗi, không tìm thấy kết quả.", results: results || [] }
      ]);
    } catch (error) {
      const errorMessage = error?.code === 'ECONNABORTED'
        ? "⏱️ Kết nối bị timeout. Vui lòng thử lại."
        : error?.response
          ? `⚠️ Lỗi: ${error.response.status}. Vui lòng thử lại.`
          : "🔌 Không thể kết nối đến server. Vui lòng kiểm tra server và CORS.";

      setMessages((prev) => [
        ...prev,
        { from: "bot", text: errorMessage }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("⚠️ Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói (thử Chrome).");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.start();
    setListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      sendMessage(transcript);
      setListening(false);
    };

    recognition.onerror = () => setListening(false);

    recognition.onend = () => setListening(false);
  };

  const RestaurantCard = ({ restaurant }) => {
    return (
      <div style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "12px",
        marginTop: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.15)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onClick={() => setSelectedRestaurant(restaurant)}
      >
        <div style={{ display: "flex", gap: "12px" }}>
          {restaurant.image ? (
            <img 
              src={restaurant.image} 
              alt={restaurant.name}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "8px",
                objectFit: "cover"
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "8px",
              backgroundColor: "#f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <FaUtensils size={24} color="#9ca3af" />
            </div>
          )}
          
          <div style={{ flex: 1 }}>
            <h4 style={{ 
              margin: "0 0 4px 0", 
              color: "#1f2937", 
              fontSize: "15px", 
              fontWeight: "600",
              lineHeight: "1.3"
            }}>
              {restaurant.name}
            </h4>
            
            <p style={{ 
              margin: "2px 0", 
              color: "#6b7280", 
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              <FaUtensils size={10} />
              {restaurant.cuisine_type}
            </p>
            
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              marginTop: "4px",
              flexWrap: "wrap"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <FaStar color="#fbbf24" size={12} />
                <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "500" }}>
                  {restaurant.rating ? restaurant.rating.toFixed(1) : "N/A"}
                </span>
              </div>
              
              <span style={{ 
                fontSize: "12px", 
                color: "#ef4444", 
                fontWeight: "600",
                backgroundColor: "#fee2e2",
                padding: "2px 8px",
                borderRadius: "4px"
              }}>
                {restaurant.price_range}
              </span>
            </div>
          </div>
        </div>
        
        {restaurant.address && (
          <p style={{ 
            margin: "8px 0 0 0", 
            fontSize: "11px", 
            color: "#6b7280",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "8px",
            display: "flex",
            alignItems: "flex-start",
            gap: "4px",
            lineHeight: "1.4"
          }}>
            <FaMapMarkerAlt size={10} style={{ marginTop: "2px", flexShrink: 0 }} />
            <span>{restaurant.address}</span>
          </p>
        )}
        
        {restaurant.phone && (
          <p style={{ 
            margin: "4px 0 0 0", 
            fontSize: "11px", 
            color: "#6b7280",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}>
            <FaPhone size={10} />
            {restaurant.phone}
          </p>
        )}
        
        {restaurant.description && restaurant.description.length > 0 && (
          <p style={{
            margin: "6px 0 0 0",
            fontSize: "11px",
            color: "#6b7280",
            fontStyle: "italic",
            lineHeight: "1.4"
          }}>
            {restaurant.description.length > 100 
              ? restaurant.description.substring(0, 100) + "..." 
              : restaurant.description}
          </p>
        )}
      </div>
    );
  };

  const RestaurantModal = ({ restaurant, onClose }) => {
    if (!restaurant) return null;
    return (
      <div style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }} onClick={onClose}>
        <div style={{
          width: '480px',
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{restaurant.name}</h3>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
          <p style={{ color: '#6b7280' }}>{restaurant.cuisine_type} • {restaurant.price_range}</p>
          {restaurant.image && <img src={restaurant.image} alt={restaurant.name} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: 8 }} />}
          <p style={{ marginTop: 10 }}>{restaurant.description || ''}</p>
          <p style={{ color: '#6b7280' }}><FaMapMarkerAlt /> {restaurant.address}</p>
          {restaurant.phone && <p style={{ color: '#6b7280' }}><FaPhone /> {restaurant.phone}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <a href={`/nearby?query=${encodeURIComponent(restaurant.name)}`} style={{ textDecoration: 'none' }}>
              <button style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Xem trên bản đồ</button>
            </a>
            <button style={{ padding: '8px 12px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: 6, cursor: 'pointer' }} onClick={onClose}>Đóng</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
        fontFamily: "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      
      {isOpen && (
        <div
          style={{
            width: "380px",
            height: "600px",
            backgroundColor: "#fff",
            borderRadius: "16px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            marginBottom: "10px",
          }}
        >
          
          <div
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#fff",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontWeight: "bold", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaUtensils size={18} />
                DNFF Assistant
              </div>
              <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>
                🍜 Tìm món ăn & quán ăn Đà Nẵng
              </div>
            </div>
            <FaTimes 
              onClick={() => setIsOpen(false)} 
              style={{ cursor: "pointer", fontSize: "18px" }}
              title="Đóng"
            />
          </div>

          
          <div
            style={{
              flex: 1,
              padding: "12px",
              backgroundColor: "#f9fafb",
              overflowY: "auto",
            }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  textAlign: msg.from === "user" ? "right" : "left",
                  margin: "10px 0",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    backgroundColor: msg.from === "user" ? "#2563eb" : "#fff",
                    color: msg.from === "user" ? "#fff" : "#1f2937",
                    padding: "10px 14px",
                    borderRadius: msg.from === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    maxWidth: "85%",
                    wordWrap: "break-word",
                    boxShadow: msg.from === "user" ? "none" : "0 2px 4px rgba(0,0,0,0.1)",
                    fontSize: "14px",
                    lineHeight: "1.5",
                    textAlign: "left",
                    whiteSpace: "pre-line"
                  }}
                >
                  {msg.text}
                  {msg.results && msg.results.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      {msg.results.map((result, idx) => (
                        <RestaurantCard key={idx} restaurant={result} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {selectedRestaurant && (
              <RestaurantModal restaurant={selectedRestaurant} onClose={() => setSelectedRestaurant(null)} />
            )}
            
            
            {isLoading && (
              <div style={{ textAlign: "left", margin: "10px 0" }}>
                <div style={{
                  display: "inline-block",
                  backgroundColor: "#fff",
                  padding: "10px 14px",
                  borderRadius: "18px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div className="loading-dots" style={{ 
                      display: "flex", 
                      gap: "4px" 
                    }}>
                      <span style={{ 
                        width: "8px", 
                        height: "8px", 
                        backgroundColor: "#2563eb", 
                        borderRadius: "50%",
                        animation: "bounce 1.4s infinite ease-in-out both",
                        animationDelay: "-0.32s"
                      }}></span>
                      <span style={{ 
                        width: "8px", 
                        height: "8px", 
                        backgroundColor: "#2563eb", 
                        borderRadius: "50%",
                        animation: "bounce 1.4s infinite ease-in-out both",
                        animationDelay: "-0.16s"
                      }}></span>
                      <span style={{ 
                        width: "8px", 
                        height: "8px", 
                        backgroundColor: "#2563eb", 
                        borderRadius: "50%",
                        animation: "bounce 1.4s infinite ease-in-out both"
                      }}></span>
                    </div>
                    <span style={{ fontSize: "14px", color: "#6b7280" }}>Đang tìm kiếm...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div
            style={{
              display: "flex",
              borderTop: "1px solid #e5e7eb",
              padding: "12px",
              background: "#fff",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <button
              onClick={startListening}
              disabled={listening || isLoading}
              title={listening ? "Đang nghe..." : "Nói"}
              style={{
                backgroundColor: listening ? "#fbbf24" : "#f3f4f6",
                border: "none",
                borderRadius: "10px",
                width: "42px",
                height: "42px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: listening || isLoading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {listening ? (
                <FaMicrophoneSlash size={18} color="#dc2626" />
              ) : (
                <FaMicrophone size={18} color="#6b7280" />
              )}
            </button>

            
            <input
              type="text"
              placeholder="VD: phở bò, quán Hàn Quốc..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "10px",
                outline: "none",
                fontSize: "14px",
                backgroundColor: isLoading ? "#f3f4f6" : "#fff"
              }}
            />

            
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              style={{
                backgroundColor: isLoading || !input.trim() ? "#9ca3af" : "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "10px 16px",
                cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "all 0.2s"
              }}
            >
              Gửi
            </button>
          </div>
        </div>
      )}

      
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: "64px",
            height: "64px",
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(37, 99, 235, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 8px 25px rgba(37, 99, 235, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.4)";
          }}
        >
          <FaComments size={28} />
        </button>
      )}
      
      
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { 
            transform: scale(0);
          } 
          40% { 
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default ChatbotWidget;