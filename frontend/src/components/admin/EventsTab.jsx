import { useState } from "react";
import { useApi } from "./useApi";
import { Card, DaysSelect, Empty, ErrorBox, Pager, SeverityBadge, inputCls } from "./ui";
import { fmtDateTime } from "./helpers";

export default function EventsTab({ onOpen }) {
  const [days, setDays] = useState(30);
  const [severity, setSeverity] = useState("");
  const [eventType, setEventType] = useState("");
  const [userId, setUserId] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const users = useApi("/admin/users");
  const params = { days, limit, offset };
  if (severity) params.severity = severity;
  if (eventType) params.event_type = eventType;
  if (userId) params.user_id = userId;
  const events = useApi("/admin/events", params);

  const filter = (setter) => (e) => {
    setter(e.target.value);
    setOffset(0);
  };
  const total = events.data?.total ?? 0;

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Security events</h2>
        <p className="text-slate-500">Every blocked message in your organization.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <DaysSelect
          value={days}
          onChange={(v) => {
            setDays(v);
            setOffset(0);
          }}
        />
        <select aria-label="Filter by severity" value={severity} onChange={filter(setSeverity)} className={inputCls}>
          <option value="">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select aria-label="Filter by event type" value={eventType} onChange={filter(setEventType)} className={inputCls}>
          <option value="">All types</option>
          <option value="BLOCKED_PROMPT">Blocked prompt</option>
          <option value="PROMPT_INJECTION">Prompt injection</option>
        </select>
        <select aria-label="Filter by employee" value={userId} onChange={filter(setUserId)} className={inputCls}>
          <option value="">All employees</option>
          {(users.data || [])
            .filter((u) => u.role === "user")
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      </div>

      <ErrorBox>{events.error}</ErrorBox>

      <Card title={`${total} event${total === 1 ? "" : "s"}`}>
        {events.loading && !events.data ? (
          <Empty>Loading...</Empty>
        ) : !events.data || events.data.items.length === 0 ? (
          <Empty>No events match these filters.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {["When", "Employee", "Type", "Severity", "Detected", "Action", "Risk"].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.data.items.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDateTime(e.created_at)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => onOpen(e.user.id)} className="font-medium text-blue-700 hover:underline">
                          {e.user.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">{e.event_type}</td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={e.severity} />
                      </td>
                      <td className="px-4 py-3">{e.detected.join(", ") || "—"}</td>
                      <td className="px-4 py-3 capitalize">{e.action_taken}</td>
                      <td className="px-4 py-3">{e.risk_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager offset={offset} limit={limit} total={total} onChange={setOffset} />
          </>
        )}
      </Card>
    </>
  );
}