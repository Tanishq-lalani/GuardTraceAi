import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "./useApi";
import { Card, DaysSelect, Empty, ErrorBox, StatCard } from "./ui";
import { fmtNum, pct } from "./helpers";

const toBars = (obj) =>
  Object.entries(obj || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

function BarCard({ title, subtitle, data, color, emptyText }) {
  return (
    <Card title={title} subtitle={subtitle}>
      {data.length === 0 ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <div className="h-60 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function OverviewTab() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useApi("/admin/overview", { days });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Overview</h2>
          <p className="text-slate-500">Usage and policy violations across your organization.</p>
        </div>
        <DaysSelect value={days} onChange={setDays} />
      </div>

      <ErrorBox>{error}</ErrorBox>
      {loading && !data && <Empty>Loading...</Empty>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Employees" value={data.employees.total} hint={`${data.employees.active} active`} />
            <StatCard title="Prompts sent" value={fmtNum(data.prompts)} hint={`last ${data.window_days} days`} />
            <StatCard title="Policy violations" value={fmtNum(data.violations)} hint={`${pct(data.violation_rate)} of attempts`} />
            <StatCard
              title="Tokens used"
              value={fmtNum(data.tokens.total)}
              hint={`${fmtNum(data.tokens.prompt)} in / ${fmtNum(data.tokens.completion)} out`}
            />
          </div>

          <Card title="Activity per day" subtitle="Prompts sent and violations blocked">
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.by_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="prompts" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="violations" stroke="#dc2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <BarCard title="Violations by type" data={toBars(data.violations_by_type)} color="#dc2626" emptyText="No violations in this period." />
            <BarCard
              title="Sensitive data attempts"
              subtitle="Kinds of data employees tried to send"
              data={toBars(data.sensitive_data_by_kind)}
              color="#f59e0b"
              emptyText="No sensitive data detected."
            />
          </div>

          <p className="text-xs text-slate-500">
            Cache hits: {fmtNum(data.cache_hits)} ({pct(data.cache_hit_rate)} of prompts), which cost no tokens.
          </p>
        </>
      )}
    </>
  );
}

export default OverviewTab