import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/register"
    ) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("role");
      localStorage.removeItem("must_change_password");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
