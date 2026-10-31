import { Navigate, Outlet } from "react-router-dom";

function getHomePath() {
  if (localStorage.getItem("must_change_password") === "true") return "/change-password";
  return localStorage.getItem("role") === "admin" ? "/admin" : "/dashboard";
}

function ProtectedRoute({ role, passwordChange = false }) {
  const token = localStorage.getItem("access_token");
  const userRole = localStorage.getItem("role");
  const mustChangePassword = localStorage.getItem("must_change_password") === "true";

  if (!token || !userRole) return <Navigate to="/login" replace />;
  if (mustChangePassword && !passwordChange) return <Navigate to="/change-password" replace />;
  if (passwordChange && !mustChangePassword) return <Navigate to={getHomePath()} replace />;

  if (role && userRole !== role) {
    return <Navigate to={getHomePath()} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;