import "../../styles/admin/AdminHome.css";

function QuickActions() {
  return (
    <div className="quick-actions">
      <h3>Quick Actions</h3>
      <div className="actions">
        <button>Add New User</button>
        <button>View Reports</button>
        <button>System Settings</button>
        <button>Recent Activity</button>
      </div>
    </div>
  );
}

export default QuickActions;
