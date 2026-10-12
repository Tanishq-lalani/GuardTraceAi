import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import './App.css'

function App() {
  return (
    <>
     <BrowserRouter>
     <Routes>
     <Route path="/login" element={<Login />} />
     <Route path="/register" element={<Register />} />
     </Routes>
     </BrowserRouter>
     <h1>Hello World</h1>
    </>
  )
}

export default App
