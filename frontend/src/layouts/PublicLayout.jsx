import { Outlet } from "react-router-dom";
import SiteFooter from "../components/common/SiteFooter";
import SiteHeader from "../components/common/SiteHeader";

export default function PublicLayout() {
  return (
    <div className="public-layout">
      <SiteHeader />
      <main className="public-main">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
