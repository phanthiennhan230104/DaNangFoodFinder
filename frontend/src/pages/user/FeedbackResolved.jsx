// src/pages/admin/FeedbackResolved.jsx
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import api from "../../api";

export default function FeedbackResolved() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const res = await api.get("/feedback-list/?is_resolved=true");
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
          📝 Resolved Feedbacks
        </h1>
        <p style={{ textAlign: "center", color: "#555", marginBottom: "30px" }}>
          List of feedbacks that have been responded.
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
              <th style={{ ...thStyle, width: "15%" }}>Type</th>
              <th style={{ ...thStyle, width: "20%" }}>Subject</th>
              <th style={{ ...thStyle, width: "25%" }}>Message</th>
              <th style={{ ...thStyle, width: "25%" }}>Response</th>
              <th style={{ ...thStyle, width: "15%" }}>Created At</th>
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
                <td
                  style={{
                    ...tdStyle,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {fb.message_response}
                </td>
                <td style={tdStyle}>
                  {new Date(fb.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {feedbacks.length === 0 && (
          <h1
            style={{
              fontSize: "16px",
              fontWeight: "initial",
              textAlign: "center",
              paddingTop: "10px",
            }}
          >
            No resolved feedbacks
          </h1>
        )}
      </div>
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
