import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/admin/RoleManagement.css";

function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const navigate = useNavigate();

  const fetchRoles = useCallback(async () => {
    try {
      const token = localStorage.getItem("access");
      const res = await fetch("http://localhost:8000/api/admin/roles/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRoles(data.results || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleAdd = () => navigate("/admin/roles/add");
  const handleBack = () => navigate("/admin/home");
  const handleEdit = (roleId) => {
    if (!roleId) return alert("Please select a role");
    navigate(`/admin/roles/edit/${roleId}`);
  };

  const handleDelete = async (roleId) => {
    if (!roleId) return alert("Please select a role");
    if (!window.confirm("Are you sure you want to delete this role?")) return;

    const token = localStorage.getItem("access");
    const res = await fetch(
      `http://localhost:8000/api/admin/roles/${roleId}/delete/`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.ok) {
      alert("Role deleted successfully!");
      fetchRoles();
    } else {
      alert("Failed to delete role");
    }
  };

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="account-page">
      <div className="account-card">
        {/* Header */}
       

        {/* Search */}
        <div className="search-bar">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Enter role name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="search-btn">🔍 Search</button>
        </div>

        {/* Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Role Name</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.length > 0 ? (
                filteredRoles.map((role) => (
                  <tr
                    key={role.role_id}
                    className={
                      selectedRoleId === role.role_id ? "selected-row" : ""
                    }
                    onClick={() => setSelectedRoleId(role.role_id)}
                  >
                    <td>#{role.role_id}</td>
                    <td>{role.name}</td>
                    <td>{role.description || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3">
                    <div className="empty-state">
                      <h3>No roles found</h3>
                      <p>Please add a new role!</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        <div className="action-buttons">
          <button className="btn btn-add" onClick={handleAdd}>
            ➕ Add New
          </button>
          <button
            className="btn btn-edit"
            onClick={() => handleEdit(selectedRoleId)}
          >
            ✏️ Edit
          </button>
          <button
            className="btn btn-delete"
            onClick={() => handleDelete(selectedRoleId)}
          >
            🗑️ Delete
          </button>
          <button className="btn btn-back" onClick={handleBack}>
            ⬅️ Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoleManagement;
