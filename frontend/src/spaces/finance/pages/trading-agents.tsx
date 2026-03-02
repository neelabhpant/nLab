import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Plus,
  ChevronDown,
  Trash2,
  History,
  Activity,
  Crosshair,
  Users,
  Search,
  Brain,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Wrench,
} from 'lucide-react'
import { useTradingStore } from '@/spaces/finance/stores/trading-store'
import type { TradeProposal, AgentEvent } from '@/spaces/finance/stores/trading-store'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { TradeConfirmationModal } from '@/spaces/finance/components/trading/trade-confirmation-modal'

function extractBullets(text: string, max = 3): string[] {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\{[\s\S]*?\}/g, '')
    .replace(/#+\s/g, '')
    .replace(/\*\*/g, '')
  const lines = cleaned
    .split(/[\n•\-\d+\.]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 15 && l.length < 200 && !l.startsWith('{') && !l.startsWith('['))
  const unique = [...new Set(lines)]
  return unique.slice(0, max)
}

const RISK_OPTIONS = [
  { value: 'low' as const, label: 'Conservative', color: 'text-cyan', bg: 'bg-cyan/10', border: 'border-cyan/30', activeBg: 'bg-cyan text-white' },
  { value: 'moderate' as const, label: 'Moderate', color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/30', activeBg: 'bg-amber-500 text-white' },
  { value: 'aggressive' as const, label: 'Aggressive', color: 'text-loss', bg: 'bg-loss/10', border: 'border-loss/30', activeBg: 'bg-loss text-white' },
]

const AGENT_ICONS: Record<string, typeof Bot> = {
  'Senior Market Analyst': Search,
  'Technical Analyst': Activity,
  'Portfolio Strategist': Target,
  'Risk Manager': Shield,
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
  'Senior Market Analyst': 'Scanning portfolio, market regime, and news catalysts...',
  'Technical Analyst': 'Computing RSI, MACD, Bollinger Bands, and support/resistance levels...',
  'Portfolio Strategist': 'Synthesizing analysis into actionable trade proposals...',
  'Risk Manager': 'Validating position limits, risk/reward ratios, and diversification...',
}

const AGENT_COLORS: Record<string, { bg: string; text: string; glow: string; border: string }> = {
  'Senior Market Analyst': { bg: 'bg-blue-500', text: 'text-blue-600', glow: 'shadow-blue-500/30', border: 'border-blue-500/30' },
  'Technical Analyst': { bg: 'bg-cyan', text: 'text-cyan', glow: 'shadow-cyan/30', border: 'border-cyan/30' },
  'Portfolio Strategist': { bg: 'bg-amber-500', text: 'text-amber-600', glow: 'shadow-amber-500/30', border: 'border-amber-500/30' },
  'Risk Manager': { bg: 'bg-purple-500', text: 'text-purple-600', glow: 'shadow-purple-500/30', border: 'border-purple-500/30' },
}

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

function RiskMeter({ level }: { level: string }) {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1
  const colors = { low: 'text-cyan', medium: 'text-amber-500', high: 'text-loss' }
  const color = colors[level as keyof typeof colors] ?? colors.medium
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className={`text-[10px] ${i < filled ? color : 'text-slate-200'}`}>●</span>
      ))}
      <span className={`text-[10px] font-display font-medium ml-1 capitalize ${color}`}>{level}</span>
    </div>
  )
}

function ConfidenceMeter({ value }: { value: number }) {
  const color = value >= 75 ? 'bg-gain' : value >= 50 ? 'bg-amber-500' : 'bg-loss'
  const textColor = value >= 75 ? 'text-gain' : value >= 50 ? 'text-amber-600' : 'text-loss'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-display font-bold tabular-nums ${textColor}`}>{value}</span>
    </div>
  )
}

function PriceRangeBar({
  entry,
  target,
  stopLoss,
  isBuy,
}: {
  entry: number | null
  target: number | null
  stopLoss: number | null
  isBuy: boolean
}) {
  if (!entry || !target || !stopLoss) return null
  const riskReward = Math.abs(target - entry) / Math.abs(entry - stopLoss)
  return (
    <div className="flex items-center gap-3 text-[11px] font-display tabular-nums">
      <div className="flex items-center gap-1 text-loss">
        <span className="text-slate-400">SL</span>
        <span className="font-bold">${stopLoss.toFixed(2)}</span>
      </div>
      <div className="flex-1 relative h-1.5 bg-slate-100 rounded-full">
        <div className={`absolute inset-y-0 rounded-full ${isBuy ? 'bg-gradient-to-r from-loss/40 via-amber-300 to-gain/60' : 'bg-gradient-to-r from-gain/60 via-amber-300 to-loss/40'}`} style={{ left: '0%', right: '0%' }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-slate-700 rounded-full" style={{ left: '50%', transform: 'translate(-50%, -50%)' }} />
      </div>
      <div className="flex items-center gap-1 text-gain">
        <span className="text-slate-400">TP</span>
        <span className="font-bold">${target.toFixed(2)}</span>
      </div>
      <span className="text-[10px] text-slate-400 ml-1">{riskReward.toFixed(1)}:1</span>
    </div>
  )
}

function AgentActivityPanel({
  agentRoles,
  activeAgentIndex,
  events,
  done,
}: {
  agentRoles: string[]
  activeAgentIndex: number
  events: AgentEvent[]
  done: boolean
}) {
  const getAgentEvents = (role: string) =>
    events.filter((e) => e.agent === role && e.event !== 'heartbeat' && e.event !== 'agent_start')

  const getAgentStatus = (idx: number): 'waiting' | 'active' | 'done' => {
    if (done) return 'done'
    if (idx < activeAgentIndex) return 'done'
    if (idx === activeAgentIndex) return 'active'
    return 'waiting'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-xl border border-border bg-surface-0 shadow-lg overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-border bg-gradient-to-r from-slate-50 to-surface-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4.5 h-4.5 text-purple-500" />
          <h3 className="text-sm font-display font-semibold text-slate-900">Agent Activity</h3>
          {!done && (
            <span className="ml-auto flex items-center gap-1.5 text-[11px] font-display font-medium text-cyan">
              <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
              Live
            </span>
          )}
          {done && (
            <span className="ml-auto flex items-center gap-1.5 text-[11px] font-display font-medium text-gain">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Complete
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-0">
          {agentRoles.map((role, idx) => {
            const status = getAgentStatus(idx)
            const IconComp = AGENT_ICONS[role] || Bot
            const colors = AGENT_COLORS[role] || AGENT_COLORS['Senior Market Analyst']
            const agentEvts = getAgentEvents(role)
            const toolCalls = agentEvts.filter((e) => e.event === 'tool_call')
            const thoughts = agentEvts.filter((e) => e.event === 'thinking')
            const taskComplete = agentEvts.find((e) => e.event === 'task_complete')

            return (
              <div key={role} className="relative">
                {idx < agentRoles.length - 1 && (
                  <div className={`absolute left-[17px] top-[36px] w-0.5 bottom-0 ${
                    status === 'done' ? 'bg-gain/30' : status === 'active' ? `${colors.bg}/20` : 'bg-slate-100'
                  }`} />
                )}

                <div className="flex items-start gap-3 py-3">
                  <div className={`relative flex-shrink-0 w-[35px] h-[35px] rounded-full flex items-center justify-center transition-all duration-500 ${
                    status === 'active'
                      ? `${colors.bg} text-white shadow-lg ${colors.glow} ring-2 ring-offset-1 ring-offset-surface-0 ${colors.border.replace('border-', 'ring-')}`
                      : status === 'done'
                        ? 'bg-gain/10 text-gain'
                        : 'bg-slate-50 text-slate-300'
                  }`}>
                    {status === 'active' && (
                      <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-current" />
                    )}
                    {status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <IconComp className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-display font-bold ${
                        status === 'active' ? colors.text : status === 'done' ? 'text-slate-700' : 'text-slate-300'
                      }`}>{role}</span>
                      {status === 'active' && (
                        <Loader2 className={`w-3 h-3 animate-spin ${colors.text}`} />
                      )}
                    </div>

                    {status === 'active' && (
                      <p className="text-[11px] font-body text-slate-400 italic mt-0.5">
                        {AGENT_DESCRIPTIONS[role] || 'Working...'}
                      </p>
                    )}

                    <AnimatePresence>
                      {status === 'active' && thoughts.length > 0 && (
                        <motion.p
                          key={thoughts[thoughts.length - 1].text}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-[11px] font-body text-slate-400 italic mt-0.5 line-clamp-1"
                        >
                          {thoughts[thoughts.length - 1].text}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {(status === 'active' || status === 'done') && toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {toolCalls.map((tc, tci) => (
                          <motion.span
                            key={tci}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`inline-flex items-center gap-1 text-[10px] font-display font-medium px-1.5 py-0.5 rounded ${
                              status === 'done' ? 'bg-slate-50 text-slate-400' : `${colors.bg}/10 ${colors.text}`
                            }`}
                          >
                            <Wrench className="w-2.5 h-2.5" />
                            {(tc.tool || '').replace('get_', '').replace(/_/g, ' ')}
                          </motion.span>
                        ))}
                      </div>
                    )}

                    {taskComplete && taskComplete.summary && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[11px] font-body text-gain mt-1 line-clamp-1"
                      >
                        Done
                      </motion.p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {done && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-3 pt-3 border-t border-border/50 text-center"
          >
            <p className="text-xs font-body text-slate-400">Analysis complete — proposals ready for review</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

function ProposalCard({
  proposal,
  index,
  proposalExecuting,
  onApprove,
  onReject,
  onExecute,
}: {
  proposal: TradeProposal
  index: number
  proposalExecuting: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onExecute: (p: TradeProposal) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isBuy = proposal.action === 'buy'
  const hasAgentReasoning = proposal.agent_reasoning && Object.keys(proposal.agent_reasoning).length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="group rounded-xl border border-border bg-surface-0 shadow-sm hover:shadow-lg hover:border-border/80 transition-all duration-200 overflow-hidden cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className={`h-1 ${isBuy ? 'bg-gradient-to-r from-gain to-emerald-400' : 'bg-gradient-to-r from-loss to-rose-400'}`} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 text-[10px] font-display font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                isBuy ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
              }`}>
                {isBuy ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {proposal.action}
              </span>
              <ProposalStatusBadge status={proposal.status} />
            </div>
            <h3 className="text-2xl font-display font-black text-slate-900 tracking-tight leading-none">{proposal.symbol}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-display font-medium text-slate-400">{proposal.qty} shares</span>
              {proposal.entry_price && (
                <span className="text-xs font-display font-medium text-slate-500">@ ${proposal.entry_price.toFixed(2)}</span>
              )}
            </div>
          </div>
          <div className="text-right space-y-1">
            <RiskMeter level={proposal.risk_level} />
            {proposal.time_horizon && (
              <div className="flex items-center gap-1 justify-end text-[10px] text-slate-400 font-display">
                <Clock className="w-2.5 h-2.5" />
                {proposal.time_horizon}
              </div>
            )}
          </div>
        </div>

        {(proposal.entry_price || proposal.price_target || proposal.stop_loss) && (
          <div className="mb-3">
            <PriceRangeBar entry={proposal.entry_price} target={proposal.price_target} stopLoss={proposal.stop_loss} isBuy={isBuy} />
          </div>
        )}

        {proposal.confidence > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Crosshair className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-display text-slate-400 uppercase tracking-wider">Confidence</span>
            </div>
            <ConfidenceMeter value={proposal.confidence} />
          </div>
        )}

        {proposal.technical_summary && (
          <div className="flex items-start gap-1.5 mb-2 px-2 py-1.5 bg-slate-50 rounded-lg">
            <Activity className="w-3 h-3 text-cyan mt-0.5 flex-shrink-0" />
            <p className="text-[11px] font-body text-slate-600">{proposal.technical_summary}</p>
          </div>
        )}

        <p className={`text-sm font-body text-slate-600 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          {proposal.rationale}
        </p>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {proposal.catalyst && (
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border/50">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] font-display text-slate-400 uppercase tracking-wider block mb-0.5">Catalyst</span>
                    <p className="text-xs font-body text-slate-600">{proposal.catalyst}</p>
                  </div>
                </div>
              )}
              {proposal.risk_review && (
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border/50">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] font-display text-slate-400 uppercase tracking-wider block mb-0.5">Risk Review</span>
                    <p className="text-xs font-body text-slate-500 leading-relaxed">{proposal.risk_review}</p>
                  </div>
                </div>
              )}
              {proposal.expected_impact && (
                <div className="flex items-start gap-2 mt-2">
                  <Target className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] font-display text-slate-400 uppercase tracking-wider block mb-0.5">Expected Impact</span>
                    <p className="text-xs font-body text-slate-500 leading-relaxed">{proposal.expected_impact}</p>
                  </div>
                </div>
              )}
              {hasAgentReasoning && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-display text-slate-400 uppercase tracking-wider">Agent Reasoning</span>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(proposal.agent_reasoning).map(([agent, reasoning]) => {
                      const bullets = extractBullets(reasoning)
                      return (
                        <div key={agent} className="flex items-start gap-2">
                          <span className="text-[10px] font-display font-bold text-slate-400 whitespace-nowrap mt-0.5 min-w-[90px]">{agent.replace('Senior ', '').replace('Portfolio ', '')}</span>
                          <ul className="flex-1 space-y-0.5">
                            {bullets.map((b, bi) => (
                              <li key={bi} className="text-[11px] font-body text-slate-500 leading-snug flex items-start gap-1.5">
                                <span className="text-[8px] text-slate-300 mt-[3px] flex-shrink-0">●</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
          {proposal.status === 'pending' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onApprove(proposal.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gain text-white text-xs font-display font-semibold hover:bg-gain/90 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                onClick={() => onReject(proposal.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-loss/10 text-loss text-xs font-display font-semibold hover:bg-loss/20 transition-colors cursor-pointer"
              >
                <ShieldX className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          )}
          {proposal.status === 'approved' && (
            <button
              onClick={() => onExecute(proposal)}
              disabled={proposalExecuting === proposal.id}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan text-white text-xs font-display font-semibold hover:bg-cyan/90 transition-colors cursor-pointer disabled:opacity-50"
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
      </div>
    </motion.div>
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
    agentEvents,
    activeAgentIndex,
    agentRoles,
    fetchObjective,
    saveObjective,
    generateProposalsStreaming,
    fetchProposals,
    approveProposal,
    rejectProposal,
    executeProposal,
    clearOrderFeedback,
    clearResolved,
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
  const [executeTarget, setExecuteTarget] = useState<TradeProposal | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const activeProposals = useMemo(
    () => proposals.filter((p) => p.status === 'pending' || p.status === 'approved'),
    [proposals],
  )
  const historyProposals = useMemo(
    () => proposals.filter((p) => p.status === 'rejected' || p.status === 'executed'),
    [proposals],
  )

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

  const streamingDone = !generatingProposals && agentEvents.length > 0 && agentEvents.some((e) => e.event === 'done')

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
      <TopHeader title="AI Trading Agents" subtitle="Set a goal · AI proposes trades · You decide" onMenuToggle={onMobileMenuToggle} />

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
                <h2 className="text-base font-display font-semibold text-slate-900">Investment Goal</h2>
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
                  {!objective && (
                    <p className="text-sm font-body text-slate-400">Define your investment goal and the AI crew will analyze markets and propose trades for your approval.</p>
                  )}
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
                onClick={() => generateProposalsStreaming()}
                disabled={generatingProposals}
                className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-cyan to-blue-600 text-white text-sm font-display font-semibold shadow-lg hover:shadow-xl hover:brightness-110 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generatingProposals ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Agents working...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Trade Proposals
                  </>
                )}
              </button>

              {(generatingProposals || streamingDone) && agentRoles.length > 0 && (
                <AgentActivityPanel
                  agentRoles={agentRoles}
                  activeAgentIndex={activeAgentIndex}
                  events={agentEvents}
                  done={streamingDone}
                />
              )}
            </motion.div>
          )}

          {activeProposals.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-5 h-5 text-cyan" />
                <h2 className="text-base font-display font-semibold text-slate-900">Active Proposals</h2>
                <span className="text-[11px] font-display font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600">
                  {activeProposals.filter((p) => p.status === 'pending').length} pending
                </span>
                {activeProposals.filter((p) => p.status === 'approved').length > 0 && (
                  <span className="text-[11px] font-display font-medium px-2 py-0.5 rounded-md bg-gain/10 text-gain">
                    {activeProposals.filter((p) => p.status === 'approved').length} approved
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeProposals.map((proposal, i) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    index={i}
                    proposalExecuting={proposalExecuting}
                    onApprove={approveProposal}
                    onReject={rejectProposal}
                    onExecute={setExecuteTarget}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {historyProposals.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="rounded-xl border border-border bg-surface-0 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-surface-1/50 transition-colors cursor-pointer"
              >
                <History className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-display font-medium text-slate-600">History</span>
                <span className="text-[11px] font-body text-slate-400">
                  {historyProposals.filter((p) => p.status === 'executed').length} executed · {historyProposals.filter((p) => p.status === 'rejected').length} rejected
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); clearResolved() }}
                    className="flex items-center gap-1 text-[11px] font-display font-medium text-slate-400 hover:text-loss transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-loss/5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </div>
              </button>

              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="overflow-y-auto max-h-[400px] divide-y divide-border/50 border-t border-border">
                      {historyProposals.map((proposal) => (
                        <div key={proposal.id} className="px-5 py-3 opacity-60">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-display font-bold px-2 py-0.5 rounded-md uppercase ${
                                proposal.action === 'buy' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                              }`}>
                                {proposal.action}
                              </span>
                              <span className="text-sm font-display font-bold text-slate-700">{proposal.symbol}</span>
                              <span className="text-xs font-body text-slate-400">{proposal.qty} shares</span>
                            </div>
                            <ProposalStatusBadge status={proposal.status} />
                          </div>
                          <p className="text-xs font-body text-slate-400 mt-1 line-clamp-1">{proposal.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {!generatingProposals && activeProposals.length === 0 && historyProposals.length === 0 && objective && !editing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center py-12"
            >
              <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-body">Define your goal above, then generate AI-powered trade proposals to review and execute.</p>
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
