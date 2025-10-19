import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/admin/AddRole.css";

function AddRole() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBack = () => {
    navigate("/admin/roles");
  };

  const handleSave = async () => {
    if (!form.name || !form.description) {
      return alert("Please fill in all required fields");
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch("http://localhost:8000/api/admin/roles/create/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
        }),
      });

      if (res.ok) {
        alert("Role added successfully!");
        navigate("/admin/roles");
      } else {
        const data = await res.json();
        alert("Failed to add role: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
      alert("Error while adding role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-role">
      <div className="add-role-card">
        <h2 className="add-role-title">➕ Add New Role</h2>
        <p className="add-role-subtitle">Enter role details below</p>

        <div className="add-role-group">
          <label>Role Name</label>
          <input
            type="text"
            name="name"
            placeholder="Enter role name..."
            value={form.name}
            onChange={handleChange}
          />
        </div>

        <div className="add-role-group">
          <label>Description</label>
          <textarea
            name="description"
            placeholder="Enter description..."
            value={form.description}
            onChange={handleChange}
          />
        </div>

        <div className="add-role-actions">
          <button
            className="add-role-btn add-role-btn-back"
            onClick={handleBack}
          >
            ⬅️ Back
          </button>
          <button
            className="add-role-btn add-role-btn-add"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : "💾 Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddRole;
