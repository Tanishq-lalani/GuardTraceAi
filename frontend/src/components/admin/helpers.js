export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "Never");
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : "—");
export const fmtNum = (n) => (n ?? 0).toLocaleString();
export const pct = (x) => `${((x ?? 0) * 100).toFixed(1)}%`;

export function errMsg(err, fallback = "Something went wrong. Please try again.") {
  if (!err.response) return "Cannot reach the server.";
  const d = err.response.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(". ");
  return fallback;
}

export function logout() {
  ["access_token", "role", "must_change_password"].forEach((k) => localStorage.removeItem(k));
  window.location.href = "/login";
}