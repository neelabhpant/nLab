import { motion } from 'framer-motion'
import { Cpu, UserCheck, TrendingUp, PieChart, ShieldCheck, RotateCcw, ArrowLeft } from 'lucide-react'

const AGENTS = [
  { name: 'Investor Profiler', icon: UserCheck, desc: 'Validating your investment profile...' },
  { name: 'Market Research Analyst', icon: TrendingUp, desc: 'Analysing current market conditions...' },
  { name: 'Portfolio Strategist', icon: PieChart, desc: 'Constructing optimal allocation...' },
  { name: 'Risk Analyst', icon: ShieldCheck, desc: 'Stress-testing the portfolio...' },
]

export function LoadingScreen({
  activeAgent,
  error,
  onRetry,
  onBack,
}: {
  activeAgent: string
  error: string | null
  onRetry?: () => void
  onBack?: () => void
}) {
  const activeIdx = AGENTS.findIndex((a) => a.name === activeAgent)

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-display font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-sm font-body text-slate-500 leading-relaxed mb-6">{error}</p>
          <div className="flex items-center justify-center gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan text-white text-sm font-display font-semibold shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
            )}
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-display font-semibold text-slate-600 hover:border-slate-300 transition-all duration-200 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Edit Answers
              </button>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-2xl bg-cyan/10 flex items-center justify-center mx-auto mb-5"
          >
            <Cpu className="w-8 h-8 text-cyan" />
          </motion.div>
          <h2 className="text-xl font-display font-bold text-slate-900 mb-1.5">
            Building your portfolio...
          </h2>
          <p className="text-sm font-body text-slate-500">
            Your advisory team is analysing your profile and market conditions
          </p>
        </motion.div>

        <div className="space-y-3">
          {AGENTS.map((agent, i) => {
            const isActive = i === activeIdx
            const isDone = i < activeIdx
            const Icon = agent.icon

            return (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-500 ${
                  isActive
                    ? 'border-cyan/30 bg-cyan/5 shadow-sm'
                    : isDone
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-slate-100 bg-white'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-500 ${
                    isActive
                      ? 'bg-cyan/10'
                      : isDone
                        ? 'bg-emerald-100'
                        : 'bg-slate-100'
                  }`}
                >
                  {isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Icon className="w-5 h-5 text-cyan" />
                    </motion.div>
                  ) : (
                    <Icon className={`w-5 h-5 ${isDone ? 'text-emerald-500' : 'text-slate-300'}`} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-display font-semibold transition-colors duration-500 ${
                      isActive ? 'text-slate-900' : isDone ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {agent.name}
                  </div>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs font-body text-slate-500 mt-0.5"
                    >
                      {agent.desc}
                    </motion.div>
                  )}
                </div>

                {isActive && (
                  <div className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-cyan"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.2 }}
                      />
                    ))}
                  </div>
                )}

                {isDone && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-xs font-display font-semibold text-emerald-500"
                  >
                    ✓
                  </motion.span>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
