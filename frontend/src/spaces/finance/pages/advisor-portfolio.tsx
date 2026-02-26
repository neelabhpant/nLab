import { useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { usePortfolioStore } from '@/spaces/finance/stores/portfolio-store'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { Questionnaire } from '@/spaces/finance/components/portfolio/questionnaire'
import { LoadingScreen } from '@/spaces/finance/components/portfolio/loading-screen'
import { RecommendationView } from '@/spaces/finance/components/portfolio/recommendation-view'
import { PortfolioChat } from '@/spaces/finance/components/portfolio/portfolio-chat'

export function AdvisorPortfolio() {
  const { onMobileMenuToggle } = useLayoutContext()
  const {
    recommendation,
    loading,
    activeAgent,
    error,
    showChat,
    submitQuestionnaire,
    startOver,
    setShowChat,
  } = usePortfolioStore()

  const handleSubmit = useCallback(() => {
    submitQuestionnaire()
  }, [submitQuestionnaire])

  const handleRefine = useCallback(() => {
    setShowChat(true)
  }, [setShowChat])

  const handleCloseChat = useCallback(() => {
    setShowChat(false)
  }, [setShowChat])

  const handleDismissError = useCallback(() => {
    usePortfolioStore.setState({ error: null })
  }, [])

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Portfolio Advisor" subtitle="AI-powered portfolio recommendation" onMenuToggle={onMobileMenuToggle} />

      {!loading && !recommendation && !error && (
        <Questionnaire onSubmit={handleSubmit} />
      )}

      {(loading || error) && !recommendation && (
        <LoadingScreen activeAgent={activeAgent} error={error} onRetry={handleSubmit} onBack={handleDismissError} />
      )}

      {!loading && recommendation && (
        <RecommendationView
          recommendation={recommendation}
          onRefine={handleRefine}
          onStartOver={startOver}
        />
      )}

      <AnimatePresence>
        {showChat && <PortfolioChat onClose={handleCloseChat} />}
      </AnimatePresence>
    </div>
  )
}
