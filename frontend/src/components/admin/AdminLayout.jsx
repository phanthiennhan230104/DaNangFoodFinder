import Header from "./Header";
import Sidebar from "./Sidebar";

function AdminLayout({ children }) {
  return (
    <div className="admin-container">
      <Sidebar />
      <div className="admin-main-content">
        <Header />
        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}

export default AdminLayout;
