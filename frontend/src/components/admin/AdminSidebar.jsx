import { Database, FileSearch, LayoutDashboard, UserCog } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

function Sidebar() {
  const { pathname } = useLocation();

  const menu = [
    {
      path: "/admin",
      label: "Admin Panel",
      icon: <LayoutDashboard size={18} />,
    },
    {
      path: "/admin/accounts",
      label: "Account Management",
      icon: <UserCog size={18} />,
    },
    {
      path: "/admin/monitor",
      label: "Monitor the Crawler System",
      icon: <FileSearch size={18} />,
    },
    
  ];

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-text">Logo</div>
      </div>
      {menu.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`menu-item ${pathname === item.path ? "active" : ""}`}
        >
          {item.icon} {item.label}
        </Link>
      ))}
    </aside>
  );
}

export default Sidebar;
