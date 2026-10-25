import { useEffect, useState } from "react";
import axiosInstance from "../axiosInstance";
import { logout } from "../components/admin/helpers";
import OverviewTab from "../components/admin/OverviewTab";
import EmployeesTab from "../components/admin/EmployeesTab";
import EmployeeDetail from "../components/admin/EmployeeDetail";
import EventsTab from "../components/admin/EventsTab";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "employees", label: "Employees" },
  { key: "events", label: "Security events" },
];

function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const [selectedId, setSelectedId] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => {
    axiosInstance.get("/auth/me").then((r) => setMe(r.data)).catch(() => {});
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
    <div className="min-h-screen bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-6 py-4 text-white">
        <div>
          <h1 className="text-xl font-bold">GuardTraceAI</h1>
          <p className="text-sm text-slate-300">{me?.organization_name || "Admin Dashboard"}</p>
        </div>

        <nav className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => goTab(t.key)}
              className={`rounded-lg px-4 py-2 text-sm ${
                tab === t.key ? "bg-slate-700 font-medium" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-300 sm:block">{me?.name}</span>
          <button onClick={logout} className="rounded-lg bg-red-600 px-4 py-2 text-sm hover:bg-red-700">
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {tab === "overview" && <OverviewTab />}

        {tab === "employees" &&
          (selectedId ? (
            <EmployeeDetail id={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <EmployeesTab onOpen={openEmployee} />
          ))}

        {tab === "events" && <EventsTab onOpen={openEmployee} />}
      </main>
    </div>
  );
}

export default AdminDashboard;