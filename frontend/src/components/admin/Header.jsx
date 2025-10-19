import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from '../../../public/images/logo_dnff.png'

function Header() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <header style={{
      display:"flex", justifyContent:"space-between",padding:"10px",
       paddingRight:"50px", paddingLeft:"50px", position:"fixed", top:"0",
        left:"0", right:"0", background:"white", alignItems:"center", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        zIndex:"1000"

     }}>
          <img src={logo} alt="logo" width={60} />
        <div className="header-title">ADMIN MODE</div>
      <button style={{display:"flex",alignItems:"center", gap:"5px"}} className="logout-btn" onClick={handleLogout}>
        <LogOut size={18} /> <span >Đăng xuất </span>
      </button>
    </header>
  );
}

export default Header;
