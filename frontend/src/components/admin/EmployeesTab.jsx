import { useMemo, useState } from "react";
import axiosInstance from "../../axiosInstance";
import { useApi } from "./useApi";
import { Card, DaysSelect, Empty, ErrorBox, RiskBadge, inputCls } from "./ui";
import { errMsg, fmtDate, fmtNum } from "./helpers";

function EmployeesTab({ onOpen }) {
  const [days, setDays] = useState(30);
  const users = useApi("/admin/users");
  const board = useApi("/admin/leaderboard", { days });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [credential, setCredential] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const rows = useMemo(() => {
    const stats = new Map((board.data?.employees || []).map((e) => [e.user_id, e]));
    return (users.data || [])
      .filter((u) => u.role === "user")
      .map((u) => ({ ...u, stats: stats.get(u.id) }))
      .sort((a, b) => (a.stats?.rank ?? 999) - (b.stats?.rank ?? 999));
  }, [users.data, board.data]);

  const refresh = () => {
    users.reload();
    board.reload();
  };

  async function createUser(e) {
    e.preventDefault();
    setCreating(true);
    setFormError("");
    setCredential(null);
    try {
      const res = await axiosInstance.post("/admin/users", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
      });
      setCredential({ label: `Account created for ${res.data.user.email}`, password: res.data.temporary_password });
      setForm({ name: "", email: "" });
      setShowForm(false);
      refresh();
    } catch (err) {
      setFormError(errMsg(err, "Unable to create user."));
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(u) {
    if (!window.confirm(`${u.is_active ? "Deactivate" : "Activate"} ${u.name}?`)) return;
    setBusyId(u.id);
    setActionError("");
    try {
      await axiosInstance.patch(`/admin/users/${u.id}/status`, { is_active: !u.is_active });
      refresh();
    } catch (err) {
      setActionError(errMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(u) {
    if (!window.confirm(`Reset the password for ${u.name}? Their current password will stop working.`)) return;
    setBusyId(u.id);
    setActionError("");
    try {
      const res = await axiosInstance.post(`/admin/users/${u.id}/reset-password`);
      setCredential({ label: `New temporary password for ${u.email}`, password: res.data.temporary_password });
      refresh();
    } catch (err) {
      setActionError(errMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  const headers = ["#", "Employee", "Status", "Prompts", "Violations", "Tokens", "Risk", "Riskier than", "Last login", "Actions"];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Employees</h2>
          <p className="text-slate-500">Create accounts and compare risk across your team.</p>
        </div>
        <div className="flex gap-3">
          <DaysSelect value={days} onChange={setDays} />
          <button
            onClick={() => {
              setShowForm(!showForm);
              setFormError("");
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "+ Create employee"}
          </button>
        </div>
      </div>

      {credential && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-900">{credential.label}</h3>
          <p className="mt-1 text-sm text-amber-800">
            Share this temporary password securely. It is shown only once, and the employee must change it at first login.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <code className="rounded-lg border border-amber-200 bg-white px-4 py-2 font-mono text-slate-900">{credential.password}</code>
            <button
              onClick={() => navigator.clipboard.writeText(credential.password)}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium hover:bg-amber-100"
            >
              Copy
            </button>
            <button onClick={() => setCredential(null)} className="text-sm text-amber-900 underline">
              Dismiss
            </button>
          </div>
        </section>
      )}

      {showForm && (
        <Card title="New employee" subtitle="A temporary password is generated for you.">
          <form onSubmit={createUser} className="grid gap-4 p-5 sm:grid-cols-2">
            <input
              className={inputCls}
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              minLength={2}
              maxLength={100}
              required
            />
            <input
              className={inputCls}
              type="email"
              placeholder="employee@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            {formError && (
              <p role="alert" className="text-sm text-red-600 sm:col-span-2">
                {formError}
              </p>
            )}
            <div className="sm:col-span-2">
              <button
                disabled={creating}
                className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create account"}
              </button>
            </div>
          </form>
        </Card>
      )}

      <ErrorBox>{users.error || board.error || actionError}</ErrorBox>

      <Card title="Team" subtitle="Risk score: 0 (clean) to 100 (high risk). Percentile compares with colleagues.">
        {users.loading && !users.data ? (
          <Empty>Loading...</Empty>
        ) : rows.length === 0 ? (
          <Empty>No employees yet. Create the first one above.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{u.stats?.rank ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => onOpen(u.id)} className="font-medium text-blue-700 hover:underline">
                        {u.name}
                      </button>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                      {u.must_change_password && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">Temp password</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{fmtNum(u.stats?.prompts)}</td>
                    <td className="px-4 py-3">
                      {fmtNum(u.stats?.violations)}
                      {u.stats?.high_severity > 0 && <span className="ml-1 text-xs text-red-600">({u.stats.high_severity} high)</span>}
                    </td>
                    <td className="px-4 py-3">{fmtNum(u.stats?.total_tokens)}</td>
                    <td className="px-4 py-3">
                      <RiskBadge score={u.stats?.risk_score ?? 0} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.stats?.riskier_than_pct == null ? "—" : `${u.stats.riskier_than_pct}% of peers`}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(u.last_login_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleStatus(u)}
                          disabled={busyId === u.id}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => resetPassword(u)}
                          disabled={busyId === u.id}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
export default EmployeesTab;