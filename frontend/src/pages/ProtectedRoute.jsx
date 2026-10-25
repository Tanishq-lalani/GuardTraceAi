import { Navigate, Outlet } from "react-router-dom";

function ProtectedRoute({ role }) {
  const token = localStorage.getItem("access_token");
  const userRole = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;

  // If a role is required and the user doesn't have it, send them to their own home
  if (role && userRole !== role) {
    return <Navigate to={userRole === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;