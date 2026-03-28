import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Rss,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { useRetailStore } from '../stores/retail-store'
import { useLayoutContext } from '@/shared/components/layout'
import { TopHeader } from '@/shared/components/top-header'

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const TIER_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  competitive: 'Competitive',
}

const TIER_COLORS: Record<string, string> = {
  daily: 'bg-sky-50 text-sky-700',
  weekly: 'bg-amber-50 text-amber-700',
  competitive: 'bg-purple-50 text-purple-700',
}

export function RetailSources() {
  const { onMobileMenuToggle } = useLayoutContext()
  const { sources, sourcesLoading, fetchSources, updateSource } = useRetailStore()

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  return (
    <div className="h-full flex flex-col">
      <TopHeader title="Sources" subtitle="Manage RSS feeds and data sources for retail intelligence" onMenuToggle={onMobileMenuToggle} />
      <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">

        {sourcesLoading && sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading sources...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sources.map((source, i) => (
              <motion.div
                key={source.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      source.enabled ? 'bg-sky-50' : 'bg-slate-100'
                    }`}>
                      <Rss className={`w-4 h-4 ${source.enabled ? 'text-sky-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{source.name}</h3>
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${TIER_COLORS[source.tier] || 'bg-slate-100 text-slate-600'}`}>
                          {TIER_LABELS[source.tier] || source.tier}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{source.focus}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px] text-slate-400">Last: {timeAgo(source.last_fetched)}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">Every {source.fetch_interval_minutes}m</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSource(source.id, { enabled: !source.enabled })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        source.enabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {source.enabled ? (
                        <><CheckCircle className="w-3.5 h-3.5" /> Enabled</>
                      ) : (
                        <><XCircle className="w-3.5 h-3.5" /> Disabled</>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
