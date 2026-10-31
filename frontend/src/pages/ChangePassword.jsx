import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../axiosInstance";
import Brand from "../components/common/Brand";
import ThemeToggle from "../components/common/ThemeToggle";
import SiteFooter from "../components/common/SiteFooter";

function ChangePassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.next.length < 8) return setError("New password must be at least 8 characters.");
    if (!/[A-Za-z]/.test(form.next) || !/\d/.test(form.next))
      return setError("New password needs a letter and a number.");
    if (form.next !== form.confirm) return setError("Passwords do not match.");

    setLoading(true);
    try {
      await axiosInstance.post("/auth/change-password", {
        current_password: form.current,
        new_password: form.next,
      });
      localStorage.removeItem("must_change_password");
      navigate(localStorage.getItem("role") === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(". ") : "Could not change password.");
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const cls = "w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500";

  return (
    <div className="public-layout">
      <header className="site-header">
        <div className="site-header-inner">
          <Brand />
          <ThemeToggle />
        </div>
      </header>
      <main className="public-main">
        <div className="auth-page flex w-full items-center justify-center px-4 py-10">
          <form onSubmit={handleSubmit} className="auth-panel w-full max-w-md space-y-5 rounded-2xl p-8 sm:p-10">
        <div className="text-center">
          <div className="brand-mark mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl text-lg font-bold text-white">G</div>
          <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>
          <p className="mt-2 text-sm text-gray-500">You must replace your temporary password before continuing.</p>
        </div>
        <label className="block text-sm font-medium text-gray-700">
          Current password
          <input type="password" autoComplete="current-password" placeholder="Enter current password" value={form.current} onChange={set("current")} className={`${cls} auth-input mt-2 w-full`} required />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          New password
          <input type="password" autoComplete="new-password" placeholder="At least 8 characters, with a letter and a number" value={form.next} onChange={set("next")} className={`${cls} auth-input mt-2 w-full`} required />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Confirm new password
          <input type="password" autoComplete="new-password" placeholder="Re-enter new password" value={form.confirm} onChange={set("confirm")} className={`${cls} auth-input mt-2 w-full`} required />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="primary-button w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? "Saving..." : "Change password"}
        </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default ChangePassword;