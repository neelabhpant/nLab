import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wifi, WifiOff, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { useOpenClawStore } from '@/spaces/labs/stores/openclaw-store'
import { SkillPanel } from '@/spaces/labs/components/openclaw/skill-panel'
import { ChatPanel } from '@/spaces/labs/components/openclaw/chat-panel'
import { ExecutionViewer } from '@/spaces/labs/components/openclaw/execution-viewer'

const ACCENT = '#FF6B35'

function GatewayBadge() {
  const { gatewayStatus, skills } = useOpenClawStore()
  const activeSkills = skills.filter((s) => s.enabled).length

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-1 border border-border">
        <div className="relative">
          {gatewayStatus === 'processing' ? (
            <Wifi className="w-3.5 h-3.5 text-[#FF6B35]" />
          ) : gatewayStatus === 'error' ? (
            <WifiOff className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{
              backgroundColor:
                gatewayStatus === 'processing'
                  ? ACCENT
                  : gatewayStatus === 'error'
                    ? '#ef4444'
                    : '#22c55e',
            }}
            animate={
              gatewayStatus === 'processing'
                ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }
                : {}
            }
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
        <span className="text-[11px] font-display font-semibold text-slate-700">
          Gateway
        </span>
        <span
          className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
          style={{
            backgroundColor:
              gatewayStatus === 'processing'
                ? `${ACCENT}18`
                : gatewayStatus === 'error'
                  ? 'rgb(239 68 68 / 0.1)'
                  : 'rgb(34 197 94 / 0.1)',
            color:
              gatewayStatus === 'processing'
                ? ACCENT
                : gatewayStatus === 'error'
                  ? '#ef4444'
                  : '#16a34a',
          }}
        >
          {gatewayStatus}
        </span>
      </div>
      <div className="hidden md:flex items-center gap-1.5 text-[10px] font-body text-slate-500">
        <span
          className="font-semibold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${ACCENT}12`, color: ACCENT }}
        >
          {activeSkills} skills
        </span>
      </div>
    </div>
  )
}

export function OpenClaw() {
  const navigate = useNavigate()
  const { onMobileMenuToggle } = useLayoutContext()
  const { fetchSkills } = useOpenClawStore()

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  return (
    <div className="flex flex-col h-full">
      <TopHeader
        title="OpenClaw Lite"
        subtitle="Personal AI agent playground"
        onMenuToggle={onMobileMenuToggle}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/labs')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-slate-500 hover:text-slate-900 hover:bg-surface-1 transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            Gallery
          </button>
          <GatewayBadge />
        </div>
      </TopHeader>

      <div className="flex-1 overflow-hidden flex">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="hidden lg:flex w-64 flex-shrink-0 border-r border-border bg-surface-0 flex-col"
        >
          <SkillPanel />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="flex-1 flex flex-col bg-background"
        >
          <ChatPanel />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="hidden xl:flex w-80 flex-shrink-0 border-l border-border bg-surface-0 flex-col"
        >
          <ExecutionViewer />
        </motion.div>
      </div>
    </div>
  )
}
