import { useEffect, useState } from "react";
import axiosInstance from "../axiosInstance";
import { errMsg } from "../components/admin/helpers";
import OverviewTab from "../components/admin/OverviewTab";
import EmployeesTab from "../components/admin/EmployeesTab";
import EmployeeDetail from "../components/admin/EmployeeDetail";
import EventsTab from "../components/admin/EventsTab";
import AuditTab from "../components/admin/AuditTab";
import WorkspaceLayout from "../layouts/WorkspaceLayout";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "employees", label: "Employees" },
  { key: "events", label: "Security events" },
  { key: "audit", label: "Audit log" },
];

function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const [selectedId, setSelectedId] = useState(null);
  const [me, setMe] = useState(null);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    axiosInstance.get("/auth/me").then((r) => setMe(r.data)).catch((err) => setProfileError(errMsg(err)));
  }, []);

  const openEmployee = (id) => {
    setSelectedId(id);
    setTab("employees");
  };

  const goTab = (key) => {
    setSelectedId(null);
    setTab(key);
  };

  return (
    <WorkspaceLayout user={me}>
      <div className="admin-content">
        <nav className="admin-tabs" aria-label="Admin dashboard sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => goTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`admin-tab ${tab === t.key ? "admin-tab-active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <main className="admin-main mx-auto w-full max-w-7xl space-y-6">
        {profileError && (
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Unable to load your profile: {profileError}
          </div>
        )}
        {tab === "overview" && <OverviewTab />}

        {tab === "employees" &&
          (selectedId ? (
            <EmployeeDetail id={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <EmployeesTab onOpen={openEmployee} />
          ))}

        {tab === "events" && <EventsTab onOpen={openEmployee} />}
        {tab === "audit" && <AuditTab />}
        </main>
      </div>
    </WorkspaceLayout>
  );
}

export default AdminDashboard;