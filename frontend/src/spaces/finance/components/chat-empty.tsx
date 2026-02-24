import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Shield } from 'lucide-react'

const AGENTS = [
  {
    icon: BarChart3,
    name: 'Market Data',
    role: 'Crypto Market Data Specialist',
    description: 'Real-time prices, market caps, and historical data',
    color: '#00D4FF',
  },
  {
    icon: TrendingUp,
    name: 'Analysis',
    role: 'Quantitative Crypto Analyst',
    description: 'Normalized comparisons, correlations, and trend analysis',
    color: '#00E599',
  },
  {
    icon: Shield,
    name: 'Advisor',
    role: 'Personal Financial Advisor',
    description: 'Actionable insights with risk-aware guidance',
    color: '#F5A623',
  },
]

const SUGGESTIONS = [
  "What's the current price of Bitcoin?",
  'Compare BTC vs XRP over 30 days',
  'Should I invest in ETH right now?',
]

interface ChatEmptyProps {
  onSuggestionClick: (suggestion: string) => void
}

export function ChatEmpty({ onSuggestionClick }: ChatEmptyProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan/10 border border-cyan/20 mb-6">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan" />
          </span>
          <span className="text-xs font-display font-medium text-cyan">3 agents ready</span>
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground tracking-tight mb-2">
          AI Crew
        </h2>
        <p className="text-sm text-muted-foreground font-body max-w-[360px]">
          A multi-agent team that collaborates to answer your crypto questions
        </p>
      </motion.div>

      <div className="grid grid-cols-3 gap-3 mb-10 max-w-[640px] w-full">
        {AGENTS.map((agent, i) => (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
            className="relative rounded-xl border border-border bg-surface-0 p-4 overflow-hidden shadow-sm"
          >

            <div className="relative">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: `${agent.color}15` }}
              >
                <agent.icon className="w-4 h-4" style={{ color: agent.color }} />
              </div>
              <h3 className="text-sm font-display font-semibold text-foreground mb-0.5">
                {agent.name}
              </h3>
              <p className="text-[11px] text-muted-foreground font-body leading-snug">
                {agent.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-wrap justify-center gap-2 max-w-[640px]"
      >
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="px-4 py-2 rounded-xl bg-surface-0 border border-border text-xs font-body text-muted-foreground hover:text-foreground hover:border-foreground/20 hover:shadow-sm transition-all duration-200 cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </motion.div>
    </div>
  )
}
