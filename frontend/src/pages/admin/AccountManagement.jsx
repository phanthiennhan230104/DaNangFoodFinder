import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/admin/AccountManagement.css";

function AccountManagement() {
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const navigate = useNavigate();

  const fetchAccounts = useCallback(async () => {
    try {
      const token = localStorage.getItem("access");
      const res = await fetch("http://localhost:8000/api/admin/users/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAccounts(data.results || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAdd = () => navigate("/admin/accounts/add");
  const handleBack = () => navigate("/admin/home");
  const handleEdit = (userId) => {
    if (!userId) return alert("Please select an account");
    navigate(`/admin/accounts/edit/${userId}`);
  };

  const handleDelete = async (userId) => {
    if (!userId) return alert("Please select an account");
    if (!window.confirm("Are you sure you want to delete this account?"))
      return;

    const token = localStorage.getItem("access");
    const res = await fetch(
      `http://localhost:8000/api/admin/users/${userId}/delete/`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.ok) {
      alert("Deleted successfully!");
      fetchAccounts();
    } else {
      alert("Failed to delete account");
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    const matchSearch =
      acc.username?.toLowerCase().includes(search?.toLowerCase()) ||
      acc.email?.toLowerCase().includes(search?.toLowerCase());

    const matchRole =
      filterRole === "all" ||
      (filterRole === "admin" && acc.role_id == 1) ||
      (filterRole === "user" && acc.role_id != 1);

    return matchSearch && matchRole;
  });

  return (
    <div className="account-page">
      <div className="account-card">
        {/* Header */}
       

        {/* Search tools */}
        <div className="search-bar">
          <label>Role:</label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>

          <label>Search:</label>
          <input
            type="text"
            placeholder="Enter name, email or username..."
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
                {/* <th>Username</th> */}
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length > 0 ? (
                filteredAccounts?.map((acc) => (
                  <tr
                    key={acc.user_id}
                    className={
                      selectedUserId === acc.user_id ? "selected-row" : ""
                    }
                    onClick={() => setSelectedUserId(acc.user_id)}
                  >
                    <td>#{acc.user_id}</td>
                    {/* <td>{acc.username}</td> */}
                    <td>{acc.email}</td>
                    <td>{acc.role_id == 1 ? "Admin" : "User"}</td>
                    <td>
                      <span
                        className={
                          acc.is_email_verified
                            ? "status-verified"
                            : "status-pending"
                        }
                      >
                        {acc.is_email_verified
                          ? "✔ Verified"
                          : "✘ Not Verified"}
                      </span>
                    </td>
                    <td>{acc?.last_login? new Date(acc.last_login).toLocaleDateString("vi-VN") : "Never logged in"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <h3>No accounts found</h3>
                      <p>Please add a new account!</p>
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
            onClick={() => handleEdit(selectedUserId)}
          >
            ✏️ Edit
          </button>
          <button
            className="btn btn-delete"
            onClick={() => handleDelete(selectedUserId)}
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

export default AccountManagement;
