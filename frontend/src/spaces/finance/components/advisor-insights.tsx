import { motion } from 'framer-motion'
import {
  TrendingUp,
  PiggyBank,
  Shield,
  Target,
  Lightbulb,
  FileText,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import type { UserProfile } from '@/spaces/finance/stores/advisor-store'

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
  sub?: string
  color: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-xl border border-border bg-surface-0 p-3"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-3 h-3" style={{ color }} />
        </div>
        <span className="text-[11px] font-display font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-lg font-display font-bold text-slate-800 pl-0.5">{value}</p>
      {sub && (
        <p className="text-[11px] font-body text-slate-400 mt-0.5 pl-0.5">{sub}</p>
      )}
    </motion.div>
  )
}

function TipItem({ icon: Icon, text, delay }: { icon: typeof Lightbulb; text: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay }}
      className="flex items-start gap-2.5 py-1.5"
    >
      <Icon className="w-3.5 h-3.5 text-cyan flex-shrink-0 mt-0.5" />
      <p className="text-xs font-body text-slate-500 leading-snug">{text}</p>
    </motion.div>
  )
}

function sumNumericValues(obj: Record<string, unknown> | undefined | null, exclude: string[] = []): number {
  if (!obj || typeof obj !== 'object') return 0
  return Object.entries(obj).reduce((sum, [k, v]) => {
    if (exclude.includes(k)) return sum
    if (typeof v === 'number' && v > 0) return sum + v
    return sum
  }, 0)
}

function getMonthlyIncome(profile: UserProfile): number {
  const inc = profile?.income
  if (!inc || typeof inc !== 'object') return 0
  if (typeof inc.total_monthly === 'number' && inc.total_monthly > 0) return inc.total_monthly
  if (typeof inc.monthly_income === 'number' && inc.monthly_income > 0) return inc.monthly_income
  if (typeof inc.annual_salary === 'number' && inc.annual_salary > 0) return Math.round(inc.annual_salary / 12)
  return sumNumericValues(inc as Record<string, unknown>)
}

function getMonthlyExpenses(profile: UserProfile): number {
  const exp = profile?.expenses
  if (!exp || typeof exp !== 'object') return 0
  if (typeof exp.total_monthly === 'number' && exp.total_monthly > 0) return exp.total_monthly
  return sumNumericValues(exp as Record<string, unknown>)
}

function getTotalAssets(profile: UserProfile): number {
  const section = profile?.assets
  if (!section || typeof section !== 'object') return 0
  let total = 0
  const accounts = Array.isArray(section.accounts) ? section.accounts : []
  for (const a of accounts) {
    if (a && typeof a === 'object' && typeof a.balance === 'number') total += a.balance
  }
  for (const [k, v] of Object.entries(section)) {
    if (k === 'accounts') continue
    if (typeof v === 'number' && v > 0) total += v
  }
  return total
}

function getTotalDebt(profile: UserProfile): number {
  const debts = profile?.debts
  if (!Array.isArray(debts)) return 0
  return debts.reduce((s: number, d: Record<string, number>) => s + (d.balance ?? 0), 0)
}

function getTopGoal(profile: UserProfile | null): { name?: string; type?: string; target_amount?: number; primary_goal?: string } | null {
  if (!profile) return null
  const goals = profile.goals
  if (Array.isArray(goals) && goals.length > 0) return goals[0]
  if (goals && typeof goals === 'object' && !Array.isArray(goals)) {
    const g = goals as Record<string, unknown>
    if (g.primary_goal) return { name: String(g.primary_goal), type: 'primary' }
  }
  return null
}

function computeInsights(profile: UserProfile | null) {
  if (!profile) return { savingsRate: null, debtToIncome: null, emergencyMonths: null, topGoal: null, hasData: false }

  const monthlyIncome = getMonthlyIncome(profile)
  const expenses = getMonthlyExpenses(profile)
  const totalBalance = getTotalAssets(profile)
  const totalDebt = getTotalDebt(profile)
  const annualIncome = monthlyIncome * 12

  const savingsRate =
    monthlyIncome > 0 && expenses > 0
      ? Math.round(((monthlyIncome - expenses) / monthlyIncome) * 100)
      : null

  const debtToIncome =
    annualIncome > 0 && totalDebt > 0 ? Math.round((totalDebt / annualIncome) * 100) : null

  const emergencyMonths =
    expenses > 0 && totalBalance > 0
      ? Math.round((totalBalance / expenses) * 10) / 10
      : null

  const topGoal = getTopGoal(profile)

  return { savingsRate, debtToIncome, emergencyMonths, topGoal, hasData: monthlyIncome > 0 || totalBalance > 0 || totalDebt > 0 }
}

function InsightsContent({ profile }: { profile: UserProfile | null }) {
  const { savingsRate, debtToIncome, emergencyMonths, topGoal, hasData } =
    computeInsights(profile)

  if (!hasData) return null

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wider">
        Quick Insights
      </h3>

      {savingsRate !== null && (
        <StatCard
          icon={PiggyBank}
          label="Savings Rate"
          value={`${savingsRate}%`}
          sub={savingsRate >= 20 ? 'On track' : 'Below 20% target'}
          color={savingsRate >= 20 ? '#00E599' : '#F5A623'}
          delay={0}
        />
      )}

      {debtToIncome !== null && (
        <StatCard
          icon={TrendingUp}
          label="Debt-to-Income"
          value={`${debtToIncome}%`}
          sub={debtToIncome <= 36 ? 'Healthy range' : 'Above recommended 36%'}
          color={debtToIncome <= 36 ? '#00E599' : '#EF4444'}
          delay={0.05}
        />
      )}

      {emergencyMonths !== null && (
        <StatCard
          icon={Shield}
          label="Emergency Fund"
          value={`${emergencyMonths} mo`}
          sub={emergencyMonths >= 6 ? 'Well-funded' : 'Target: 6 months'}
          color={emergencyMonths >= 6 ? '#00E599' : '#F5A623'}
          delay={0.1}
        />
      )}

      {topGoal && (
        <StatCard
          icon={Target}
          label="Top Goal"
          value={topGoal.name ?? topGoal.primary_goal ?? topGoal.type ?? 'Financial Goal'}
          sub={topGoal.target_amount ? `Target: $${Number(topGoal.target_amount).toLocaleString()}` : undefined}
          color="#00D4FF"
          delay={0.15}
        />
      )}
    </div>
  )
}

function GettingStarted({ onSuggestionClick }: { onSuggestionClick?: (s: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Getting Started
        </h3>
        <div className="space-y-0.5">
          <TipItem icon={MessageSquare} text="Share your income and monthly expenses in the chat" delay={0} />
          <TipItem icon={FileText} text="Upload financial documents like tax returns or bank statements" delay={0.05} />
          <TipItem icon={Target} text="Tell the advisor about your financial goals" delay={0.1} />
          <TipItem icon={Sparkles} text="Your profile builds automatically as you chat" delay={0.15} />
        </div>
      </div>

      {onSuggestionClick && (
        <div>
          <h3 className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Try Asking
          </h3>
          <div className="space-y-1.5">
            {[
              'How much should I save each month?',
              'Am I on track for retirement?',
              'Help me pay off my debt faster',
            ].map((s, i) => (
              <motion.button
                key={s}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: 0.2 + i * 0.05 }}
                onClick={() => onSuggestionClick(s)}
                className="block w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-body text-slate-500 hover:text-cyan hover:bg-cyan/5 transition-all cursor-pointer"
              >
                {s}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function AdvisorInsights({ profile, onSuggestionClick }: {
  profile: UserProfile | null
  onSuggestionClick?: (s: string) => void
}) {
  const { hasData } = computeInsights(profile)

  return (
    <div className="p-4 space-y-4">
      {hasData && <InsightsContent profile={profile} />}

      {!hasData && <GettingStarted onSuggestionClick={onSuggestionClick} />}

      {hasData && (
        <div>
          <h3 className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Suggested Topics
          </h3>
          <div className="space-y-1.5">
            {[
              'Optimize my savings strategy',
              'Review my investment allocation',
              'Create a debt payoff plan',
            ].map((s) => (
              <button
                key={s}
                onClick={() => onSuggestionClick?.(s)}
                className="block w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-body text-slate-500 hover:text-cyan hover:bg-cyan/5 transition-all cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
