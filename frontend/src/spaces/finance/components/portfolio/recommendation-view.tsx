import { motion } from 'framer-motion'
import {
  PieChart as PieChartIcon,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  FileText,
  RefreshCw,
  MessageSquare,
  RotateCcw,
  TrendingUp,
  DollarSign,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import type { Recommendation } from '@/spaces/finance/stores/portfolio-store'

const COLORS = [
  '#00D4FF',
  '#00E599',
  '#F5A623',
  '#FF6B8A',
  '#A78BFA',
  '#38BDF8',
  '#FB923C',
  '#34D399',
  '#F472B6',
  '#818CF8',
]

function RiskBadge({ score }: { score: number }) {
  let color = 'bg-emerald-100 text-emerald-700 border-emerald-200'
  let label = 'Conservative'
  if (score > 3 && score <= 6) {
    color = 'bg-amber-100 text-amber-700 border-amber-200'
    label = 'Moderate'
  } else if (score > 6) {
    color = 'bg-red-100 text-red-700 border-red-200'
    label = 'Aggressive'
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-bold border ${color}`}>
      <ShieldCheck className="w-3.5 h-3.5" />
      {score}/10 — {label}
    </span>
  )
}

function RiskGauge({ score }: { score: number }) {
  const percentage = (score / 10) * 100
  let barColor = '#10B981'
  if (score > 3 && score <= 6) barColor = '#F59E0B'
  if (score > 6) barColor = '#EF4444'

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-body text-slate-500">Conservative</span>
        <span className="text-xs font-body text-slate-500">Aggressive</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
        />
      </div>
      <div className="text-center mt-2">
        <span className="text-2xl font-display font-bold text-slate-900">{score}</span>
        <span className="text-sm font-body text-slate-400">/10</span>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const data = payload[0].payload
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-lg px-3 py-2">
      <p className="text-xs font-display font-bold text-slate-900">{data.asset_class || data.fund || data.name}</p>
      <p className="text-xs font-body text-slate-500">
        {data.percentage !== undefined ? `${data.percentage}%` : `$${data.amount?.toLocaleString()}`}
      </p>
    </div>
  )
}

export function RecommendationView({
  recommendation,
  onRefine,
  onStartOver,
}: {
  recommendation: Recommendation
  onRefine: () => void
  onStartOver: () => void
}) {
  const allocationData = recommendation.allocation.map((a, i) => ({
    ...a,
    fill: COLORS[i % COLORS.length],
  }))

  const monthlyData = recommendation.monthly_plan.breakdown.map((b, i) => ({
    ...b,
    fill: COLORS[i % COLORS.length],
  }))

  const returnsData = [
    { name: 'Conservative', value: recommendation.expected_returns.conservative, fill: '#10B981' },
    { name: 'Moderate', value: recommendation.expected_returns.moderate, fill: '#F59E0B' },
    { name: 'Aggressive', value: recommendation.expected_returns.aggressive, fill: '#00D4FF' },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-4 md:px-8 md:py-8 space-y-6 md:space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan/10 border border-cyan/20 mb-4">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan" />
            </span>
            <span className="text-xs font-display font-medium text-cyan">Recommendation ready</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900 mb-2">
            Your Personalised Portfolio
          </h1>
          <div className="flex items-center justify-center gap-4 mb-2">
            <RiskBadge score={recommendation.risk_score} />
            <span className="text-sm font-display font-semibold text-slate-700">
              Expected: {recommendation.expected_returns.conservative}% – {recommendation.expected_returns.aggressive}% annually
            </span>
          </div>
          {recommendation.summary && (
            <p className="text-sm font-body text-slate-500 max-w-2xl mx-auto leading-relaxed mt-3">
              {recommendation.summary}
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <PieChartIcon className="w-5 h-5 text-cyan" />
            <h2 className="text-base font-display font-bold text-slate-900">Asset Allocation</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 md:gap-8 items-start">
            <div className="flex justify-center">
              <ResponsiveContainer width={260} height={260}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="percentage"
                    strokeWidth={0}
                    animationDuration={800}
                  >
                    {allocationData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {allocationData.map((a, i) => (
                <motion.div
                  key={a.asset_class}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  className="flex items-start gap-3 group"
                >
                  <div className="w-3 h-3 rounded-sm mt-1 flex-shrink-0" style={{ backgroundColor: a.fill }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-display font-bold text-slate-900">
                        {a.asset_class}
                      </span>
                      <span className="text-sm font-display font-bold text-slate-900 tabular-nums">
                        {a.percentage}%
                      </span>
                    </div>
                    <div className="text-xs font-body text-cyan font-medium mt-0.5">
                      {a.funds.join(', ')}
                    </div>
                    <p className="text-xs font-body text-slate-400 leading-relaxed mt-0.5 line-clamp-2">
                      {a.rationale}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {recommendation.monthly_plan.breakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-display font-bold text-slate-900">Monthly Investment Plan</h2>
              </div>
              <span className="text-lg font-display font-bold text-slate-900">
                ${recommendation.monthly_plan.total.toLocaleString()}/mo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4 md:gap-6 items-center">
              <div className="space-y-2">
                {monthlyData.map((b, i) => (
                  <motion.div
                    key={b.fund}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: b.fill }} />
                    <span className="text-sm font-display font-semibold text-slate-700 w-16">{b.fund}</span>
                    <div className="flex-1 h-7 rounded-lg bg-slate-50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${recommendation.monthly_plan.total > 0 ? (b.amount / recommendation.monthly_plan.total) * 100 : 0}%`,
                        }}
                        transition={{ duration: 0.6, delay: 0.3 + i * 0.05, ease: 'easeOut' }}
                        className="h-full rounded-lg flex items-center px-2"
                        style={{ backgroundColor: `${b.fill}20` }}
                      >
                        <span className="text-xs font-display font-bold" style={{ color: b.fill }}>
                          ${b.amount.toLocaleString()}
                        </span>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthlyData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="fund" width={44} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} animationDuration={600}>
                    {monthlyData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-display font-bold text-slate-900">Risk Analysis</h2>
            </div>

            <RiskGauge score={recommendation.risk_score} />

            {recommendation.risk_analysis && (
              <p className="text-xs font-body text-slate-500 leading-relaxed mt-4 border-t border-slate-100 pt-4">
                {recommendation.risk_analysis.slice(0, 400)}
                {recommendation.risk_analysis.length > 400 && '...'}
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-5 h-5 text-cyan" />
              <h2 className="text-base font-display font-bold text-slate-900">Expected Returns</h2>
            </div>

            <div className="space-y-3">
              {returnsData.map((r) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="text-xs font-display font-semibold text-slate-500 w-24">{r.name}</span>
                  <div className="flex-1 h-8 rounded-lg bg-slate-50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((r.value / 15) * 100, 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
                      className="h-full rounded-lg flex items-center px-3"
                      style={{ backgroundColor: `${r.fill}18` }}
                    >
                      <span className="text-sm font-display font-bold" style={{ color: r.fill }}>
                        {r.value}%
                      </span>
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {recommendation.key_risks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-display font-bold text-slate-900">Key Risks</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recommendation.key_risks.map((risk, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + i * 0.05 }}
                  className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50/50 border border-amber-100"
                >
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-xs font-body text-slate-600 leading-relaxed">{risk}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recommendation.tax_notes && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-slate-400" />
                <h2 className="text-sm font-display font-bold text-slate-900">Tax Optimisation</h2>
              </div>
              <p className="text-xs font-body text-slate-500 leading-relaxed">
                {recommendation.tax_notes}
              </p>
            </motion.div>
          )}

          {recommendation.rebalancing_schedule && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <h2 className="text-sm font-display font-bold text-slate-900">Rebalancing</h2>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan" />
                <span className="text-sm font-display font-semibold text-slate-700">
                  {recommendation.rebalancing_schedule}
                </span>
              </div>
              <p className="text-xs font-body text-slate-400 mt-1.5">
                Review and rebalance your portfolio on this schedule to maintain target allocations.
              </p>
            </motion.div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 pb-8"
        >
          <button
            onClick={onRefine}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan text-white text-sm font-display font-semibold shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            Refine your recommendation
          </button>
          <button
            onClick={onStartOver}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 text-sm font-display font-semibold text-slate-600 hover:border-slate-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Start Over
          </button>
        </motion.div>
      </div>
    </div>
  )
}
