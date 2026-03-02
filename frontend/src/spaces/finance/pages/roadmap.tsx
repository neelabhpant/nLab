import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Shield,
  CreditCard,
  Landmark,
  PieChart,
  Bot,
  Gem,
  ChevronRight,
  ArrowRight,
  Lock,
  Check,
  TrendingUp,
  Wallet,
  Receipt,
  PiggyBank,
  BadgeDollarSign,
  CircleDollarSign,
} from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { API_BASE, getAuthHeaders } from '@/shared/lib/api'

interface StepMetric {
  current: number
  target: number | null
  label: string
  format: 'currency' | 'number'
}

interface StepAction {
  label: string
  link: string
  prompt?: string
}

interface RoadmapStep {
  id: string
  title: string
  subtitle: string
  status: 'locked' | 'pending' | 'in_progress' | 'completed'
  metric: StepMetric
  action: StepAction
}

interface RoadmapSummary {
  monthly_income: number
  monthly_expenses: number
  savings_rate: number
  total_assets: number
  total_debt: number
  portfolio_value: number
}

interface RoadmapData {
  steps: RoadmapStep[]
  active_step: number
  has_profile: boolean
  summary: RoadmapSummary
}

const STEP_CONFIG: Record<string, { icon: typeof Shield; color: string; gradient: string }> = {
  emergency_fund: { icon: Shield, color: '#0EA5E9', gradient: 'from-sky-500/20 to-sky-500/5' },
  debt_freedom: { icon: CreditCard, color: '#F43F5E', gradient: 'from-rose-500/20 to-rose-500/5' },
  retirement_foundation: { icon: Landmark, color: '#8B5CF6', gradient: 'from-violet-500/20 to-violet-500/5' },
  portfolio_allocation: { icon: PieChart, color: '#F59E0B', gradient: 'from-amber-500/20 to-amber-500/5' },
  active_investing: { icon: Bot, color: '#10B981', gradient: 'from-emerald-500/20 to-emerald-500/5' },
  wealth_growth: { icon: Gem, color: '#EC4899', gradient: 'from-pink-500/20 to-pink-500/5' },
}

const SUMMARY_ITEMS: { key: keyof RoadmapSummary; label: string; icon: typeof Wallet; format: 'currency' | 'percent' }[] = [
  { key: 'monthly_income', label: 'Income', icon: Wallet, format: 'currency' },
  { key: 'monthly_expenses', label: 'Expenses', icon: Receipt, format: 'currency' },
  { key: 'savings_rate', label: 'Savings Rate', icon: PiggyBank, format: 'percent' },
  { key: 'total_assets', label: 'Assets', icon: BadgeDollarSign, format: 'currency' },
  { key: 'total_debt', label: 'Debt', icon: CreditCard, format: 'currency' },
  { key: 'portfolio_value', label: 'Portfolio', icon: CircleDollarSign, format: 'currency' },
]

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toLocaleString()}`
}

function StepCard({
  step,
  index,
  isActive,
  totalSteps,
}: {
  step: RoadmapStep
  index: number
  isActive: boolean
  totalSteps: number
}) {
  const navigate = useNavigate()
  const config = STEP_CONFIG[step.id] ?? STEP_CONFIG.emergency_fund
  const Icon = config.icon

  const isLocked = step.status === 'locked'
  const isCompleted = step.status === 'completed'
  const isInProgress = step.status === 'in_progress'

  const progress =
    step.metric.target && step.metric.target > 0
      ? Math.min((step.metric.current / step.metric.target) * 100, 100)
      : null

  const handleAction = () => {
    if (step.action.prompt) {
      navigate(step.action.link, { state: { prompt: step.action.prompt } })
    } else {
      navigate(step.action.link)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="relative flex gap-4 md:gap-6"
    >
      <div className="flex flex-col items-center flex-shrink-0 w-10 md:w-12">
        <div
          className={`relative w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
            isCompleted
              ? 'bg-gain/15 ring-2 ring-gain/30'
              : isInProgress
                ? 'ring-2 ring-offset-2 ring-offset-surface-0'
                : isLocked
                  ? 'bg-surface-2'
                  : 'bg-surface-1 ring-1 ring-border'
          }`}
          style={
            isInProgress
              ? { backgroundColor: `${config.color}20`, ringColor: config.color }
              : isCompleted
                ? {}
                : {}
          }
        >
          {isCompleted ? (
            <Check className="w-5 h-5 text-gain" strokeWidth={2.5} />
          ) : isLocked ? (
            <Lock className="w-4 h-4 text-slate-400" />
          ) : (
            <Icon className="w-5 h-5" style={{ color: isInProgress ? config.color : '#64748B' }} />
          )}
          {isInProgress && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                style={{ backgroundColor: config.color }}
              />
              <span
                className="relative inline-flex rounded-full h-3 w-3"
                style={{ backgroundColor: config.color }}
              />
            </span>
          )}
        </div>
        {index < totalSteps - 1 && (
          <div
            className={`flex-1 w-0.5 mt-2 rounded-full transition-colors duration-500 ${
              isCompleted ? 'bg-gain/40' : 'bg-border'
            }`}
            style={{ minHeight: 24 }}
          />
        )}
      </div>

      <div
        className={`flex-1 pb-6 ${index === totalSteps - 1 ? 'pb-0' : ''}`}
      >
        <div
          className={`rounded-xl border p-4 md:p-5 transition-all duration-300 ${
            isActive
              ? 'border-border bg-surface-0 shadow-lg ring-1'
              : isCompleted
                ? 'border-gain/20 bg-gain/[0.03]'
                : isLocked
                  ? 'border-border/50 bg-surface-1/30 opacity-60'
                  : 'border-border bg-surface-0 shadow-sm'
          }`}
          style={isActive ? { ringColor: `${config.color}40` } : {}}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-display font-bold uppercase tracking-wider"
                  style={{ color: isCompleted ? '#16A34A' : isLocked ? '#94A3B8' : config.color }}
                >
                  Step {index + 1}
                </span>
                {isCompleted && (
                  <span className="text-[10px] font-display font-semibold text-gain bg-gain/10 px-1.5 py-0.5 rounded">
                    Complete
                  </span>
                )}
                {isInProgress && (
                  <span
                    className="text-[10px] font-display font-semibold px-1.5 py-0.5 rounded"
                    style={{ color: config.color, backgroundColor: `${config.color}15` }}
                  >
                    Active
                  </span>
                )}
              </div>
              <h3
                className={`text-sm md:text-base font-display font-bold ${
                  isLocked ? 'text-slate-400' : 'text-slate-900'
                }`}
              >
                {step.title}
              </h3>
              <p
                className={`text-xs font-body mt-0.5 ${
                  isLocked ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {step.subtitle}
              </p>
            </div>
          </div>

          {!isLocked && (
            <div className="mt-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-lg md:text-xl font-display font-bold text-slate-900">
                  {step.metric.format === 'currency'
                    ? formatCurrency(step.metric.current)
                    : step.metric.current}
                </span>
                {step.metric.target !== null && (
                  <span className="text-xs font-body text-slate-400">
                    of {formatCurrency(step.metric.target)}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-body text-slate-400 -mt-1 mb-2">
                {step.metric.label}
              </p>

              {progress !== null && (
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, delay: 0.3 + index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: isCompleted ? '#16A34A' : config.color,
                    }}
                  />
                </div>
              )}

              {!isCompleted && (
                <button
                  onClick={handleAction}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-display font-semibold transition-colors duration-200 cursor-pointer group"
                  style={{ color: config.color }}
                >
                  {step.action.label}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function OnboardingBanner({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border border-cyan/30 bg-gradient-to-br from-cyan/10 via-surface-0 to-surface-0 p-6 md:p-8 mb-6 shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        <div className="w-12 h-12 rounded-2xl bg-cyan/15 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-6 h-6 text-cyan" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-display font-bold text-slate-900 mb-1">
            Start Your Financial Journey
          </h2>
          <p className="text-sm font-body text-slate-500 max-w-lg">
            Share your financial details with the AI advisor to unlock your personalised roadmap. 
            Upload documents or chat about your income, expenses, and goals.
          </p>
        </div>
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan text-white text-sm font-display font-semibold shadow-sm hover:bg-cyan/90 transition-colors cursor-pointer flex-shrink-0"
        >
          Talk to Advisor
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

function SummaryBar({ summary }: { summary: RoadmapSummary }) {
  const hasData = Object.values(summary).some((v) => v > 0)
  if (!hasData) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6"
    >
      {SUMMARY_ITEMS.map((item, i) => {
        const val = summary[item.key]
        if (val === 0 && item.key !== 'savings_rate') return null
        const ItemIcon = item.icon
        return (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
            className="rounded-xl border border-border bg-surface-0 px-3.5 py-3 shadow-sm"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <ItemIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-body text-slate-400 uppercase tracking-wide">
                {item.label}
              </span>
            </div>
            <p className="text-base font-display font-bold text-slate-900">
              {item.format === 'currency'
                ? formatCurrency(val)
                : `${val.toFixed(1)}%`}
            </p>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

export function Roadmap() {
  const navigate = useNavigate()
  const { onMobileMenuToggle } = useLayoutContext()
  const [data, setData] = useState<RoadmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/advisor/roadmap`, {
          headers: getAuthHeaders(),
        })
        if (!res.ok) throw new Error(`Failed to load roadmap: ${res.status}`)
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load roadmap')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const completedCount = data?.steps.filter((s) => s.status === 'completed').length ?? 0
  const totalSteps = data?.steps.length ?? 0

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Financial Roadmap" subtitle="Your wealth-building journey" onMenuToggle={onMobileMenuToggle} />

      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-32"
            >
              <div className="w-6 h-6 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <p className="text-sm font-body text-slate-500">{error}</p>
            </motion.div>
          ) : data ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-3xl mx-auto"
            >
              {!data.has_profile && (
                <OnboardingBanner onStart={() => navigate('/finance/advisor/financial')} />
              )}

              {data.has_profile && <SummaryBar summary={data.summary} />}

              {data.has_profile && totalSteps > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-3 mb-6"
                >
                  <div className="flex-1 h-1 rounded-full bg-surface-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(completedCount / totalSteps) * 100}%` }}
                      transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                      className="h-full rounded-full bg-gain"
                    />
                  </div>
                  <span className="text-xs font-display font-semibold text-slate-500 flex-shrink-0">
                    {completedCount}/{totalSteps}
                  </span>
                </motion.div>
              )}

              <div>
                {data.steps.map((step, i) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={i}
                    isActive={i === data.active_step}
                    totalSteps={data.steps.length}
                  />
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
