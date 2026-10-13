import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import './App.css'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './pages/ProtectedRoute'

function App() {
  return (
    <>
     <BrowserRouter>
     <Routes>
     <Route path="/login" element={<Login />} />
     <Route path="/register" element={<Register />} />
     <Route element={<ProtectedRoute/>}>
      <Route path='/dashboard' element={<Dashboard/>}/>
     </Route>
     <Route path="*" element={<Navigate to="/login" replace />}/>
     </Routes>
     </BrowserRouter>
     <h1>Hello World</h1>
    </>
  )
}

export default App
