import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import Layout from './components/Layout/Layout'

const Dashboard  = lazy(() => import('./pages/Dashboard'))
const Firewall   = lazy(() => import('./pages/Firewall'))
const NAT        = lazy(() => import('./pages/NAT'))
const DHCP       = lazy(() => import('./pages/DHCP'))
const DNS        = lazy(() => import('./pages/DNS'))
const VPN        = lazy(() => import('./pages/VPN'))
const Threats    = lazy(() => import('./pages/Threats'))
const Settings   = lazy(() => import('./pages/Settings'))
const Setup      = lazy(() => import('./pages/Setup'))
const Login      = lazy(() => import('./pages/Login'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

const Spinner = () => (
  <div className="flex items-center justify-center h-screen bg-sentinel-bg">
    <div className="w-8 h-8 border-2 border-sentinel-primary border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  const setupComplete = useStore((s) => s.setupComplete)

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              {setupComplete ? <Layout /> : <Navigate to="/setup" replace />}
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="firewall"  element={<Firewall />} />
          <Route path="nat"       element={<NAT />} />
          <Route path="dhcp"      element={<DHCP />} />
          <Route path="dns"       element={<DNS />} />
          <Route path="vpn"       element={<VPN />} />
          <Route path="threats"   element={<Threats />} />
          <Route path="settings"  element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
