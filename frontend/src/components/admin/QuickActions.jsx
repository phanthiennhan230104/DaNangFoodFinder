import { useNavigate } from "react-router-dom";

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      label: "➕ Add New User",
      className: "primary",
      path: "/admin/accounts/add",
    },
    { label: "🔍 View Reports", className: "success", path: "/admin/monitor" },
    { label: "⚙️ System Settings", className: "warning", path: "/admin/roles" },
    {
      label: "📊 Detailed Statistics",
      className: "info",
      path: "/admin/monitor/data",
    },
  ];

  return (
    <div className="quick-actions">
      <h2>🚀 Quick Actions</h2>
      <div className="action-buttons">
        {actions.map((a, i) => (
          <button
            key={i}
            className={`action-btn ${a.className}`}
            onClick={() => navigate(a.path)}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;
