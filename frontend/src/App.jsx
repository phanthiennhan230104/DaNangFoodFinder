import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./components/contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Header from "./components/layout/Header";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import HomePage from "./pages/user/HomePage";
import RestaurantMap from "./pages/user/RestaurantMap";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import FoodJourneyPlanner from "./pages/user/FoodJourneyPlanner";
import LandingPage from "./pages/LandingPage";
import AdminCrawlDashboard from "./pages/admin/AdminCrawlDashboard";
import ForgotPassword from "./pages/auth/ForgotPassword";
import { ACCESS_TOKEN } from "./constants";
import Profile from "./pages/user/Profile";
import Favorites from "./pages/user/Favorites";

import AdminHome from "./pages/admin/AdminHome";
import EditAccount from "./pages/admin/EditAccount";
import EditRole from "./pages/admin/EditRole";
import RoleManagement from "./pages/admin/RoleManagement";
import AccountManagement from "./pages/admin/AccountManagement";
import AddAccount from "./pages/admin/AddAccount";
import AddRole from "./pages/admin/AddRole";
import ChatbotWidget from "./components/ChatbotWidget";
import Feedback from "./pages/user/Feedback.jsx";
import FeedbackList from "./pages/admin/FeedbackList.jsx";
import FeedbackResolved from "./pages/user/FeedbackResolved.jsx";
import Forbidden from "./pages/Forbidden.jsx";

function Logout() {
  React.useEffect(() => {
    localStorage.clear();
    window.location.replace("/login");
  }, []);
  return (
    <div style={{ textAlign: "center", padding: "40px" }}>Logging out...</div>
  );
}

function RegisterAndLogout() {
  localStorage.clear();
  return <Register />;
}
function Layout({ children }) {
  const location = useLocation();
  const hideHeaderPaths = ["/login", "/register", "/forgot-password"];

  const shouldHideHeader = hideHeaderPaths.includes(location.pathname);

  return (
    <>
      {!shouldHideHeader && <Header />}
      {children}
    </>
  );
}
const queryClient = new QueryClient();

function App() {
  const isLoggedIn = !!localStorage.getItem(ACCESS_TOKEN);
  const roleId = localStorage.getItem("ROLE_ID");

  return (
    <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Root: điều hướng theo role nếu đã login */}
              <Route
                path="/"
                element={
                  isLoggedIn ? (
                    roleId === "1" ? (
                      <Navigate to="/admin/home" />
                    ) : (
                      <Navigate to="/home" />
                    )
                  ) : (
                    <LandingPage />
                  )
                }
              />

              {/* Tất cả các route khác */}
              <Route
                path="/*"
                element={
                  <Layout>
                    <Routes>
                      {/* USER ROUTES - chỉ ROLE_ID = "2" */}
                      <Route
                        path="home"
                        element={
                          <ProtectedRoute allowedRoles={["2"]}>
                            <HomePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="favorites"
                        element={
                          <ProtectedRoute allowedRoles={["2"]}>
                            <Favorites />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="profile"
                        element={
                          <ProtectedRoute allowedRoles={["2"]}>
                            <Profile />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="feedback"
                        element={
                          <ProtectedRoute allowedRoles={["2"]}>
                            <Feedback />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/nearby"
                        element={
                          <ProtectedRoute allowedRoles={["2"]}>
                            <RestaurantMap />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="journey"
                        element={
                          <ProtectedRoute allowedRoles={["2"]}>
                            <FoodJourneyPlanner />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/feedback-resolved"
                        element={
                          <ProtectedRoute allowedRoles={["2"]}>
                            <FeedbackResolved />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="chat"
                        element={
                          <ProtectedRoute allowedRoles={["2"]}>
                            <ChatbotWidget />
                          </ProtectedRoute>
                        }
                      />

                      {/* ADMIN ROUTES - chỉ ROLE_ID = "1" */}
                      <Route
                        path="admin/crawl"
                        element={
                          <ProtectedRoute allowedRoles={["1"]}>
                            <AdminCrawlDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/crawl"
                        element={
                          <ProtectedRoute allowedRoles={["1"]}>
                            <AdminCrawlDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/home"
                        element={
                          <ProtectedRoute allowedRoles={["1"]}>
                            <AdminHome />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/accounts"
                        element={
                          <ProtectedRoute allowedRoles={["1"]}>
                            <AccountManagement />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/roles"
                        element={
                          <ProtectedRoute allowedRoles={["1"]}>
                            <RoleManagement />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/roles/add"
                        element={
                          <ProtectedRoute allowedRoles={["1"]}>
                            <AddRole />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/accounts/add"
                        element={
                          <ProtectedRoute allowedRoles={["1"]}>
                            <AddAccount />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/accounts/edit/:userId"
                        element={
                          <ProtectedRoute allowedRoles={["1"]}>
                            <EditAccount />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/roles/edit/:roleId"
                        element={
                          <ProtectedRoute allowedRoles={["1"]}>
                            <EditRole />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/feedback"
                        element={
                          <ProtectedRoute allowedRoles={["1"]}>
                            <FeedbackList />
                          </ProtectedRoute>
                        }
                      />

                      {/* 403 - Forbidden */}
                      <Route path="403" element={<Forbidden />} />

                      {/* Auth (không cần ProtectedRoute) */}
                      <Route path="login" element={<Login />} />
                      <Route path="logout" element={<Logout />} />
                      <Route
                        path="forgot-password"
                        element={<ForgotPassword />}
                      />
                      <Route path="register" element={<RegisterAndLogout />} />

                      {/* 404 */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                }
              />
            </Routes>

            {/* Chatbot floating và visible trên mọi trang */}
            <ChatbotWidget />
          </BrowserRouter>
        </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
