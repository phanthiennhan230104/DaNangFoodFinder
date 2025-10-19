import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/admin/AddAccount.css";

function AddAccount() {
  const navigate = useNavigate();

  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    fullname: "",
    email: "",
    role_id: "",
    password: "",
    rePassword: "",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRoles = async () => {
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
    };
    fetchRoles();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBack = () => {
    navigate("/admin/accounts");
  };

  const handleSave = async () => {
    if (!form.fullname || !form.email || !form.role_id) {
      return alert("Please fill in all required fields.");
    }
    if (!form.password || !form.rePassword) {
      return alert("Please enter a password.");
    }
    if (form.password !== form.rePassword) {
      return alert("Passwords do not match.");
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch("http://localhost:8000/api/admin/users/create/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullname: form.fullname,
          email: form.email,
          username: form.email,
          role_id: form.role_id,
          password: form.password,
        }),
      });

      if (res.ok) {
        alert("Account created successfully, Your username is your email!!");
        navigate("/admin/accounts");
      } else {
        const data = await res.json().catch(() => null);
        alert("Failed to create account: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
      alert("Error while creating account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-account">
      <div className="add-account-card">
        <h2 className="add-account-title">✏️ Create New User</h2>
        <p className="add-account-subtitle">
          Enter information to add a new account
        </p>

        <div className="add-account-group">
          <label>Full Name</label>
          <input
            type="text"
            name="fullname"
            placeholder="Enter full name..."
            value={form.fullname}
            onChange={handleChange}
          />
        </div>

        <div className="add-account-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            placeholder="Enter email..."
            value={form.email}
            onChange={handleChange}
          />
        </div>

        <div className="add-account-group">
          <label>Role</label>
          <select name="role_id" value={form.role_id} onChange={handleChange}>
            <option value="">Select a role</option>
            {roles.map((r) => (
              <option key={r.role_id} value={r.role_id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="add-account-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="Enter password..."
            value={form.password}
            onChange={handleChange}
          />
        </div>

        <div className="add-account-group">
          <label>Confirm Password</label>
          <input
            type="password"
            name="rePassword"
            placeholder="Re-enter password"
            value={form.rePassword}
            onChange={handleChange}
          />
        </div>

        <div className="add-account-actions">
          <button
            className="add-account-btn add-account-btn-back"
            onClick={handleBack}
          >
            ⬅️ Back
          </button>
          <button
            className="add-account-btn add-account-btn-add"
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

export default AddAccount;
