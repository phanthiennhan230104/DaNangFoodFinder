import Header from "../layout/Header";
import Footer from "../layout/Footer";

function AdminLayout({ children }) {
  return (
    <div className="admin-container">
      <div className="admin-main-content">
        <Header />
        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}

export default AdminLayout;
