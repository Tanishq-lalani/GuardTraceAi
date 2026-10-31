import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../axiosInstance";
function Login() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice] = useState(location.state?.registered ? "Your organization is ready. Sign in to continue." : "");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (localStorage.getItem("access_token")) {
    const destination = localStorage.getItem("must_change_password") === "true"
      ? "/change-password"
      : localStorage.getItem("role") === "admin"
        ? "/admin"
        : "/dashboard";
    return <Navigate to={destination} replace />;
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await axiosInstance.post("/auth/login", {
        email,
        password,
      });

      if (response.data.error) {
        setError(response.data.error);
        return;
      }

      localStorage.setItem("access_token", response.data.access_token);
      localStorage.setItem("role", response.data.role);
      localStorage.setItem("must_change_password", String(response.data.must_change_password));
      const destination = response.data.must_change_password
        ? "/change-password"
        : response.data.role === "admin"
          ? "/admin"
          : "/dashboard";
      navigate(destination, { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;

      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(", "));
      } else if (!err.response) {
        setError("Cannot reach the server. Is the backend running?");
      } else {
        setError("Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page flex w-full items-center justify-center px-4 py-10">
      <div className="auth-panel w-full max-w-md rounded-2xl p-8 sm:p-10">
        <div className="mb-8 text-center">
          <div className="brand-mark mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl text-lg font-bold text-white">G</div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">GuardTraceAI</h1>
          <p className="mt-2 text-gray-500">Sign in to your account</p>
        </div>
        {notice && <p role="status" className="mb-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="auth-input w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="auth-input w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              required
            />
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

<button
  type="submit"
  disabled={loading}
  className="primary-button w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
>
  {loading ? "Signing in..." : "Login"}
</button>
          <div className="mt-6 text-center">
    <p className="text-sm text-gray-500">
        Don't have an account?{" "}
        <Link
            to="/register"
            className="font-medium text-blue-700 hover:text-blue-800"
        >
            Register
        </Link>
    </p>
</div>
        </form>
      </div>
    </div>
  );
}

export default Login;
