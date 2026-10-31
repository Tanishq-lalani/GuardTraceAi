import { Link, useNavigate } from "react-router-dom";
import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";

function clearSession() {
  ["access_token", "role", "must_change_password"].forEach((key) => localStorage.removeItem(key));
}

export default function WorkspaceHeader({ user }) {
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem("role") === "admin";

  function signOut() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <header className="workspace-header">
      <div className="workspace-header-inner">
        <Brand to={isAdmin ? "/admin" : "/dashboard"} />
        <div className="workspace-context">
          <span className="workspace-context-label">{user?.organization_name || "Secure workspace"}</span>
          <span className="workspace-role">{isAdmin ? "Administrator" : "Employee"} workspace</span>
        </div>
        <div className="workspace-actions">
          <div className="workspace-identity">
            <span className="avatar" aria-hidden="true">{user?.name?.trim()?.[0]?.toUpperCase() || (isAdmin ? "A" : "U")}</span>
            <span className="workspace-identity-name">{user?.name || "Your account"}</span>
          </div>
          <ThemeToggle />
          <Link className="button button-quiet workspace-home-link" to="/">Home</Link>
          <button type="button" className="button button-quiet signout-button" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </header>
  );
}
