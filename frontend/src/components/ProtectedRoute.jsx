import { Navigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import api from "../api";
import { REFRESH_TOKEN, ACCESS_TOKEN } from "../constants";
import { useState, useEffect } from "react";

function ProtectedRoute({ children, allowedRoles }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const location = useLocation();

  useEffect(() => {
    auth().catch(() => setIsAuthenticated(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshToken = async () => {
    const refresh = localStorage.getItem(REFRESH_TOKEN);
    if (!refresh) {
      setIsAuthenticated(false);
      return;
    }

    try {
      const res = await api.post("auth/token/refresh/", { refresh });
      if (res.status === 200) {
        localStorage.setItem(ACCESS_TOKEN, res.data.access);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Refresh token error:", error);
      setIsAuthenticated(false);
    }
  };

  const auth = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    try {
      const decoded = jwtDecode(token);
      const now = Date.now() / 1000;
      if (decoded.exp < now) {
        await refreshToken();
      } else {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Token decode error:", error);
      setIsAuthenticated(false);
    }
  };

  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  // Chưa đăng nhập → về login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Đã đăng nhập → kiểm tra role
  const roleId = localStorage.getItem("ROLE_ID");

  // Nếu route có allowedRoles mà role hiện tại không thuộc → 403
  if (allowedRoles && !allowedRoles.includes(roleId)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}

export default ProtectedRoute;
