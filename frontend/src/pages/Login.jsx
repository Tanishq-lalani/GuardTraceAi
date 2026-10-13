import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../axiosInstance";







function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("")
    setLoading(true)
    try {
      const response = await axiosInstance.post("/auth/login", {
        email,
        password,
      });

      // Backend currently returns {"error": "..."} with status 200 on failure
      if (response.data.error) {
        setError(response.data.error);
        return;
      }

      localStorage.setItem("access_token", response.data.access_token);
      localStorage.setItem("role", response.data.role);
      navigate("/dashboard");
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            GuardTraceAI
          </h1>
          <p className="mt-2 text-gray-500"> Sign in to your account </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

<button
  type="submit"
  disabled={loading}
  className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
>
  {loading ? "Signing in..." : "Login"}
</button>
          <div className="mt-6 text-center">
    <p className="text-sm text-gray-500">
        Don't have an account?{" "}
        <Link
            to="/register"
            className="font-medium text-blue-600 hover:text-blue-700"
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
