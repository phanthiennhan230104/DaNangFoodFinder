import { useEffect, useState } from "react";
import { FaArrowLeft, FaSave, FaTags } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import "../../styles/admin/EditRole.css";

function EditRole() {
  const navigate = useNavigate();
  const { roleId } = useParams();

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("access");
      if (!token) return;

      try {
        const res = await fetch(
          `http://localhost:8000/api/admin/roles/${roleId}/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setForm({
            name: data.name ?? "",
            description: data.description ?? "",
          });
        }
      } catch (err) {
        console.error("fetch role error:", err);
      }
    })();
  }, [roleId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const token = localStorage.getItem("access");
    if (!token) return alert("You are not logged in!");

    if (!form.name || !form.description) {
      return alert("Please fill in all fields.");
    }

    try {
      const res = await fetch(
        `http://localhost:8000/api/admin/roles/${roleId}/update/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        }
      );

      if (res.ok) {
        alert("Role updated successfully!");
        navigate("/admin/roles");
      } else {
        const data = await res.json().catch(() => null);
        alert("Could not update role: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error("update role error:", err);
      alert("Error while saving data.");
    }
  };

  return (
    <div className="edit-role-page">
      <div className="edit-role-card">
        <h2>
          <FaTags /> Edit Role
        </h2>
        <p className="edit-role-subtitle">Update role information</p>

        <div className="form-group">
          <label>Role Name</label>
          <input
            type="text"
            name="name"
            placeholder="Enter role name..."
            value={form.name}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            placeholder="Enter description..."
            value={form.description}
            onChange={handleChange}
          />
        </div>

        <div className="role-actions">
          <button
            className="btn btn-back"
            onClick={() => navigate("/admin/roles")}
          >
            <FaArrowLeft /> Back
          </button>
          <button className="btn btn-save" onClick={handleSave}>
            <FaSave /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditRole;
