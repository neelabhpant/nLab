import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Target,
  Sparkles,
  Shield,
  ShieldCheck,
  ShieldX,
  Check,
  X as XIcon,
  Pencil,
  Play,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Plus,
} from 'lucide-react'
import { useTradingStore } from '@/spaces/finance/stores/trading-store'
import type { TradeProposal } from '@/spaces/finance/stores/trading-store'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { TradeConfirmationModal } from '@/spaces/finance/components/trading/trade-confirmation-modal'

const RISK_OPTIONS = [
  { value: 'low' as const, label: 'Conservative', color: 'text-cyan', bg: 'bg-cyan/10', border: 'border-cyan/30', activeBg: 'bg-cyan text-white' },
  { value: 'moderate' as const, label: 'Moderate', color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/30', activeBg: 'bg-amber-500 text-white' },
  { value: 'aggressive' as const, label: 'Aggressive', color: 'text-loss', bg: 'bg-loss/10', border: 'border-loss/30', activeBg: 'bg-loss text-white' },
]

const LOADING_MESSAGES = [
  'Analyzing portfolio...',
  'Fetching market quotes...',
  'Reviewing market news...',
  'Generating strategy...',
  'Reviewing risk...',
]

const PROPOSAL_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-600' },
  approved: { bg: 'bg-gain/10', text: 'text-gain' },
  rejected: { bg: 'bg-loss/10', text: 'text-loss' },
  executed: { bg: 'bg-cyan/10', text: 'text-cyan' },
}

function ProposalStatusBadge({ status }: { status: string }) {
  const style = PROPOSAL_STATUS_STYLE[status] ?? PROPOSAL_STATUS_STYLE.pending
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${style.bg} ${style.text} capitalize`}>
      {status}
    </span>
  )
}

function RiskLevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    low: 'bg-cyan/10 text-cyan',
    medium: 'bg-amber-500/10 text-amber-600',
    high: 'bg-loss/10 text-loss',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${styles[level] ?? styles.medium} capitalize`}>
      <Shield className="w-3 h-3" />
      {level} risk
    </span>
  )
}

export function TradingAgents() {
  const { onMobileMenuToggle } = useLayoutContext()
  const {
    objective,
    proposals,
    objectiveLoading,
    generatingProposals,
    proposalExecuting,
    orderSuccess,
    orderError,
    fetchObjective,
    saveObjective,
    generateProposals,
    fetchProposals,
    approveProposal,
    rejectProposal,
    executeProposal,
    clearOrderFeedback,
  } = useTradingStore()

  const [editing, setEditing] = useState(false)
  const [goal, setGoal] = useState('')
  const [targetReturn, setTargetReturn] = useState('10')
  const [timeframeDays, setTimeframeDays] = useState('90')
  const [riskTolerance, setRiskTolerance] = useState<'low' | 'moderate' | 'aggressive'>('moderate')
  const [maxPositionPct, setMaxPositionPct] = useState('30')
  const [maxDailyLossPct, setMaxDailyLossPct] = useState('2')
  const [assetInput, setAssetInput] = useState('')
  const [assets, setAssets] = useState<string[]>([])
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [executeTarget, setExecuteTarget] = useState<TradeProposal | null>(null)

  useEffect(() => {
    fetchObjective()
    fetchProposals()
  }, [fetchObjective, fetchProposals])

  useEffect(() => {
    if (objective && !editing) {
      setGoal(objective.goal)
      setTargetReturn(String(objective.target_return_pct))
      setTimeframeDays(String(objective.timeframe_days))
      setRiskTolerance(objective.risk_tolerance)
      setMaxPositionPct(String(objective.max_position_pct))
      setMaxDailyLossPct(String(objective.max_daily_loss_pct))
      setAssets(objective.asset_universe)
    }
  }, [objective, editing])

  useEffect(() => {
    if (!generatingProposals) return
    setLoadingMsgIdx(0)
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [generatingProposals])

  useEffect(() => {
    if (orderSuccess || orderError) {
      const t = setTimeout(clearOrderFeedback, 4000)
      return () => clearTimeout(t)
    }
  }, [orderSuccess, orderError, clearOrderFeedback])

  const handleSaveObjective = useCallback(async () => {
    const success = await saveObjective({
      goal,
      target_return_pct: parseFloat(targetReturn) || 10,
      timeframe_days: parseInt(timeframeDays) || 90,
      risk_tolerance: riskTolerance,
      max_position_pct: parseFloat(maxPositionPct) || 30,
      asset_universe: assets,
      max_daily_loss_pct: parseFloat(maxDailyLossPct) || 2,
    })
    if (success) setEditing(false)
  }, [goal, targetReturn, timeframeDays, riskTolerance, maxPositionPct, maxDailyLossPct, assets, saveObjective])

  const handleAddAsset = useCallback(() => {
    const sym = assetInput.trim().toUpperCase()
    if (sym && !assets.includes(sym)) {
      setAssets((prev) => [...prev, sym])
    }
    setAssetInput('')
  }, [assetInput, assets])

  const handleRemoveAsset = (sym: string) => {
    setAssets((prev) => prev.filter((a) => a !== sym))
  }

  const handleExecuteConfirm = useCallback(async () => {
    if (!executeTarget) return
    await executeProposal(executeTarget.id)
    setExecuteTarget(null)
  }, [executeTarget, executeProposal])

  const showForm = !objective || editing

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="AI Trading Agents" subtitle="Objective-driven · Human approval" onMenuToggle={onMobileMenuToggle} />

      <div className="flex-1 overflow-auto p-3 md:p-6 lg:p-8">
        <AnimatePresence>
          {(orderSuccess || orderError) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mb-4 px-4 py-3 rounded-lg text-sm font-body flex items-center justify-between ${
                orderSuccess ? 'bg-gain/10 text-gain border border-gain/20' : 'bg-loss/10 text-loss border border-loss/20'
              }`}
            >
              <span>{orderSuccess || orderError}</span>
              <button onClick={clearOrderFeedback} className="cursor-pointer">
                <XIcon className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-4xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-xl border border-border bg-surface-0 shadow-md overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan via-purple-500 to-pink-500" />
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan" />
                <h2 className="text-base font-display font-semibold text-slate-900">Trading Objective</h2>
              </div>
              {objective && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-xs font-display font-medium text-slate-500 hover:text-cyan transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
            </div>

            <div className="p-5">
              {objectiveLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                </div>
              ) : showForm ? (
                <div className="space-y-5">
                  <div>
                    <label className="text-[11px] font-body text-slate-400 uppercase tracking-wider mb-1.5 block">Goal</label>
                    <input
                      type="text"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      placeholder="e.g. Build a diversified growth portfolio"
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-1 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] font-body text-slate-400 uppercase tracking-wider mb-1.5 block">Target Return %</label>
                      <input
                        type="number"
                        value={targetReturn}
                        onChange={(e) => setTargetReturn(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-1 text-sm font-display font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-body text-slate-400 uppercase tracking-wider mb-1.5 block">Timeframe (days)</label>
                      <input
                        type="number"
                        value={timeframeDays}
                        onChange={(e) => setTimeframeDays(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-1 text-sm font-display font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-body text-slate-400 uppercase tracking-wider mb-1.5 block">Max Position %</label>
                      <input
                        type="number"
                        value={maxPositionPct}
                        onChange={(e) => setMaxPositionPct(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-1 text-sm font-display font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-body text-slate-400 uppercase tracking-wider mb-1.5 block">Max Daily Loss %</label>
                    <input
                      type="number"
                      value={maxDailyLossPct}
                      onChange={(e) => setMaxDailyLossPct(e.target.value)}
                      className="w-48 px-3 py-2.5 rounded-lg border border-border bg-surface-1 text-sm font-display font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-body text-slate-400 uppercase tracking-wider mb-1.5 block">Risk Tolerance</label>
                    <div className="flex items-center gap-2">
                      {RISK_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setRiskTolerance(opt.value)}
                          className={`px-4 py-2 rounded-lg text-sm font-display font-semibold transition-all cursor-pointer ${
                            riskTolerance === opt.value
                              ? opt.activeBg + ' shadow-md'
                              : opt.bg + ' ' + opt.color + ' border ' + opt.border + ' hover:opacity-80'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-body text-slate-400 uppercase tracking-wider mb-1.5 block">Asset Universe</label>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={assetInput}
                        onChange={(e) => setAssetInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddAsset()}
                        placeholder="Add symbol (e.g. VOO)"
                        className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-surface-1 text-sm font-display font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan transition-colors"
                      />
                      <button
                        onClick={handleAddAsset}
                        className="p-2.5 rounded-lg bg-cyan text-white hover:bg-cyan/90 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {assets.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {assets.map((sym) => (
                          <span
                            key={sym}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-1 border border-border text-sm font-display font-medium text-slate-700"
                          >
                            {sym}
                            <button onClick={() => handleRemoveAsset(sym)} className="text-slate-400 hover:text-loss transition-colors cursor-pointer">
                              <XIcon className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {assets.length === 0 && (
                      <p className="text-xs text-slate-400 font-body">Leave empty to allow any US stocks/ETFs</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleSaveObjective}
                      disabled={!goal.trim()}
                      className="px-6 py-2.5 rounded-lg bg-cyan text-white text-sm font-display font-semibold hover:bg-cyan/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save Objective
                    </button>
                    {editing && (
                      <button
                        onClick={() => setEditing(false)}
                        className="px-4 py-2.5 rounded-lg border border-border text-sm font-display font-medium text-slate-500 hover:bg-surface-1 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-body text-slate-700">{objective.goal}</p>
                  <div className="flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-display font-medium px-3 py-1.5 rounded-lg bg-gain/10 text-gain border border-gain/20">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {objective.target_return_pct}% target
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-display font-medium px-3 py-1.5 rounded-lg bg-surface-1 text-slate-600 border border-border">
                      <Clock className="w-3.5 h-3.5" />
                      {objective.timeframe_days} days
                    </span>
                    {RISK_OPTIONS.filter((r) => r.value === objective.risk_tolerance).map((r) => (
                      <span key={r.value} className={`inline-flex items-center gap-1.5 text-xs font-display font-medium px-3 py-1.5 rounded-lg ${r.bg} ${r.color} border ${r.border}`}>
                        <Shield className="w-3.5 h-3.5" />
                        {r.label}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1.5 text-xs font-display font-medium px-3 py-1.5 rounded-lg bg-surface-1 text-slate-600 border border-border">
                      Max {objective.max_position_pct}% / position
                    </span>
                  </div>
                  {objective.asset_universe.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {objective.asset_universe.map((sym) => (
                        <span key={sym} className="text-xs font-display font-semibold px-2 py-0.5 rounded bg-surface-1 text-slate-600">
                          {sym}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {objective && !editing && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <button
                onClick={() => generateProposals()}
                disabled={generatingProposals}
                className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-cyan to-blue-600 text-white text-sm font-display font-semibold shadow-lg hover:shadow-xl hover:brightness-110 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generatingProposals ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={loadingMsgIdx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3 }}
                      >
                        {LOADING_MESSAGES[loadingMsgIdx]}
                      </motion.span>
                    </AnimatePresence>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Trade Proposals
                  </>
                )}
              </button>
            </motion.div>
          )}

          {proposals.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-5 h-5 text-cyan" />
                <h2 className="text-base font-display font-semibold text-slate-900">Trade Proposals</h2>
                <span className="text-xs font-body text-slate-400 ml-auto">
                  {proposals.filter((p) => p.status === 'pending').length} pending review
                </span>
              </div>

              <div className="space-y-3">
                {proposals.map((proposal, i) => (
                  <motion.div
                    key={proposal.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                    className="rounded-xl border border-border bg-surface-0 shadow-sm overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-display font-bold px-2.5 py-1 rounded-md uppercase ${
                            proposal.action === 'buy'
                              ? 'bg-gain/10 text-gain'
                              : 'bg-loss/10 text-loss'
                          }`}>
                            {proposal.action === 'buy' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {proposal.action}
                          </span>
                          <span className="text-lg font-display font-bold text-slate-900">{proposal.symbol}</span>
                          <span className="text-sm font-body text-slate-500">{proposal.qty} shares</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <RiskLevelBadge level={proposal.risk_level} />
                          <ProposalStatusBadge status={proposal.status} />
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-start gap-2">
                          <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm font-body text-slate-700">{proposal.rationale}</p>
                        </div>
                        {proposal.risk_review && (
                          <div className="flex items-start gap-2">
                            <ShieldCheck className="w-4 h-4 text-cyan mt-0.5 flex-shrink-0" />
                            <p className="text-xs font-body text-slate-500">{proposal.risk_review}</p>
                          </div>
                        )}
                        {proposal.expected_impact && (
                          <div className="flex items-start gap-2">
                            <Target className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs font-body text-slate-500">{proposal.expected_impact}</p>
                          </div>
                        )}
                      </div>

                      {proposal.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveProposal(proposal.id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gain text-white text-xs font-display font-semibold hover:bg-gain/90 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => rejectProposal(proposal.id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-loss/10 text-loss text-xs font-display font-semibold hover:bg-loss/20 transition-colors cursor-pointer"
                          >
                            <ShieldX className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      )}

                      {proposal.status === 'approved' && (
                        <button
                          onClick={() => setExecuteTarget(proposal)}
                          disabled={proposalExecuting === proposal.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan text-white text-xs font-display font-semibold hover:bg-cyan/90 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {proposalExecuting === proposal.id ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              Executing...
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              Execute Trade
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {!generatingProposals && proposals.length === 0 && objective && !editing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center py-12"
            >
              <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-body">No proposals yet. Click the button above to generate AI trade proposals.</p>
            </motion.div>
          )}
        </div>
      </div>

      {executeTarget && (
        <TradeConfirmationModal
          open={!!executeTarget}
          symbol={executeTarget.symbol}
          qty={executeTarget.qty}
          side={executeTarget.action === 'buy' ? 'buy' : 'sell'}
          submitting={proposalExecuting === executeTarget.id}
          onConfirm={handleExecuteConfirm}
          onCancel={() => setExecuteTarget(null)}
        />
      )}
    </div>
  )
}
