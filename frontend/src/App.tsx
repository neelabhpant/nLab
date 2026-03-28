import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from '@/shared/components/layout'
import { Dashboard } from '@/spaces/finance/pages/dashboard'
import { Compare } from '@/spaces/finance/pages/compare'
import { Chat } from '@/spaces/finance/pages/chat'
import { Settings } from '@/shared/pages/settings'
import { AdvisorFinancial } from '@/spaces/finance/pages/advisor-financial'
import { Roadmap } from '@/spaces/finance/pages/roadmap'
import { Forecast } from '@/spaces/finance/pages/forecast'
import { Trading } from '@/spaces/finance/pages/trading'
import { TradingAgents } from '@/spaces/finance/pages/trading-agents'
import { RetailDashboard } from '@/spaces/retail/pages/retail-dashboard'
import { RetailArticles } from '@/spaces/retail/pages/retail-articles'
import { RetailSparks } from '@/spaces/retail/pages/retail-sparks'
import { RetailChat } from '@/spaces/retail/pages/retail-chat'
import { RetailSources } from '@/spaces/retail/pages/retail-sources'
import { Gallery } from '@/spaces/labs/pages/gallery'
import { Workshop } from '@/spaces/labs/pages/workshop'
import { OpenClaw } from '@/spaces/labs/pages/openclaw'
import { FunctionToMusic } from '@/spaces/labs/pages/function-to-music'
import { ProjectDetail } from '@/spaces/labs/pages/project-detail'
import { Vault } from '@/shared/pages/vault'
import { Login } from '@/shared/pages/login'
import { AuthCallback } from '@/shared/pages/auth-callback'
import { useAuthStore } from '@/shared/stores/auth-store'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-0">
        <div className="w-6 h-6 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    sessionStorage.setItem('nlab_return_to', location.pathname)
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/finance" replace />} />
        <Route path="/finance" element={<Dashboard />} />
        <Route path="/finance/analytics" element={<Compare />} />
        <Route path="/finance/compare" element={<Navigate to="/finance/analytics" replace />} />
        <Route path="/finance/chat" element={<Chat />} />
        <Route path="/finance/advisor/financial" element={<AdvisorFinancial />} />
        <Route path="/finance/roadmap" element={<Roadmap />} />
        <Route path="/finance/trading" element={<Trading />} />
        <Route path="/finance/trading/agents" element={<TradingAgents />} />
        <Route path="/finance/forecast" element={<Forecast />} />
        <Route path="/retail" element={<RetailDashboard />} />
        <Route path="/retail/articles" element={<RetailArticles />} />
        <Route path="/retail/sparks" element={<RetailSparks />} />
        <Route path="/retail/chat" element={<RetailChat />} />
        <Route path="/retail/sources" element={<RetailSources />} />
        <Route path="/labs" element={<Gallery />} />
        <Route path="/labs/workshop" element={<Workshop />} />
        <Route path="/labs/openclaw" element={<OpenClaw />} />
        <Route path="/labs/function-to-music" element={<FunctionToMusic />} />
        <Route path="/labs/:projectId" element={<ProjectDetail />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
