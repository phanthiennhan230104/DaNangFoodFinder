// src/pages/user/Profile.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import api from "../../api";
import "../../styles/user/Profile.css";

export default function Profile() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    dob: "",
    gender: "",
    phone: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load profile hiện tại
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/profile/");
        console.log("✅ Profile loaded:", res.data);
        
        setFormData({
          fullName: res.data.fullName || "",
          dob: res.data.dob || "",
          gender: res.data.gender || "",
          phone: res.data.phone || "",
          address: res.data.address || "",
        });
      } catch (err) {
        console.error("❌ Failed to load profile:", err);
        console.error("Error response:", err.response?.data);
        setError(`Load error: ${err.response?.data?.detail || err.message}`);
      }
    };
    fetchProfile();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("📤 Sending profile data:", formData);

      // Validate dữ liệu trước khi gửi
      if (!formData.fullName.trim()) {
        throw new Error("Full Name is required");
      }
      if (!formData.dob) {
        throw new Error("Date of Birth is required");
      }
      if (!formData.gender) {
        throw new Error("Gender is required");
      }

      const response = await api.post("/profile/", formData);
      
      console.log("✅ Profile saved:", response.data);
      alert(response.data.message || "Profile saved successfully!");
      navigate("/home");
    } catch (error) {
      console.error("❌ Error saving profile:", error);
      console.error("Error response:", error.response?.data);
      
      // Hiển thị lỗi chi tiết
      let errorMessage = "Failed to save profile. ";
      
      if (error.response?.data) {
        const errData = error.response.data;
        
        // Nếu có lỗi validation từng field
        if (typeof errData === 'object' && !errData.message) {
          errorMessage += "\n";
          Object.keys(errData).forEach(key => {
            errorMessage += `\n• ${key}: ${errData[key]}`;
          });
        } else {
          errorMessage += errData.message || errData.detail || JSON.stringify(errData);
        }
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => navigate(-1);

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <h1>Profile</h1>
          <p>Enter information to update your profile</p>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            color: '#c33',
            fontSize: '14px',
            whiteSpace: 'pre-line'
          }}>
            <strong>⚠️ Error:</strong>
            <pre style={{ marginTop: '8px', fontSize: '12px' }}>{error}</pre>
          </div>
        )}

        {/* Form Fields */}
        <div className="profile-field">
          <label className="profile-label">Full Name </label>
          <input
            className="profile-input"
            type="text"
            placeholder="Enter full name..."
            value={formData.fullName}
            onChange={(e) => handleInputChange("fullName", e.target.value)}
            required
          />
        </div>

        <div className="profile-field">
          <label className="profile-label">Date of Birth </label>
          <input
            className="profile-input"
            type="date"
            value={formData.dob}
            onChange={(e) => handleInputChange("dob", e.target.value)}
            required
          />
        </div>

        <div className="profile-field">
          <label className="profile-label">Gender </label>
          <select
            className="profile-input"
            value={formData.gender}
            onChange={(e) => handleInputChange("gender", e.target.value)}
            required
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="profile-field">
          <label className="profile-label">Phone</label>
          <input
            className="profile-input"
            type="tel"
            placeholder="Enter phone number..."
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
          />
        </div>

        <div className="profile-field">
          <label className="profile-label">Address</label>
          <input
            className="profile-input"
            type="text"
            placeholder="Enter address..."
            value={formData.address}
            onChange={(e) => handleInputChange("address", e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="profile-buttons">
          <button className="btn-back" onClick={handleBack} disabled={loading}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button className="btn-save" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}