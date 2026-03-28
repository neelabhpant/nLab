import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Calculator,
  Brain,
  Globe,
  FileText,
  StickyNote,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sparkles,
  Mail,
  FileDown,
  Download,
  FolderOpen,
  Monitor,
  HardDrive,
  GitBranch,
  Clipboard,
  FilePen,
  Terminal,
  ExternalLink,
  Chrome,
  LogIn,
  ShieldAlert,
  Check,
  X,
} from 'lucide-react'
import { useOpenClawStore, type OCEvent } from '@/spaces/labs/stores/openclaw-store'

import { API_BASE } from '@/shared/lib/api'

const SKILL_ICONS: Record<string, typeof Search> = {
  web_search: Search,
  calculator: Calculator,
  memory: Brain,
  url_fetcher: Globe,
  text_analyzer: FileText,
  note_taker: StickyNote,
  send_email: Mail,
  file_generator: FileDown,
  file_explorer: FolderOpen,
  system_monitor: Monitor,
  local_search: HardDrive,
  git_status: GitBranch,
  clipboard_read: Clipboard,
  file_writer: FilePen,
  shell_runner: Terminal,
  app_launcher: ExternalLink,
  browser_agent: Chrome,
  browser_login: LogIn,
}

function EventItem({ event }: { event: OCEvent }) {
  if (event.type === 'gateway_status') {
    const isProcessing = event.content === 'processing'
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2 py-1.5"
      >
        <div
          className={`w-2 h-2 rounded-full ${
            isProcessing ? 'bg-[#FF6B35] animate-pulse' : event.content === 'error' ? 'bg-red-500' : 'bg-emerald-500'
          }`}
        />
        <span className="text-[11px] font-display font-medium text-slate-500">
          Gateway {event.content}
        </span>
      </motion.div>
    )
  }

  if (event.type === 'tool_call') {
    const skillId = (event.metadata?.skill as string) ?? ''
    const Icon = SKILL_ICONS[skillId] ?? Wrench
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg bg-amber-50 border border-amber-200/60 p-2.5"
      >
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[11px] font-display font-semibold text-amber-700">
            {skillId.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-[11px] font-mono text-slate-600 leading-relaxed">{event.content}</p>
      </motion.div>
    )
  }

  if (event.type === 'tool_result') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pl-3 border-l-2 border-emerald-300"
      >
        <p className="text-[11px] font-mono text-slate-500 whitespace-pre-wrap leading-relaxed line-clamp-4">
          {event.content}
        </p>
      </motion.div>
    )
  }

  if (event.type === 'memory_update' && event.content !== 'sync') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 py-1 px-2 rounded-md bg-purple-50 border border-purple-200/60"
      >
        <Brain className="w-3 h-3 text-purple-500" />
        <span className="text-[11px] font-body text-purple-700">{event.content}</span>
      </motion.div>
    )
  }

  if (event.type === 'file_generated') {
    const fileId = event.metadata?.file_id as string
    const downloadName = event.metadata?.download_name as string
    const format = event.metadata?.format as string
    const token = localStorage.getItem('nlab_auth_token')
    const href = `${API_BASE}/openclaw/files/${fileId}${token ? `?token=${encodeURIComponent(token)}` : ''}`
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg bg-emerald-50 border border-emerald-200/60 p-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileDown className="w-4 h-4 text-emerald-600" />
            <div>
              <p className="text-[11px] font-display font-semibold text-emerald-800">
                {downloadName}
              </p>
              <p className="text-[10px] font-body text-emerald-600">
                {format?.toUpperCase()} file ready
              </p>
            </div>
          </div>
          <a
            href={href}
            download={downloadName}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-display font-semibold text-white transition-colors hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
          >
            <Download className="w-3 h-3" />
            Download
          </a>
        </div>
      </motion.div>
    )
  }

  if (event.type === 'confirmation_required') {
    const confirmationId = event.metadata?.confirmation_id as string
    const details = event.metadata?.details as string
    return <ConfirmationCard confirmationId={confirmationId} action={event.content} details={details} />
  }

  if (event.type === 'confirmation_result') {
    const approved = event.content === 'approved'
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg ${
          approved ? 'bg-emerald-50 border border-emerald-200/60' : 'bg-red-50 border border-red-200'
        }`}
      >
        {approved ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <X className="w-3.5 h-3.5 text-red-500" />
        )}
        <span className={`text-[11px] font-display font-medium ${approved ? 'text-emerald-700' : 'text-red-600'}`}>
          Action {event.content}: {event.metadata?.action as string}
        </span>
      </motion.div>
    )
  }

  if (event.type === 'response') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 py-1.5"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[11px] font-display font-medium text-emerald-700">
          Response complete
          {event.metadata?.total_skill_calls
            ? ` — ${event.metadata.total_skill_calls} skill calls in ${event.metadata.execution_time_seconds}s`
            : ''}
        </span>
      </motion.div>
    )
  }

  if (event.type === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-red-50 border border-red-200"
      >
        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
        <span className="text-[11px] font-body text-red-600">{event.content}</span>
      </motion.div>
    )
  }

  return null
}

function ConfirmationCard({ confirmationId, action, details }: { confirmationId: string; action: string; details: string }) {
  const { confirmAction } = useOpenClawStore()
  const [resolved, setResolved] = useState(false)

  const handleConfirm = (approved: boolean) => {
    setResolved(true)
    confirmAction(confirmationId, approved)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg bg-amber-50 border-2 border-amber-300 p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="w-4 h-4 text-amber-600" />
        <span className="text-[11px] font-display font-bold text-amber-800 uppercase tracking-wider">
          Confirmation Required
        </span>
      </div>
      <p className="text-[11px] font-display font-semibold text-slate-800 mb-1">{action}</p>
      <p className="text-[10px] font-mono text-slate-600 whitespace-pre-wrap leading-relaxed mb-3">{details}</p>
      {!resolved ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-display font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            <Check className="w-3 h-3" />
            Approve
          </button>
          <button
            onClick={() => handleConfirm(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-display font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            Deny
          </button>
        </div>
      ) : (
        <p className="text-[10px] font-body text-slate-500 italic">Waiting for response...</p>
      )}
    </motion.div>
  )
}

export function ExecutionViewer() {
  const { events, gatewayStatus, memory } = useOpenClawStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  const visibleEvents = events.filter((e) => e.type !== 'memory_update' || e.content !== 'sync')
  const memoryEntries = Object.entries(memory)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-display font-bold text-slate-900">Execution</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              gatewayStatus === 'processing'
                ? 'bg-[#FF6B35] animate-pulse'
                : gatewayStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-emerald-500'
            }`}
          />
          <span className="text-[10px] font-body text-slate-500">{gatewayStatus}</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2">
        {visibleEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Sparkles className="w-6 h-6 text-slate-300 mb-2" />
            <p className="text-[11px] font-body text-slate-400">
              Skill executions will appear here
            </p>
          </div>
        ) : (
          visibleEvents.map((event, i) => <EventItem key={i} event={event} />)
        )}
      </div>

      {memoryEntries.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain className="w-3 h-3 text-purple-500" />
            <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-wider">
              Memory ({memoryEntries.length})
            </span>
          </div>
          <div className="space-y-1 max-h-24 overflow-auto">
            {memoryEntries.map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-[10px]">
                <span className="font-mono font-medium text-purple-600 flex-shrink-0">{key}:</span>
                <span className="font-body text-slate-500 truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
