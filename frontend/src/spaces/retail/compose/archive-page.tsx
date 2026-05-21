import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Archive, ArrowRight, Loader2, Users } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { useComposeStore } from './stores/compose-store'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function ArchivePage() {
  const { onMobileMenuToggle } = useLayoutContext()
  const { issues, loading, fetchIssues } = useComposeStore()

  useEffect(() => {
    void fetchIssues()
  }, [fetchIssues])

  return (
    <div className="h-full flex flex-col">
      <TopHeader
        title="Archive"
        subtitle="Sent issues"
        onMenuToggle={onMobileMenuToggle}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-5">
          {loading && issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-slate-500">Loading archive…</p>
            </div>
          ) : issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl border border-dashed border-border bg-surface-0">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 inline-flex items-center justify-center mb-4">
                <Archive className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <h3 className="text-base font-display font-semibold text-slate-900 mb-1">
                No issues sent yet
              </h3>
              <p className="text-sm font-body text-slate-500 text-center max-w-md">
                Mark a draft as sent and it will appear here as a permanent record.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {issues.map((i, idx) => (
                <motion.li
                  key={i.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.15) }}
                >
                  <Link
                    to={`/retail/compose/issues/${i.id}`}
                    className="group flex items-center gap-4 rounded-xl border border-border bg-surface-0 px-5 py-4 shadow-sm hover:shadow-md hover:border-amber-400 transition-all"
                  >
                    <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 text-[11px] font-display font-semibold uppercase tracking-wider border border-amber-100 shrink-0">
                      {i.slug}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-slate-900 truncate">
                        {i.title}
                      </p>
                      <p className="text-xs font-body text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>Sent {formatDate(i.sent_at)}</span>
                        {i.recipient_count != null && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {i.recipient_count} recipients
                          </span>
                        )}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-700 transition-colors shrink-0" />
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
