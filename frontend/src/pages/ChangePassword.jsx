import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../axiosInstance";

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
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 rounded-xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>
          <p className="mt-2 text-sm text-gray-500">You must replace your temporary password before continuing.</p>
        </div>
        <input type="password" placeholder="Temporary password" value={form.current} onChange={set("current")} className={cls} required />
        <input type="password" placeholder="New password" value={form.next} onChange={set("next")} className={cls} required />
        <input type="password" placeholder="Confirm new password" value={form.confirm} onChange={set("confirm")} className={cls} required />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}

export default ChangePassword;