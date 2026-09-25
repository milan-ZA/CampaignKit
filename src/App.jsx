import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import { LoadingState } from './components/ui'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BrandProvider } from './context/BrandContext'
import { ConfirmProvider } from './context/ConfirmContext'
import AuthPage from './pages/AuthPage'
import BrandProfilePage from './pages/BrandProfilePage'
import CampaignPlanPage from './pages/CampaignPlanPage'
import CheckInboxPage from './pages/CheckInboxPage'
import DashboardPage from './pages/DashboardPage'
import NewCampaignPage from './pages/NewCampaignPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingState />
  if (!user) return <Navigate to="/login" replace />
  return (
    <BrandProvider key={user.id}>
      <div className="flex min-h-dvh flex-col">
        <Header />
        <Outlet />
      </div>
    </BrandProvider>
  )
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingState />
  if (user) return <Navigate to="/" replace />
  return children
}

/** Sends users arriving from a password-reset email to the "choose a new password" screen. */
function RecoveryRedirect() {
  const { recovering } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (recovering) navigate('/reset-password', { replace: true })
  }, [recovering, navigate])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <RecoveryRedirect />
        <Routes>
          <Route
            path="/login"
            element={
              <GuestOnly>
                <AuthPage />
              </GuestOnly>
            }
          />
          <Route path="/check-inbox" element={<CheckInboxPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/brand" element={<BrandProfilePage />} />
            <Route path="/campaigns/new" element={<NewCampaignPage />} />
            <Route path="/campaigns/:id" element={<CampaignPlanPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ConfirmProvider>
    </AuthProvider>
  )
}
