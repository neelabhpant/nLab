import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Calculator,
  Brain,
  Globe,
  FileText,
  StickyNote,
  ChevronDown,
  ChevronUp,
  Pencil,
  Sparkles,
  Mail,
  FileDown,
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
} from 'lucide-react'
import { useOpenClawStore, type Skill } from '@/spaces/labs/stores/openclaw-store'

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

const ACCENT = '#FF6B35'

function SkillCard({ skill }: { skill: Skill }) {
  const { toggleSkill } = useOpenClawStore()
  const Icon = SKILL_ICONS[skill.id] ?? Sparkles

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-200 cursor-pointer ${
        skill.enabled
          ? 'border-[#FF6B35]/25 bg-[#FF6B35]/5'
          : 'border-border bg-surface-1/50 opacity-60'
      }`}
      onClick={() => toggleSkill(skill.id)}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
          skill.enabled ? 'bg-[#FF6B35]/10 text-[#FF6B35]' : 'bg-surface-2 text-slate-400'
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-display font-semibold truncate transition-colors ${
            skill.enabled ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          {skill.name}
        </p>
        <p className="text-[10px] font-body text-slate-400 truncate">{skill.description}</p>
      </div>
      <div
        className={`w-8 h-4 rounded-full flex items-center px-0.5 transition-all flex-shrink-0 ${
          skill.enabled ? 'bg-[#FF6B35] justify-end' : 'bg-slate-300 justify-start'
        }`}
      >
        <motion.div
          layout
          className="w-3 h-3 rounded-full bg-white shadow-sm"
        />
      </div>
    </motion.div>
  )
}

export function SkillPanel() {
  const { skills, soul, updateSoul } = useOpenClawStore()
  const [soulExpanded, setSoulExpanded] = useState(false)
  const activeCount = skills.filter((s) => s.enabled).length

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-display font-bold text-slate-900">Skills</h3>
          <span
            className="text-[10px] font-display font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}
          >
            {activeCount} active
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-1.5">
        {skills.map((skill) => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>

      <div className="border-t border-border">
        <button
          onClick={() => setSoulExpanded(!soulExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-surface-1 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5 text-[#FF6B35]" />
            <span className="text-xs font-display font-semibold text-slate-700">SOUL.md</span>
          </div>
          {soulExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
        <AnimatePresence>
          {soulExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3">
                <textarea
                  value={soul}
                  onChange={(e) => updateSoul(e.target.value)}
                  placeholder="Define the agent's personality and instructions..."
                  className="w-full h-28 px-3 py-2 rounded-lg bg-surface-1 border border-border text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]/50 resize-none"
                />
                <p className="text-[10px] font-body text-slate-400 mt-1">
                  Like OpenClaw's SOUL.md — shapes the agent's identity
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
