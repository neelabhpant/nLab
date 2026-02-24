import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/shared/components/layout'
import { Dashboard } from '@/spaces/finance/pages/dashboard'
import { Compare } from '@/spaces/finance/pages/compare'
import { Chat } from '@/spaces/finance/pages/chat'
import { Settings } from '@/shared/pages/settings'
import { AdvisorFinancial } from '@/spaces/finance/pages/advisor-financial'
import { AdvisorPortfolio } from '@/spaces/finance/pages/advisor-portfolio'
import { Gallery } from '@/spaces/labs/pages/gallery'
import { FunctionToMusic } from '@/spaces/labs/pages/function-to-music'
import { ProjectDetail } from '@/spaces/labs/pages/project-detail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/finance" replace />} />
          <Route path="/finance" element={<Dashboard />} />
          <Route path="/finance/analytics" element={<Compare />} />
          <Route path="/finance/compare" element={<Navigate to="/finance/analytics" replace />} />
          <Route path="/finance/chat" element={<Chat />} />
          <Route path="/finance/advisor/financial" element={<AdvisorFinancial />} />
          <Route path="/finance/advisor/portfolio" element={<AdvisorPortfolio />} />
          <Route path="/labs" element={<Gallery />} />
          <Route path="/labs/function-to-music" element={<FunctionToMusic />} />
          <Route path="/labs/:projectId" element={<ProjectDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
