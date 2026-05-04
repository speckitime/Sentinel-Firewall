import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import Layout from './components/Layout/Layout'

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Firewall = lazy(() => import('./pages/Firewall'))
const NAT = lazy(() => import('./pages/NAT'))
const DHCP = lazy(() => import('./pages/DHCP'))
const DNS = lazy(() => import('./pages/DNS'))
const VPN = lazy(() => import('./pages/VPN'))
const Threats = lazy(() => import('./pages/Threats'))
const Settings = lazy(() => import('./pages/Settings'))
const Setup = lazy(() => import('./pages/Setup'))
const Login = lazy(() => import('./pages/Login'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setupComplete } = useStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!setupComplete) return <Navigate to="/setup" replace />
  return <>{children}</>
}

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-sentinel-bg">
    <div className="animate-pulse text-sentinel-primary text-lg">Laden...</div>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<Setup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="firewall" element={<Firewall />} />
            <Route path="nat" element={<NAT />} />
            <Route path="dhcp" element={<DHCP />} />
            <Route path="dns" element={<DNS />} />
            <Route path="vpn" element={<VPN />} />
            <Route path="threats" element={<Threats />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
