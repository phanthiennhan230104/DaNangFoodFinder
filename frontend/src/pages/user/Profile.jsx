// src/pages/user/Profile.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import api from "../../api";
import "../../styles/user/Profile.css";

export default function Profile() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullname: "",
    dob: "",
    gender: "",
    phone_number: "",
    address: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // LOAD PROFILE
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/profile/");
        console.log("✅ Profile loaded:", res.data);

        setFormData({
          fullname: res.data.fullname || "",
          dob: res.data.dob || "",
          gender: res.data.gender || "",
          phone_number: res.data.phone_number || "",
          address: res.data.address || "",
        });
      } catch (err) {
        console.error("❌ Failed to load profile:", err);
        setError("Failed to load profile.");
      }
    };
    fetchProfile();
  }, []);

  // HANDLE INPUT CHANGE
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // SAVE PROFILE
  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("📤 Sending:", formData);

      if (!formData.fullname.trim())
        return alert("Full name is required");
      if (!formData.dob)
        return alert("Date of Birth is required");
      if (!formData.gender)
        return alert("Gender is required");

      const response = await api.post("/profile/", formData);
      console.log("✅ Saved:", response.data);

      alert("Profile saved successfully!");
      navigate("/home");

    } catch (error) {
      console.error("❌ Error saving profile:", error);
      
      let msg = "Save failed.\n";
      if (error.response?.data) {
        Object.entries(error.response.data).forEach(([k, v]) => {
          msg += `• ${k}: ${v}\n`;
        });
      }
      alert(msg);
      setError(msg);

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <h1>Profile</h1>
          <p>Update your personal information</p>
        </div>

        {error && (
          <div className="error-box">{error}</div>
        )}

        {/* FULL NAME */}
        <div className="profile-field">
          <label className="profile-label">Full Name</label>
          <input
            className="profile-input"
            type="text"
            value={formData.fullname}
            onChange={(e) => handleInputChange("fullname", e.target.value)}
          />
        </div>

        {/* DOB */}
        <div className="profile-field">
          <label className="profile-label">Date of Birth</label>
          <input
            className="profile-input"
            type="date"
            value={formData.dob}
            onChange={(e) => handleInputChange("dob", e.target.value)}
          />
        </div>

        {/* GENDER */}
        <div className="profile-field">
          <label className="profile-label">Gender</label>
          <select
            className="profile-input"
            value={formData.gender}
            onChange={(e) => handleInputChange("gender", e.target.value)}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* PHONE */}
        <div className="profile-field">
          <label className="profile-label">Phone</label>
          <input
            className="profile-input"
            type="tel"
            value={formData.phone_number}
            onChange={(e) => handleInputChange("phone_number", e.target.value)}
          />
        </div>

        {/* ADDRESS */}
        <div className="profile-field">
          <label className="profile-label">Address</label>
          <input
            className="profile-input"
            type="text"
            value={formData.address}
            onChange={(e) => handleInputChange("address", e.target.value)}
          />
        </div>

        {/* BUTTONS */}
        <div className="profile-buttons">
          <button className="btn-back" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button className="btn-save" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : <>
              <Save className="w-4 h-4" /> Save Changes
            </>}
          </button>
        </div>
      </div>
    </div>
  );
}
