import { useState } from "react";
import { useApi } from "./useApi";
import { Card, DaysSelect, Empty, ErrorBox, Pager, RiskBadge, SeverityBadge, StatCard } from "./ui";
import { fmtDate, fmtDateTime, fmtNum, pct } from "./helpers";

function EmployeeDetail({ id, onBack }) {
  const [days, setDays] = useState(30);
  const [offset, setOffset] = useState(0);
  const [openConv, setOpenConv] = useState(null);
  const limit = 10;

  const detail = useApi(`/admin/users/${id}`, { days });
  const history = useApi(`/admin/users/${id}/history`, { limit, offset });
  const convo = useApi(openConv ? `/admin/conversations/${openConv}/messages` : null);

  const profile = detail.data?.profile;
  const stats = detail.data?.stats;

  return (
    <>
      <button onClick={onBack} className="text-sm text-blue-700 hover:underline">
        ← Back to employees
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{profile?.name || "Employee"}</h2>
          <p className="text-slate-500">
            {profile?.email}
            {profile && ` · ${profile.is_active ? "Active" : "Inactive"} · last login ${fmtDate(profile.last_login_at)}`}
          </p>
        </div>
        <DaysSelect value={days} onChange={setDays} />
      </div>

      <ErrorBox>{detail.error}</ErrorBox>

      {stats && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Risk score</p>
            <div className="mt-3">
              <RiskBadge score={stats.risk_score} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Rank {stats.rank} of {detail.data.peer_count}
              {stats.riskier_than_pct != null && ` · riskier than ${stats.riskier_than_pct}% of peers`}
            </p>
          </div>
          <StatCard title="Prompts" value={fmtNum(stats.prompts)} hint={`${stats.cache_hits} served from cache`} />
          <StatCard
            title="Violations"
            value={fmtNum(stats.violations)}
            hint={`${pct(stats.violation_rate)} of attempts · ${stats.high_severity} high`}
          />
          <StatCard
            title="Tokens"
            value={fmtNum(stats.total_tokens)}
            hint={`${fmtNum(stats.prompt_tokens)} in / ${fmtNum(stats.completion_tokens)} out`}
          />
        </div>
      )}

      <Card title="Recent violations" subtitle="Only the kind of data is stored, never the secret itself.">
        {!detail.data || detail.data.recent_events.length === 0 ? (
          <Empty>No violations recorded.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {["When", "Type", "Severity", "Detected", "Risk"].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.data.recent_events.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDateTime(e.created_at)}</td>
                    <td className="px-4 py-3">{e.event_type}</td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={e.severity} />
                    </td>
                    <td className="px-4 py-3">{e.detected.join(", ") || "—"}</td>
                    <td className="px-4 py-3">{e.risk_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Conversations" subtitle="Click one to read it. Employees are told chats are monitored.">
          {history.error && (
            <div className="p-4">
              <ErrorBox>{history.error}</ErrorBox>
            </div>
          )}
          {!history.data || history.data.items.length === 0 ? (
            <Empty>No conversations yet.</Empty>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {history.data.items.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setOpenConv(c.id)}
                      className={`w-full px-5 py-3 text-left hover:bg-slate-50 ${openConv === c.id ? "bg-blue-50" : ""}`}
                    >
                      <p className="truncate text-sm font-medium text-slate-800">{c.title || `Conversation ${c.id}`}</p>
                      <p className="text-xs text-slate-500">
                        {fmtDateTime(c.created_at)} · {c.message_count} messages · {fmtNum(c.total_tokens)} tokens
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
              <Pager offset={offset} limit={limit} total={history.data.total} onChange={setOffset} />
            </>
          )}
        </Card>

        <Card title="Conversation viewer">
          {!openConv ? (
            <Empty>Select a conversation.</Empty>
          ) : convo.loading ? (
            <Empty>Loading...</Empty>
          ) : convo.error ? (
            <div className="p-4">
              <ErrorBox>{convo.error}</ErrorBox>
            </div>
          ) : (
            <div className="max-h-[32rem] space-y-3 overflow-y-auto p-4">
              {convo.data.messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                      m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {m.content}
                    <p className={`mt-1 text-[10px] ${m.role === "user" ? "text-blue-100" : "text-slate-400"}`}>
                      {fmtDateTime(m.created_at)}
                      {m.role === "user" && m.prompt_tokens ? ` · ${m.prompt_tokens} in` : ""}
                      {m.role === "assistant" && m.completion_tokens ? ` · ${m.completion_tokens} out` : ""}
                      {m.cached ? " · cached" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

export default EmployeeDetail