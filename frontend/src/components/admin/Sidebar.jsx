import { Database, FileSearch, LayoutDashboard, Shield, UserCog } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

function Sidebar() {
  const { pathname } = useLocation();

  const menu = [
   
    {
      path: "/admin/accounts",
      label: "Account Management",
      icon: <UserCog size={18} />,
    },
    {
      path: "/admin/crawl",
      label: "Monitor the Crawler System",
      icon: <FileSearch size={18} />,
    },

    {
      path: "/admin/roles",
      label: "Role Management",
      icon: <Shield size={18} />,
    },
  ];

  return (
    <aside className="sidebar" style={{paddingTop:"100px"}}>
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
