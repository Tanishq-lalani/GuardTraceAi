import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import './App.css'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import ProtectedRoute from './pages/ProtectedRoute'

function App() {
  const role = localStorage.getItem("role")
  return (
    <>
     <BrowserRouter>
     <Routes>
     <Route path="/login" element={<Login />} />
     <Route path="/register" element={<Register />} />
      {/* Employees only */}
      <Route element={<ProtectedRoute role="user" />}>
          <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      {/* Admins only */}
      <Route element={<ProtectedRoute role="admin" />}>
          <Route path="/admin" element={<AdminDashboard />} />
      </Route>
     <Route path="*" element={<Navigate to="/login" replace />}/>
     </Routes>
     </BrowserRouter>
     <h1>Hello World</h1>
    </>
  )
}

export default App
