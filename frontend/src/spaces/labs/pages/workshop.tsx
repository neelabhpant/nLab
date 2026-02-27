import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Workflow,
  Sparkles,
  Play,
  RotateCcw,
  ChevronRight,
  Wrench,
  Search,
  Calculator,
  StickyNote,
  FileText,
  HelpCircle,
  Clock,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Bot,
  Pencil,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import {
  useWorkshopStore,
  type AgentDefinition,
  type ExecutionEvent,
} from '@/spaces/labs/stores/workshop-store'

const AGENT_COLORS = [
  { accent: 'text-cyan', bg: 'bg-cyan/10', border: 'border-cyan/30', ring: 'ring-cyan/40', dot: 'bg-cyan' },
  { accent: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', ring: 'ring-amber-500/40', dot: 'bg-amber-500' },
  { accent: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30', ring: 'ring-purple-500/40', dot: 'bg-purple-500' },
  { accent: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/30', ring: 'ring-pink-500/40', dot: 'bg-pink-500' },
]

const TOOL_ICONS: Record<string, typeof Search> = {
  web_search: Search,
  calculator: Calculator,
  note_taker: StickyNote,
  text_analyzer: FileText,
}

const CONCEPT_TOOLTIPS: Record<string, string> = {
  Agent: 'An AI with a specific role and expertise, like a team member',
  Tool: 'A capability the agent can use, like searching the web',
  Handoff: 'When one agent passes its work to the next agent',
  Task: 'A specific job assigned to an agent',
  Crew: 'The full team of agents working together',
}

const PLANNING_MESSAGES = [
  'Analyzing your goal...',
  'Designing agent roles...',
  'Selecting tools...',
  'Building task pipeline...',
]

function InfoTooltip({ concept }: { concept: string }) {
  const [open, setOpen] = useState(false)
  const tip = CONCEPT_TOOLTIPS[concept]
  if (!tip) return null
  return (
    <span className="relative inline-flex">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(!open)}
        className="text-slate-400 hover:text-cyan transition-colors cursor-pointer"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-body w-56 text-center shadow-xl z-50 pointer-events-none"
          >
            <span className="font-display font-semibold">{concept}:</span> {tip}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}

function ToolIcon({ tool }: { tool: string }) {
  const Icon = TOOL_ICONS[tool] ?? Wrench
  return <Icon className="w-3.5 h-3.5" />
}

function AgentPipeline({
  agents,
  activeAgentName,
}: {
  agents: AgentDefinition[]
  activeAgentName: string
}) {
  const sorted = [...agents].sort((a, b) => a.order - b.order)
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {sorted.map((agent, i) => {
        const color = AGENT_COLORS[i % AGENT_COLORS.length]
        const isActive = agent.name === activeAgentName
        return (
          <div key={agent.id} className="flex items-center gap-2 flex-shrink-0">
            <motion.div
              animate={isActive ? { scale: [1, 1.05, 1] } : {}}
              transition={isActive ? { repeat: Infinity, duration: 2 } : {}}
              className={`relative px-4 py-3 rounded-xl border ${color.border} ${color.bg} ${
                isActive ? `ring-2 ${color.ring} shadow-lg` : ''
              } transition-all min-w-[140px]`}
            >
              {isActive && (
                <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${color.dot} animate-pulse`} />
              )}
              <p className={`text-sm font-display font-bold ${color.accent}`}>{agent.name}</p>
              <p className="text-[11px] font-body text-slate-500 mt-0.5">{agent.role}</p>
              <div className="flex items-center gap-1.5 mt-2">
                {agent.tools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 text-[10px] font-body text-slate-500 bg-white/60 px-1.5 py-0.5 rounded"
                    title={tool}
                  >
                    <ToolIcon tool={tool} />
                  </span>
                ))}
              </div>
            </motion.div>
            {i < sorted.length - 1 && (
              <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function AgentDetailCards({
  agents,
  onEdit,
  editable,
}: {
  agents: AgentDefinition[]
  onEdit?: (agents: AgentDefinition[]) => void
  editable: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const sorted = [...agents].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-2">
      {sorted.map((agent, i) => {
        const color = AGENT_COLORS[i % AGENT_COLORS.length]
        const expanded = expandedId === agent.id
        return (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`rounded-lg border ${color.border} ${color.bg} overflow-hidden`}
          >
            <button
              onClick={() => setExpandedId(expanded ? null : agent.id)}
              className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                <span className={`text-sm font-display font-bold ${color.accent}`}>{agent.name}</span>
                <span className="text-xs font-body text-slate-500">{agent.role}</span>
              </div>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <div>
                      <label className="text-[10px] font-body text-slate-400 uppercase tracking-wider">Goal</label>
                      {editable ? (
                        <input
                          type="text"
                          value={agent.goal}
                          onChange={(e) => {
                            const updated = agents.map((a) =>
                              a.id === agent.id ? { ...a, goal: e.target.value } : a,
                            )
                            onEdit?.(updated)
                          }}
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-white text-sm font-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan/30"
                        />
                      ) : (
                        <p className="text-sm font-body text-slate-700 mt-1">{agent.goal}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-body text-slate-400 uppercase tracking-wider">Backstory</label>
                      <p className="text-xs font-body text-slate-600 mt-1">{agent.backstory}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-body text-slate-400 uppercase tracking-wider">Tools</label>
                      <div className="flex items-center gap-2 mt-1">
                        {agent.tools.map((tool) => (
                          <span
                            key={tool}
                            className="inline-flex items-center gap-1.5 text-xs font-body text-slate-600 bg-white/80 px-2.5 py-1 rounded-md border border-slate-200"
                          >
                            <ToolIcon tool={tool} />
                            {tool.replace('_', ' ')}
                            <InfoTooltip concept="Tool" />
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

function EventStream({ events }: { events: ExecutionEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  const getAgentColor = (name: string, allEvents: ExecutionEvent[]) => {
    const agentNames = [...new Set(allEvents.filter((e) => e.agent_name).map((e) => e.agent_name))]
    const idx = agentNames.indexOf(name)
    return AGENT_COLORS[idx >= 0 ? idx % AGENT_COLORS.length : 0]
  }

  return (
    <div
      ref={scrollRef}
      className="rounded-xl border border-border bg-slate-950 overflow-y-auto max-h-[480px] p-4 space-y-2"
    >
      {events.map((event, i) => {
        const color = getAgentColor(event.agent_name, events)

        if (event.type === 'agent_start') {
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 py-2"
            >
              <span className={`w-2 h-2 rounded-full ${color.dot}`} />
              <span className={`text-sm font-display font-bold ${color.accent}`}>
                {event.agent_name}
              </span>
              <span className="text-xs font-body text-slate-400">is starting...</span>
            </motion.div>
          )
        }

        if (event.type === 'agent_thinking') {
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pl-4 border-l-2 border-slate-800"
            >
              <p className="text-sm font-body text-slate-300 leading-relaxed">{event.content}</p>
            </motion.div>
          )
        }

        if (event.type === 'tool_call') {
          const toolName = (event.metadata?.tool as string) ?? ''
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="ml-4 rounded-lg bg-slate-900 border border-slate-800 p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-display font-semibold text-amber-400">
                  Using {toolName.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400">{event.content}</p>
            </motion.div>
          )
        }

        if (event.type === 'tool_result') {
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ml-4 pl-3 border-l border-amber-500/30"
            >
              <p className="text-xs font-mono text-slate-500 whitespace-pre-wrap">{event.content}</p>
            </motion.div>
          )
        }

        if (event.type === 'handoff') {
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 py-2 px-3 rounded-lg bg-slate-900/50"
            >
              <ArrowRight className="w-4 h-4 text-cyan" />
              <span className="text-xs font-display font-medium text-cyan">{event.content}</span>
            </motion.div>
          )
        }

        if (event.type === 'agent_complete') {
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 py-1"
            >
              <CheckCircle2 className={`w-4 h-4 ${color.accent}`} />
              <span className="text-xs font-body text-slate-400">{event.content}</span>
            </motion.div>
          )
        }

        if (event.type === 'error') {
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/20"
            >
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-body text-red-400">{event.content}</span>
            </motion.div>
          )
        }

        return null
      })}
      {events.length === 0 && (
        <div className="text-center py-12">
          <Bot className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-xs font-body text-slate-600">Waiting for execution to begin...</p>
        </div>
      )}
    </div>
  )
}

function ResultPanel({
  result,
  stats,
  agents,
  onNewGoal,
  onRunAgain,
}: {
  result: string
  stats: { execution_time_seconds: number; total_tool_calls: number; agent_times: Record<string, number>; agents_used: number } | null
  agents: AgentDefinition[]
  onNewGoal: () => void
  onRunAgain: () => void
}) {
  const maxTime = stats ? Math.max(...Object.values(stats.agent_times), 1) : 1

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-surface-0 shadow-md p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-gain" />
          <h3 className="text-base font-display font-bold text-slate-900">Final Result</h3>
        </div>
        <div className="prose prose-sm max-w-none text-slate-700 font-body whitespace-pre-wrap leading-relaxed">
          {result}
        </div>
      </motion.div>

      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-surface-0 shadow-sm p-5"
        >
          <h4 className="text-sm font-display font-semibold text-slate-900 mb-3">Execution Stats</h4>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-[10px] font-body text-slate-400 uppercase tracking-wider">Total Time</p>
              <p className="text-lg font-display font-bold text-slate-900">{stats.execution_time_seconds}s</p>
            </div>
            <div>
              <p className="text-[10px] font-body text-slate-400 uppercase tracking-wider">Tool Calls</p>
              <p className="text-lg font-display font-bold text-slate-900">{stats.total_tool_calls}</p>
            </div>
            <div>
              <p className="text-[10px] font-body text-slate-400 uppercase tracking-wider">Agents Used</p>
              <p className="text-lg font-display font-bold text-slate-900">{stats.agents_used}</p>
            </div>
          </div>
          {Object.keys(stats.agent_times).length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-body text-slate-400 uppercase tracking-wider">Per-Agent Time</p>
              {Object.entries(stats.agent_times).map(([name, time], i) => {
                const color = AGENT_COLORS[i % AGENT_COLORS.length]
                const pct = (time / maxTime) * 100
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-xs font-display font-medium text-slate-600 w-28 truncate">{name}</span>
                    <div className="flex-1 h-2 bg-surface-1 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className={`h-full rounded-full ${color.dot}`}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-12 text-right">{time}s</span>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onRunAgain}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan text-white text-sm font-display font-semibold hover:bg-cyan/90 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Run Again
        </button>
        <button
          onClick={onNewGoal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-display font-medium text-slate-600 hover:bg-surface-1 transition-colors cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          New Goal
        </button>
      </div>
    </div>
  )
}

export function Workshop() {
  const { onMobileMenuToggle } = useLayoutContext()
  const {
    goal,
    templates,
    crewPlan,
    events,
    result,
    status,
    stats,
    activeAgentName,
    error,
    setGoal,
    fetchTemplates,
    planCrew,
    planFromTemplate,
    editPlan,
    executeCrew,
    reset,
  } = useWorkshopStore()

  const [planningMsgIdx, setPlanningMsgIdx] = useState(0)
  const [localGoal, setLocalGoal] = useState(goal)

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  useEffect(() => {
    if (status !== 'planning') return
    setPlanningMsgIdx(0)
    const interval = setInterval(() => {
      setPlanningMsgIdx((i) => (i + 1) % PLANNING_MESSAGES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [status])

  const handlePlan = useCallback(() => {
    if (!localGoal.trim()) return
    setGoal(localGoal)
    planCrew(localGoal)
  }, [localGoal, setGoal, planCrew])

  const handleEditAgents = useCallback(
    (agents: AgentDefinition[]) => {
      if (!crewPlan) return
      editPlan({ ...crewPlan, agents })
    },
    [crewPlan, editPlan],
  )

  const handleNewGoal = useCallback(() => {
    reset()
    setLocalGoal('')
  }, [reset])

  const handleRunAgain = useCallback(() => {
    executeCrew()
  }, [executeCrew])

  const showGoalInput = status === 'idle' || status === 'planning'
  const showPlan = status === 'planned' || status === 'running' || status === 'complete'
  const showExecution = status === 'running' || status === 'complete'
  const showResult = status === 'complete' && result

  return (
    <div className="flex flex-col h-full">
      <TopHeader
        title="Crew Canvas"
        subtitle="Design, observe, and learn"
        onMenuToggle={onMobileMenuToggle}
      />

      <div className="flex-1 overflow-auto p-3 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-3 rounded-lg bg-loss/10 text-loss text-sm font-body border border-loss/20"
            >
              {error}
            </motion.div>
          )}

          {showGoalInput && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="rounded-xl border border-border bg-surface-0 shadow-md p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Workflow className="w-5 h-5 text-cyan" />
                  <h2 className="text-base font-display font-semibold text-slate-900">
                    What do you want to accomplish?
                  </h2>
                  <InfoTooltip concept="Crew" />
                </div>
                <p className="text-xs font-body text-slate-500 mb-4">
                  Describe a goal and we'll design an AI agent crew <InfoTooltip concept="Agent" /> to tackle it
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={localGoal}
                    onChange={(e) => setLocalGoal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePlan()}
                    placeholder="e.g. Research renewable energy trends and write a blog post..."
                    className="flex-1 px-4 py-3 rounded-lg border border-border bg-surface-1 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan transition-colors"
                  />
                  <button
                    onClick={handlePlan}
                    disabled={!localGoal.trim() || status === 'planning'}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-cyan to-blue-600 text-white text-sm font-display font-semibold shadow-md hover:shadow-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {status === 'planning' ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={planningMsgIdx}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                          >
                            {PLANNING_MESSAGES[planningMsgIdx]}
                          </motion.span>
                        </AnimatePresence>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Plan Crew
                      </>
                    )}
                  </button>
                </div>
              </div>

              {templates.length > 0 && (
                <div>
                  <p className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Or try a template
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {templates.map((template) => (
                      <motion.button
                        key={template.id}
                        whileHover={{ y: -2 }}
                        onClick={() => {
                          setLocalGoal(template.goal)
                          planFromTemplate(template.id)
                        }}
                        className="flex-shrink-0 w-52 p-4 rounded-xl border border-border bg-surface-0 shadow-sm hover:shadow-md hover:border-cyan/30 transition-all cursor-pointer text-left"
                      >
                        <p className="text-sm font-display font-bold text-slate-900 mb-1">
                          {template.title}
                        </p>
                        <p className="text-xs font-body text-slate-500 line-clamp-2">
                          {template.description}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {showPlan && crewPlan && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="rounded-xl border border-border bg-surface-0 shadow-md overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Workflow className="w-5 h-5 text-cyan" />
                      <h2 className="text-base font-display font-semibold text-slate-900">
                        Crew Plan
                      </h2>
                      <InfoTooltip concept="Crew" />
                    </div>
                    <div className="flex items-center gap-2">
                      {status === 'planned' && (
                        <>
                          <button
                            onClick={handleNewGoal}
                            className="flex items-center gap-1.5 text-xs font-display font-medium text-slate-500 hover:text-cyan transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Re-plan
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {crewPlan.summary && (
                    <p className="text-xs font-body text-slate-500 mt-1">{crewPlan.summary}</p>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <AgentPipeline agents={crewPlan.agents} activeAgentName={activeAgentName} />
                  <AgentDetailCards
                    agents={crewPlan.agents}
                    onEdit={handleEditAgents}
                    editable={status === 'planned'}
                  />
                </div>
              </div>

              {status === 'planned' && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <button
                    onClick={() => executeCrew()}
                    className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-cyan to-blue-600 text-white text-sm font-display font-semibold shadow-lg hover:shadow-xl hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Run Crew
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {showExecution && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-display font-semibold text-slate-900">
                  {status === 'running' ? 'Live Execution' : 'Execution Log'}
                </h2>
                {status === 'running' && (
                  <span className="flex items-center gap-1.5 text-xs font-body text-cyan">
                    <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
                    Running
                  </span>
                )}
                <InfoTooltip concept="Handoff" />
              </div>
              <EventStream events={events.filter((e) => e.type !== 'crew_complete')} />
            </motion.div>
          )}

          {showResult && (
            <ResultPanel
              result={result}
              stats={stats}
              agents={crewPlan?.agents ?? []}
              onNewGoal={handleNewGoal}
              onRunAgain={handleRunAgain}
            />
          )}

          {status === 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center py-8"
            >
              <div className="inline-flex items-center gap-4 text-xs font-body text-slate-400">
                <span className="flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5" />
                  Agent <InfoTooltip concept="Agent" />
                </span>
                <ChevronRight className="w-3 h-3" />
                <span className="flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5" />
                  Tool <InfoTooltip concept="Tool" />
                </span>
                <ChevronRight className="w-3 h-3" />
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3.5 h-3.5" />
                  Handoff <InfoTooltip concept="Handoff" />
                </span>
                <ChevronRight className="w-3 h-3" />
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Task <InfoTooltip concept="Task" />
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
