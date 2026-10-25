import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import axiosInstance from "../axiosInstance";

function getErrorMessage(err) {
  if (!err.response) {
    return "Cannot reach the server. Please check your connection and try again.";
  }
  const detail = err.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI 422 validation errors
    return detail.map((d) => d.msg.replace("Value error, ", "")).join(". ");
  }
  if (err.response.status >= 500) return "Server error. Please try again later.";
  return "Registration failed. Please try again.";
}

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    organization_name: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailExists, setEmailExists] = useState(false);
  const [success, setSuccess] = useState(false);
  // After success, show the message briefly, then go to login
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      navigate("/login", { replace: true, state: { registered: true, email: form.email } });
    }, 1500);
    return () => clearTimeout(timer);
  }, [success, navigate, form.email]);

  // Already logged in? Send them to their own home page
  if (localStorage.getItem("access_token")) {
    const role = localStorage.getItem("role");
    return <Navigate to={role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setEmailExists(false);
  };

  const validate = () => {
    if (form.organization_name.trim().length < 2)
      return "Organization name must be at least 2 characters.";
    if (form.name.trim().length < 2) return "Name must be at least 2 characters.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password.length > 72) return "Password must be at most 72 characters.";
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return "Password must contain at least one letter and one number.";
    }
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || success) return; // prevent double submit

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    setEmailExists(false);

    try {
      await axiosInstance.post("/auth/register", {
        organization_name: form.organization_name.trim(),
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
      if (err.response?.status === 409) setEmailExists(true);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:bg-gray-100";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">GuardTraceAI</h1>
          <p className="mt-2 text-gray-500">Register your organization</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="organization_name" className="mb-2 block text-sm font-medium text-gray-700">
              Organization name
            </label>
            <input
              id="organization_name"
              name="organization_name"
              type="text"
              autoComplete="organization"
              value={form.organization_name}
              onChange={handleChange}
              placeholder="Enter your company or organization name"
              className={inputClass}
              disabled={loading || success}
              required
            />
          </div>

          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-700">
              Admin name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter your name"
              className={inputClass}
              disabled={loading || success}
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
              Admin email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className={inputClass}
              disabled={loading || success}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters, with a letter and a number"
                className={`${inputClass} pr-16`}
                disabled={loading || success}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 text-sm text-gray-500 hover:text-gray-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your password"
              className={inputClass}
              disabled={loading || success}
              required
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
              {emailExists && (
                <>
                  {" "}
                  <Link to="/login" className="font-medium underline">
                    Go to login
                  </Link>
                </>
              )}
            </div>
          )}

          {success && (
            <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              Organization created successfully. Redirecting to login...
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Creating organization..." : "Register organization"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Register;