// src/pages/user/Feedback.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import api from "../../api";
import "../../styles/user/Profile.css"; // Giữ nguyên style, dùng lại cho form Feedback

export default function Feedback() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    feedback_type: "",
    subject: "",
    message: "",
    contact_email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate cơ bản
      if (!formData.feedback_type)
        throw new Error("Feedback type is required.");
      if (!formData.message.trim()) throw new Error("Message cannot be empty.");

      console.log("📤 Sending feedback:", formData);
      const res = await api.post("/feedback/", formData);

      console.log("✅ Feedback sent:", res.data);
      alert("Feedback submitted successfully!");
      navigate("/home");
    } catch (err) {
      console.error("❌ Failed to send feedback:", err);
      console.error("Error response:", err.response?.data);
      let msg = "Failed to send feedback. ";
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === "object" && !data.message) {
          msg += "\n";
          Object.keys(data).forEach((k) => {
            msg += `\n• ${k}: ${data[k]}`;
          });
        } else {
          msg += data.message || data.detail || JSON.stringify(data);
        }
      } else msg += err.message;
      setError(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => navigate(-1);

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <h1>Send Feedback</h1>
          <p>We’d love to hear your feedback or report issues you found.</p>
        </div>

        {/* Error display */}
        {error && (
          <div
            style={{
              padding: "12px",
              marginBottom: "16px",
              backgroundColor: "#fee",
              border: "1px solid #fcc",
              borderRadius: "8px",
              color: "#c33",
              fontSize: "14px",
              whiteSpace: "pre-line",
            }}
          >
            <strong>⚠️ Error:</strong>
            <pre style={{ marginTop: "8px", fontSize: "12px" }}>
              "Some thing is wrong! Please retry
            </pre>
          </div>
        )}

        {/* Feedback Type */}
        <div className="profile-field">
          <label className="profile-label">Feedback Type</label>
          <select
            className="profile-input"
            value={formData.feedback_type}
            onChange={(e) => handleInputChange("feedback_type", e.target.value)}
            required
          >
            <option value="">Select type</option>
            <option value="Report">Report Issue / Error</option>
            <option value="Suggestion">Feature Suggestion</option>
            <option value="General">General Feedback</option>
          </select>
        </div>

        {/* Subject */}
        <div className="profile-field">
          <label className="profile-label">Subject</label>
          <input
            className="profile-input"
            type="text"
            placeholder="Enter subject..."
            value={formData.subject}
            onChange={(e) => handleInputChange("subject", e.target.value)}
          />
        </div>

        {/* Message */}
        <div className="profile-field">
          <label className="profile-label">Message</label>
          <textarea
            className="profile-input"
            rows={5}
            placeholder="Describe your feedback or issue..."
            value={formData.message}
            onChange={(e) => handleInputChange("message", e.target.value)}
            required
          />
        </div>

        {/* Contact Email */}
        <div className="profile-field">
          <label className="profile-label">Contact Email</label>
          <input
            className="profile-input"
            type="email"
            placeholder="Enter email (optional)..."
            value={formData.contact_email}
            onChange={(e) => handleInputChange("contact_email", e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <Link className="btn-save" to={"/feedback-resolved"} style={{height:"44.6px", marginTop:"32px"}} >Feedback Resolved</Link>
          <div className="profile-buttons">
            <button
              className="btn-back"
              onClick={handleBack}
              disabled={loading}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              className="btn-save"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                "Sending..."
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Feedback
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
