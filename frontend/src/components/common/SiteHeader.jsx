import { useState } from "react";
import { Link } from "react-router-dom";
import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const signedIn = Boolean(localStorage.getItem("access_token"));
  const workspacePath = localStorage.getItem("must_change_password") === "true"
    ? "/change-password"
    : localStorage.getItem("role") === "admin"
      ? "/admin"
      : "/dashboard";

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Brand />
        <nav className="site-nav" aria-label="Main navigation">
          <a href="/#features">Features</a>
          <a href="/#how-it-works">How it works</a>
        </nav>
        <div className="site-actions">
          <button
            type="button"
            className="nav-menu-button"
            aria-expanded={menuOpen}
            aria-controls="mobile-site-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
          <ThemeToggle />
          {signedIn ? (
            <Link className="button button-primary header-cta" to={workspacePath}>Open workspace</Link>
          ) : (
            <>
              <Link className="button button-quiet" to="/login">Sign in</Link>
              <Link className="button button-primary header-cta" to="/register">Get started</Link>
            </>
          )}
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-site-nav" className="mobile-site-nav" aria-label="Mobile navigation">
          <a href="/#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="/#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
        </nav>
      )}
    </header>
  );
}
