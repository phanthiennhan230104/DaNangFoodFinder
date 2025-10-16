import React from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { AuthProvider } from "./components/contexts/AuthContext";
import Navbar from "./components/layout/Navbar"
import Login from "./pages/auth/Login"
import Register from "./pages/auth/Register"
import HomePage from "./pages/user/HomePage"
import NotFound from "./pages/NotFound"
import ProtectedRoute from "./components/ProtectedRoute"
import FoodJourneyPlanner from "./pages/user/FoodJourneyPlanner"
import LandingPage from "./pages/LandingPage"
import AdminCrawlDashboard from "./pages/admin/AdminCrawlDashboard";
import ForgotPassword from "./pages/auth/ForgotPassword"
import { ACCESS_TOKEN } from "./constants";

function Logout() {
  React.useEffect(() => {
    localStorage.clear();
    window.location.replace("/login");
  }, []);
  return <div style={{ textAlign: "center", padding: "40px" }}>Logging out...</div>;
}

function RegisterAndLogout() {
  localStorage.clear()
  return <Register />
}

function Layout({ children }) {
  const location = useLocation()
  const hideNavbarPaths = ["/login", "/register" ,"/admin/home","/forgot-password"]

  const shouldHideNavbar = hideNavbarPaths.includes(location.pathname)

  return (
    <>
      {!shouldHideNavbar && <Navbar />}
      {children}
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              localStorage.getItem(ACCESS_TOKEN) ? (
                localStorage.getItem("ROLE_ID") === "1" ? (
                  <Navigate to="/admin/home" />
                ) : (
                  <Navigate to="/home" />
                )
              ) : (
                <LandingPage />
              )
            }
          />

          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route
                    path="home"
                    element={
                      <ProtectedRoute>
                        <HomePage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="journey"
                    element={
                      <ProtectedRoute>
                        <FoodJourneyPlanner />
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin */}
                  <Route path="admin/crawl" element={<AdminCrawlDashboard />} />

                  {/* Auth */}
                  <Route path="login" element={<Login />} />
                  <Route path="logout" element={<Logout />} />
                  <Route path="forgot-password" element={<ForgotPassword />} />
                  <Route path="register" element={<RegisterAndLogout />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}


export default App
