export const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500";

export function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function RiskBadge({ score }) {
  const tone =
    score >= 50 ? "bg-red-100 text-red-700" : score >= 20 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{score}</span>;
}

export function SeverityBadge({ severity }) {
  const tone =
    severity === "high" ? "bg-red-100 text-red-700" : severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${tone}`}>{severity}</span>;
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
      {children}
    </div>
  );
}

export function Card({ title, subtitle, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="p-8 text-center text-sm text-slate-500">{children}</p>;
}

export function DaysSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputCls}>
      <option value={7}>Last 7 days</option>
      <option value={30}>Last 30 days</option>
      <option value={90}>Last 90 days</option>
    </select>
  );
}

export function Pager({ offset, limit, total, onChange }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm">
      <button
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - limit))}
        className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-slate-500">
        {total === 0 ? 0 : offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <button
        disabled={offset + limit >= total}
        onClick={() => onChange(offset + limit)}
        className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}