import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import TestForm from './pages/TestForm'
import Admin from './pages/Admin'
import CompanyLogin from './pages/CompanyLogin'
import CompanyDashboard from './pages/CompanyDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/test" element={<TestForm />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/business" element={<CompanyLogin />} />
        <Route path="/business/dashboard" element={<CompanyDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
