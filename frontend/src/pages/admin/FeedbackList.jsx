// src/pages/admin/FeedbackManagement.jsx
import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle } from "lucide-react";
import api from "../../api";

export default function FeedbackManagement() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [replyText, setReplyText] = useState("");

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const res = await api.get("/feedback-list/?is_resolved=false");
      setFeedbacks(res.data);
    } catch (error) {
      console.error("Failed to fetch feedbacks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleMarkAsDone = async () => {
    if (!replyText.trim()) {
      alert("Please enter a reply before marking as done.");
      return;
    }

    try {
      await api.patch(`/admin/feedback/${selectedFeedback.id}/update/`, {
        is_resolved: true,
        message_response: replyText,
      });
      alert("Feedback marked as resolved!");
      setSelectedFeedback(null);
      setReplyText("");
      fetchFeedbacks();
    } catch (error) {
      console.error("Error updating feedback:", error);
      alert("Failed to update feedback.");
    }
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        minHeight: "100vh",
        padding: "90px 50px",
      }}
    >
      <div
        style={{
          maxWidth: "",
          margin: "0 auto",
          backgroundColor: "#fff",
          paddingBottom: "40px",
          paddingTop: "40px",
          borderRadius: "12px",
        }}
      >
        <h1
          style={{
            fontSize: "36px",
            fontWeight: "bold",
            color: "#e63946",
            textAlign: "center",
            marginBottom: "10px",
          }}
        >
          📝 Feedback Management
        </h1>
        <p style={{ textAlign: "center", color: "#555", marginBottom: "30px" }}>
          List of user feedbacks that haven’t been resolved yet.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={fetchFeedbacks}
            disabled={loading}
            style={{
              backgroundColor: "#00bfa6",
              color: "white",
              padding: "10px 20px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#fff3cd", textAlign: "left" }}>
              <th style={{ ...thStyle, width: "10%" }}>Type</th>
              <th style={{ ...thStyle, width: "15%" }}>Subject</th>
              <th style={{ ...thStyle, width: "40%" }}>Message</th>{" "}
              {/* 👈 rộng nhất */}
              <th style={{ ...thStyle, width: "20%" }}>Contact Email</th>
              <th style={{ ...thStyle, width: "15%" }}>Created At</th>
              <th style={{ ...thStyle, width: "10%" }}>Actions</th>
            </tr>
          </thead>
          
          <tbody>
            
            {feedbacks.map((fb) => (
              <tr key={fb.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={tdStyle}>{fb.feedback_type}</td>
                <td style={tdStyle}>{fb.subject}</td>
                <td
                  style={{
                    ...tdStyle,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {fb.message}
                </td>
                <td style={tdStyle}>{fb.contact_email}</td>
                <td style={tdStyle}>
                  {new Date(fb.created_at).toLocaleString()}
                </td>
                <td style={tdStyle}>
                  <button
                    onClick={() => setSelectedFeedback(fb)}
                    style={{
                      backgroundColor: "#38b000",
                      color: "white",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <CheckCircle size={16} /> Mark as Done
                  </button>
                </td>
              </tr>
              
            ))}
          </tbody>
        </table>
        {feedbacks.length === 0 && <h1 style={{fontSize:"16px", fontWeight:"initial", textAlign:"center", paddingTop:"10px"}}>No data</h1>}
      </div>

      {/* Popup modal */}
      {selectedFeedback && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "30px",
              borderRadius: "12px",
              width: "500px",
              maxWidth: "90%",
            }}
          >
            <h3 style={{ marginBottom: "10px", fontWeight: "bold" }}>
              Reply to: {selectedFeedback.subject}
            </h3>
            <textarea
              placeholder="Enter your reply message..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              style={{
                width: "100%",
                minHeight: "120px",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                resize: "vertical",
                marginBottom: "20px",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                onClick={() => setSelectedFeedback(null)}
                style={{
                  backgroundColor: "#ccc",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsDone}
                style={{
                  backgroundColor: "#28a745",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: "12px 10px",
  fontWeight: "bold",
  textTransform: "capitalize",
  borderBottom: "2px solid #ddd",
};

const tdStyle = {
  padding: "12px 10px",
  verticalAlign: "top",
};
