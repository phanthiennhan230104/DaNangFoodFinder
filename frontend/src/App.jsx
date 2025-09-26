import React from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import Navbar from "./components/layout/Navbar";
import Login from "./pages/auth/Login"
import Register from "./pages/auth/Register"
import HomePage from "./pages/user/HomePage"
import NotFound from "./pages/NotFound"
import ProtectedRoute from "./components/ProtectedRoute"
import FoodJourneyPlanner from "./pages/user/FoodJourneyPlanner"

function Logout() {
  localStorage.clear()
  return <Navigate to="/login" />
}

function RegisterAndLogout() {
  localStorage.clear()
  return <Register />
}

function Layout({ children }) {
  const location = useLocation()
  const hideNavbarPaths = ["/login", "/register"] // ẩn Navbar ở các trang này

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
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/journey"
            element={
              <ProtectedRoute>
                <FoodJourneyPlanner />
              </ProtectedRoute>
            }
          />
          
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/register" element={<RegisterAndLogout />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
