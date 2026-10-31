import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './pages/ProtectedRoute'
import ThemeProvider from './context/ThemeProvider'
import PublicLayout from './layouts/PublicLayout'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const HomePage = lazy(() => import('./pages/HomePage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const ChangePassword = lazy(() => import('./pages/ChangePassword'))

function getHomePath() {
  if (localStorage.getItem("must_change_password") === "true") return "/change-password";
  return localStorage.getItem("role") === "admin" ? "/admin" : "/dashboard";
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading GuardTraceAI…</div>}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            <Route element={<ProtectedRoute passwordChange />}>
              <Route path="/change-password" element={<ChangePassword />} />
            </Route>
            <Route element={<ProtectedRoute role="user" />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
            <Route element={<ProtectedRoute role="admin" />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>
            <Route path="*" element={<Navigate to={localStorage.getItem("access_token") ? getHomePath() : "/"} replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
