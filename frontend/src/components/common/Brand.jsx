import { Link } from "react-router-dom";

export default function Brand({ to = "/", compact = false }) {
  return (
    <Link to={to} className={`brand-link ${compact ? "brand-link-compact" : ""}`}>
      <span className="brand-icon" aria-hidden="true">G</span>
      <span className="brand-name">GuardTrace<span>AI</span></span>
    </Link>
  );
}
