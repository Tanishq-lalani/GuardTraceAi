import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../axiosInstance";

function Dashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    axiosInstance
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {user ? (
          <p className="mt-4 text-gray-700">
            Welcome, {user.name} ({user.email}) role: {user.role}
          </p>
        ) : (
          <p className="mt-4 text-gray-500">Loading...</p>
        )}
        <button
          onClick={handleLogout}
          className="mt-6 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Dashboard;