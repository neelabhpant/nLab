import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FileEdit, Trash2, ArrowRight, Loader2 } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import {
  useComposeStore,
  deriveTitle,
  type IssueDraft,
} from './stores/compose-store'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

export function DraftsPage() {
  const { onMobileMenuToggle } = useLayoutContext()
  const navigate = useNavigate()
  const { drafts, loading, fetchDrafts, createDraft, deleteDraft } = useComposeStore()
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<IssueDraft | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void fetchDrafts()
  }, [fetchDrafts])

  const handleNew = async () => {
    setCreating(true)
    try {
      const draft = await createDraft()
      navigate(`/retail/compose/draft/${draft.id}`)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteDraft(pendingDelete.id)
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <TopHeader
        title="Drafts"
        subtitle="Drafts in progress"
        onMenuToggle={onMobileMenuToggle}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleNew}
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-display font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              New Draft
            </button>
          </div>

          {loading && drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-slate-500">Loading drafts…</p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl border border-dashed border-border bg-surface-0">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 inline-flex items-center justify-center mb-4">
                <FileEdit className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <h3 className="text-base font-display font-semibold text-slate-900 mb-1">
                No drafts yet
              </h3>
              <p className="text-sm font-body text-slate-500 mb-5 text-center max-w-md">
                Click "+ New Draft" to start. Auto-save kicks in 5 seconds after you stop typing.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <ul className="space-y-2">
                {drafts.map((d, i) => (
                  <motion.li
                    key={d.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.15) }}
                    className="group rounded-xl border border-border bg-surface-0 px-5 py-4 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-slate-900 truncate">
                        {(d.title || '').trim() || deriveTitle(d)}
                      </p>
                      <p className="text-xs font-body text-slate-500 mt-0.5">
                        {d.issue_number ? `Issue ${d.issue_number} (pending)` : 'Unsent'} · last updated {timeAgo(d.updated_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/retail/compose/draft/${d.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                    >
                      Continue
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(d)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-loss hover:bg-loss/5 cursor-pointer"
                      aria-label="Delete draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.li>
                ))}
              </ul>
            </AnimatePresence>
          )}
        </div>
      </div>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
            onClick={() => setPendingDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-0 rounded-2xl border border-border shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-display font-semibold text-slate-900 mb-1">
                Delete this draft?
              </h3>
              <p className="text-sm font-body text-slate-600 mb-5">
                <span className="font-medium text-slate-900">{deriveTitle(pendingDelete)}</span> will be
                permanently removed. This cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-display font-medium text-slate-700 hover:border-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-loss text-white text-sm font-display font-medium hover:bg-loss/90 disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete draft
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
