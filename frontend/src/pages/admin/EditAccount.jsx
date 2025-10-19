import { useEffect, useState } from "react";
import {
    FaArrowLeft,
    FaEye,
    FaEyeSlash,
    FaLock,
    FaSave,
    FaUser,
} from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import "../../styles/admin/EditAccount.css";

function EditAccount() {
  const navigate = useNavigate();
  const { userId } = useParams();

  const [roles, setRoles] = useState([]);
  const [activeTab, setActiveTab] = useState("account");
  const [showPassword, setShowPassword] = useState(false);
  const [showRePassword, setShowRePassword] = useState(false);

  const [accountForm, setAccountForm] = useState({
    email: "",
    role: "",
    password: "",
    rePassword: "",
  });

  const [profileForm, setProfileForm] = useState({
    profileId: null,
    fullname: "",
    dob: "",
    gender: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("access");
      if (!token) return;

      try {
        // fetch roles
        const rolesRes = await fetch("http://localhost:8000/api/admin/roles/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (rolesRes.ok) {
          const rolesJson = await rolesRes.json();
          const rolesList = rolesJson.results ?? rolesJson;
          setRoles(rolesList || []);
        }

        // fetch user
        const userRes = await fetch(
          `http://localhost:8000/api/admin/users/${userId}/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (userRes.ok) {
          const userJson = await userRes.json();
          setAccountForm({
            email: userJson.email ?? "",
            role: userJson.role?.id ?? userJson.role_id ?? "",
            password: "******",
            rePassword: "******",
          });
        }

        // fetch profile
        let profileObj = null;
        const qRes = await fetch(
          `http://localhost:8000/api/admin/profiles/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (qRes.ok) {
          const qJson = await qRes.json();
          const list = qJson.results ?? qJson;
          if (Array.isArray(list) && list.length > 0) {
            profileObj = list[0];
          }
        }
        if (!profileObj) {
          const getRes = await fetch(
            `http://localhost:8000/api/admin/profiles/${userId}/`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (getRes.ok) profileObj = await getRes.json();
        }

        if (profileObj) {
          setProfileForm({
            profileId:
              profileObj.id ??
              profileObj.profile_id ??
              profileObj.pk ??
              profileObj.user ??
              null,
            fullname: profileObj.fullname ?? "",
            dob: profileObj.dob ?? "",
            gender: profileObj.gender ?? "",
            phone: profileObj.phone ?? "",
            address: profileObj.address ?? "",
          });
        }
      } catch (err) {
        console.error("fetchData error:", err);
      }
    })();
  }, [userId]);

  const handleAccountChange = (e) => {
    const { name, value } = e.target;
    setAccountForm((prev) => ({ ...prev, [name]: value }));
  };
  const handlePasswordFocus = () => {
    if (accountForm.password === "******") {
      setAccountForm((prev) => ({ ...prev, password: "", rePassword: "" }));
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const token = localStorage.getItem("access");
    if (!token) return alert("You are not logged in!");

    try {
      if (activeTab === "account") {
        if (
          accountForm.password &&
          accountForm.password !== "******" &&
          accountForm.password !== accountForm.rePassword
        ) {
          return alert("Passwords do not match.");
        }

        const body = {
          email: accountForm.email,
          role_id: accountForm.role,
        };
        if (accountForm.password && accountForm.password !== "******") {
          body.password = accountForm.password;
        }

        const res = await fetch(
          `http://localhost:8000/api/admin/users/${userId}/update/`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          }
        );

        if (res.ok) {
          alert("Account updated successfully!");
          navigate("/admin/accounts");
        } else {
          const data = await res.json().catch(() => null);
          alert("Could not update account: " + JSON.stringify(data));
        }
      } else {
        const payload = {
          fullname: profileForm.fullname,
          dob: profileForm.dob,
          gender: profileForm.gender,
          phone: profileForm.phone,
          address: profileForm.address,
          user: Number(userId),
        };

        let url, method;
        if (profileForm.profileId) {
          url = `http://localhost:8000/api/admin/profiles/${profileForm.profileId}/update/`;
          method = "PATCH";
        } else {
          url = `http://localhost:8000/api/admin/profiles/create/`;
          method = "POST";
        }

        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          alert(
            profileForm.profileId ? "Profile updated!" : "New profile created!"
          );
          navigate("/admin/accounts");
        } else {
          const data = await res.json().catch(() => null);
          alert("Could not save profile: " + JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("handleSave error:", err);
      alert("Error while saving data.");
    }
  };

  return (
    <div className="edit-page">
      <div className="edit-card">
        <h2>✏️ Edit User</h2>
        <p className="edit-subtitle">Update account information</p>

        {/* Tabs */}
        <div className="edit-tabs">
          <button
            className={activeTab === "account" ? "active" : ""}
            onClick={() => setActiveTab("account")}
          >
            <FaLock /> Account
          </button>
          <button
            className={activeTab === "profile" ? "active" : ""}
            onClick={() => setActiveTab("profile")}
          >
            <FaUser /> Profile
          </button>
        </div>

        {/* Account form */}
        {activeTab === "account" && (
          <>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="Enter email..."
                value={accountForm.email}
                onChange={handleAccountChange}
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                name="role"
                value={accountForm.role}
                onChange={handleAccountChange}
              >
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.id ?? r.role_id} value={r.id ?? r.role_id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group password-group">
              <label>Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Leave blank if unchanged"
                  value={accountForm.password}
                  onChange={handleAccountChange}
                  onFocus={handlePasswordFocus}
                  autoComplete="new-password"
                />
                <span
                  className="toggle-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
              <small>
                Leave blank if you don’t want to change the password
              </small>
            </div>

            <div className="form-group password-group">
              <label>Confirm Password</label>
              <div className="password-wrapper">
                <input
                  type={showRePassword ? "text" : "password"}
                  name="rePassword"
                  placeholder="Re-enter new password"
                  value={accountForm.rePassword}
                  onChange={handleAccountChange}
                  onFocus={handlePasswordFocus}
                  autoComplete="new-password"
                />
                <span
                  className="toggle-visibility"
                  onClick={() => setShowRePassword(!showRePassword)}
                >
                  {showRePassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Profile form */}
        {activeTab === "profile" && (
          <>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="fullname"
                placeholder="Enter full name..."
                value={profileForm.fullname}
                onChange={handleProfileChange}
              />
            </div>

            <div className="form-group">
              <label>Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={profileForm.dob}
                onChange={handleProfileChange}
              />
            </div>

            <div className="form-group">
              <label>Gender</label>
              <select
                name="gender"
                value={profileForm.gender}
                onChange={handleProfileChange}
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="text"
                name="phone"
                placeholder="Enter phone number..."
                value={profileForm.phone}
                onChange={handleProfileChange}
              />
            </div>

            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                name="address"
                placeholder="Enter address..."
                value={profileForm.address}
                onChange={handleProfileChange}
              />
            </div>
          </>
        )}

        <div className="account-actions">
          <button
            className="btn btn-back"
            onClick={() => navigate("/admin/accounts")}
          >
            <FaArrowLeft /> Back
          </button>
          <button className="btn btn-add" onClick={handleSave}>
            <FaSave /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditAccount;
