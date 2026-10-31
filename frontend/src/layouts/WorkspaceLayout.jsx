import WorkspaceHeader from "../components/common/WorkspaceHeader";
import SiteFooter from "../components/common/SiteFooter";

export default function WorkspaceLayout({ user, children, className = "" }) {
  return (
    <div className={`workspace-theme workspace-layout ${className}`}>
      <WorkspaceHeader user={user} />
      {children}
      <SiteFooter />
    </div>
  );
}
