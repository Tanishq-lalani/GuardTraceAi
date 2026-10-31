import { useState } from "react";
import { useApi } from "./useApi";
import { Card, Empty, ErrorBox, Pager } from "./ui";
import { fmtDateTime } from "./helpers";

const LABELS = {
  conversation_viewed: "Viewed a conversation",
  user_created: "Created an account",
  user_activated: "Activated an account",
  user_deactivated: "Deactivated an account",
  password_reset: "Reset a password",
};

export default function AuditTab() {
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const { data, loading, error } = useApi("/admin/audit-log", { limit, offset });

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Audit log</h2>
        <p className="text-slate-500">A record of what admins did, including every conversation they opened.</p>
      </div>

      <ErrorBox>{error}</ErrorBox>

      <Card title={`${data?.total ?? 0} entries`}>
        {loading && !data ? (
          <Empty>Loading...</Empty>
        ) : !data || data.items.length === 0 ? (
          <Empty>No admin activity recorded yet.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {["When", "Admin", "Action", "Employee", "Conversation"].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDateTime(a.created_at)}</td>
                      <td className="px-4 py-3">{a.admin}</td>
                      <td className="px-4 py-3">{LABELS[a.action] || a.action}</td>
                      <td className="px-4 py-3">{a.target || "—"}</td>
                      <td className="px-4 py-3">{a.conversation_id ? `#${a.conversation_id}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager offset={offset} limit={limit} total={data.total} onChange={setOffset} />
          </>
        )}
      </Card>
    </>
  );
}