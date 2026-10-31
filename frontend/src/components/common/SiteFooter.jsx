import { Link } from "react-router-dom";
import Brand from "./Brand";

export default function SiteFooter() {
  const signedIn = Boolean(localStorage.getItem("access_token"));
  const workspacePath = localStorage.getItem("must_change_password") === "true"
    ? "/change-password"
    : localStorage.getItem("role") === "admin"
      ? "/admin"
      : "/dashboard";

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Brand compact />
        <p>Protecting the way your team works with AI.</p>
        <nav aria-label="Footer navigation">
          <Link to="/">Home</Link>
          {signedIn ? (
            <Link to={workspacePath}>Workspace</Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
        </nav>
        <span className="copyright">© GuardTraceAI</span>
      </div>
    </footer>
  );
}
