import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye,
  Send,
  Check,
  CircleDot,
  Circle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Sparkles,
  Cpu,
} from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { newsletterApi, extractErrorMessage } from '@/shared/lib/newsletter-api'
import {
  useComposeStore,
  deriveTitle,
  sectionHasContent,
  type ActiveSection,
} from './stores/compose-store'
import { TheReadEditor } from './sections/the-read-editor'
import { WhatsMovingEditor } from './sections/whats-moving-editor'
import { UseCaseSpotlightEditor } from './sections/use-case-spotlight-editor'
import { WinsEditor } from './sections/wins-editor'
import { HorizonEditor } from './sections/horizon-editor'

const SECTIONS: Array<{ key: ActiveSection; label: string }> = [
  { key: 'the_read', label: 'The Read' },
  { key: 'whats_moving', label: "What's Moving" },
  { key: 'use_case_spotlight', label: 'Use Case Spotlight' },
  { key: 'wins', label: 'Wins' },
  { key: 'horizon', label: 'On the Horizon' },
]

function formatSavedAgo(iso: string | null, saving: boolean): string {
  if (saving) return 'Saving…'
  if (!iso) return 'Unsaved'
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return 'Saved'
  const sec = Math.floor(diff / 1000)
  if (sec < 5) return 'Saved just now'
  if (sec < 60) return `Saved ${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `Saved ${min}m ago`
  const hr = Math.floor(min / 60)
  return `Saved ${hr}h ago`
}

export function ComposePage() {
  const { onMobileMenuToggle } = useLayoutContext()
  const navigate = useNavigate()
  const { draftId } = useParams<{ draftId: string }>()
  const {
    currentDraft,
    loading,
    saving,
    lastSavedAt,
    error,
    activeSection,
    createDraft,
    loadDraft,
    updateCurrentDraft,
    saveCurrentDraft,
    sendDraft,
    setActiveSection,
    resetCurrentDraft,
    sessionCostUsd,
    lastModelLabel,
    generationModelLabel,
    fetchComposerSettings,
  } = useComposeStore()

  const [showSendModal, setShowSendModal] = useState(false)
  // Tick state so "saved Xs ago" refreshes without a hard reload.
  const [tick, setTick] = useState(0)

  // Preview modal state.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const handlePreview = async () => {
    if (!currentDraft) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      // Flush any pending edits so the preview reflects the latest content.
      await saveCurrentDraft()
      const html = await newsletterApi.previewDraftHtml(currentDraft.id)
      setPreviewHtml(html)
    } catch (err) {
      setPreviewError(extractErrorMessage(err, 'Preview failed'))
      setPreviewHtml('')
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    if (draftId) {
      void loadDraft(draftId)
    } else {
      void (async () => {
        const fresh = await createDraft()
        if (!cancelled) navigate(`/retail/compose/draft/${fresh.id}`, { replace: true })
      })()
    }
    return () => {
      cancelled = true
    }
  }, [draftId, loadDraft, createDraft, navigate])

  // Reset current draft when leaving the page so a stale draft doesn't bleed across.
  useEffect(() => {
    return () => resetCurrentDraft()
  }, [resetCurrentDraft])

  // Load the active generation model + voice-check mode for the header.
  useEffect(() => {
    void fetchComposerSettings()
  }, [fetchComposerSettings])

  // Refresh the "saved Xs ago" label every 10 seconds.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(interval)
  }, [])

  const derivedTitle = useMemo(() => deriveTitle(currentDraft), [currentDraft])
  const title = (currentDraft?.title || '').trim() || derivedTitle
  const issueLabel = currentDraft?.issue_number
    ? `Issue ${currentDraft.issue_number} (pending)`
    : 'Unsent'

  const sectionStatus = (key: ActiveSection): boolean => {
    if (!currentDraft) return false
    return sectionHasContent(currentDraft.sections, key)
  }

  const status = saving
    ? 'saving'
    : error
      ? 'error'
      : lastSavedAt
        ? 'saved'
        : 'unsaved'

  const statusColor = {
    saving: 'text-amber-600',
    error: 'text-loss',
    saved: 'text-slate-500',
    unsaved: 'text-slate-400',
  }[status]

  const savedLabel = formatSavedAgo(lastSavedAt, saving)
  // touch tick so the label re-renders periodically
  void tick

  const handleSend = async (recipientCount?: number) => {
    if (!currentDraft) return
    const issue = await sendDraft(currentDraft.id, recipientCount)
    setShowSendModal(false)
    navigate(`/retail/compose/issues/${issue.id}`)
  }

  return (
    <div className="h-full flex flex-col">
      <TopHeader
        title={title}
        subtitle={`The Retail Read — ${issueLabel}`}
        onMenuToggle={onMobileMenuToggle}
      />

      <div className="flex-1 overflow-auto bg-surface-1/40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5">
          <Link
            to="/retail/compose/drafts"
            className="inline-flex items-center gap-1.5 text-sm font-display font-medium text-slate-500 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to drafts
          </Link>

          {/* Issue title — editorial headline + email subject. Defaults to the
              derived value (shown as placeholder); persists via auto-save. */}
          <div className="mb-4">
            <label className="block text-[10px] font-display font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Issue title
            </label>
            <input
              type="text"
              value={currentDraft?.title ?? ''}
              onChange={(e) => updateCurrentDraft({ title: e.target.value })}
              placeholder={derivedTitle}
              disabled={!currentDraft}
              className="w-full bg-transparent border-0 border-b border-border focus:border-emerald-500 px-0 py-1.5 text-2xl font-display font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-bold focus:outline-none focus:ring-0"
            />
            <p className="mt-1 text-[11px] font-body text-slate-400">
              Doubles as the email subject. Leave blank to use the auto-generated headline.
            </p>
          </div>

          {/* Top bar: title pill + actions */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-display font-semibold uppercase tracking-wider border border-emerald-100">
                {issueLabel}
              </span>
              <div className={`text-xs font-display font-medium flex items-center gap-1.5 ${statusColor}`}>
                {status === 'saving' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : status === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : status === 'saved' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : null}
                {status === 'error' ? 'Save failed — will retry' : savedLabel}
              </div>
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 text-white text-[11px] font-display font-medium"
                title="Active newsletter model and cumulative LLM cost this composer session"
              >
                <Cpu className="w-3 h-3 text-cyan" />
                <span>{lastModelLabel ?? generationModelLabel ?? '—'}</span>
                <span className="text-slate-500">·</span>
                <span className="tabular-nums">${sessionCostUsd.toFixed(2)} this session</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={!currentDraft || previewLoading}
                title="Preview the assembled issue"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-0 text-sm font-display font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Preview
              </button>
              <button
                type="button"
                onClick={() => setShowSendModal(true)}
                disabled={!currentDraft}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-display font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Mark as Sent
              </button>
            </div>
          </div>

          {/* Section stepper */}
          <div className="rounded-xl border border-border bg-surface-0 px-3 py-2 mb-5 overflow-x-auto">
            <div className="flex items-center gap-1 min-w-max">
              {SECTIONS.map((s, idx) => {
                const filled = sectionStatus(s.key)
                const active = activeSection === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setActiveSection(s.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-display font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`shrink-0 ${filled ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {filled ? <CircleDot className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    </span>
                    <span className="text-[10px] font-display font-semibold tabular-nums">{idx + 1}.</span>
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {loading || !currentDraft ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-slate-500">Loading composer…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Left pane — editor */}
              <div className="lg:col-span-3 rounded-2xl border border-border bg-surface-0 p-5 md:p-7">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeSection === 'the_read' && <TheReadEditor />}
                    {activeSection === 'whats_moving' && <WhatsMovingEditor />}
                    {activeSection === 'use_case_spotlight' && <UseCaseSpotlightEditor />}
                    {activeSection === 'wins' && <WinsEditor />}
                    {activeSection === 'horizon' && <HorizonEditor />}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Right pane — assistant placeholder */}
              <aside className="lg:col-span-2 rounded-2xl border border-border bg-surface-0 p-5 md:p-6 h-fit lg:sticky lg:top-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 inline-flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-display font-semibold text-slate-900">Assistant</h3>
                </div>

                <AssistantPlaceholder section={activeSection} />
              </aside>
            </div>
          )}

          {/* Footer CTA — sticky */}
          <div className="mt-5 sticky bottom-0 z-10">
            <div className="rounded-xl border border-border bg-surface-0 shadow-sm p-3 flex items-center gap-3 flex-wrap">
              <label className="text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 shrink-0">
                Footer CTA
              </label>
              <input
                type="text"
                value={currentDraft?.footer_cta ?? ''}
                onChange={(e) =>
                  updateCurrentDraft({ footer_cta: e.target.value })
                }
                placeholder="One line. Different each issue."
                className="flex-1 min-w-[200px] rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => void saveCurrentDraft()}
                disabled={saving || !currentDraft}
                className="text-xs font-display font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
              >
                Save now
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSendModal && currentDraft && (
          <SendModal
            onCancel={() => setShowSendModal(false)}
            onConfirm={(rc) => handleSend(rc)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewHtml !== null && (
          <PreviewModal
            html={previewHtml}
            error={previewError}
            onClose={() => {
              setPreviewHtml(null)
              setPreviewError(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function PreviewModal({
  html,
  error,
  onClose,
}: {
  html: string
  error: string | null
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        className="bg-surface-0 rounded-2xl border border-border shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-display font-semibold text-slate-900">Issue preview</h3>
            <span className="text-[11px] font-body text-slate-400">Email HTML — exactly what ships</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-display font-medium text-slate-500 hover:text-slate-900 cursor-pointer px-2 py-1"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-hidden bg-slate-100">
          {error ? (
            <div className="flex items-center gap-2 text-sm text-loss font-body p-6">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          ) : (
            <iframe
              title="Issue preview"
              srcDoc={html}
              className="w-full h-[75vh] border-0 bg-white"
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function AssistantPlaceholder({ section }: { section: ActiveSection }) {
  const copy: Record<ActiveSection, string> = {
    the_read: 'AI assist will help you draft a 100-word opinion piece. Coming in Phase 5.',
    whats_moving: "AI assist will surface 4 articles from this week's digest. Coming in Phase 5.",
    use_case_spotlight:
      'Pick a POV from the library above. Phase 5 will compose the 200-word spotlight from the POV record.',
    wins: 'Paste rough bullets, AI will polish in your voice. Coming in Phase 5.',
    horizon: 'Paste rough bullets, AI will polish in your voice. Coming in Phase 5.',
  }
  return (
    <p className="text-sm font-body text-slate-600 leading-relaxed">
      {copy[section]}
    </p>
  )
}

function SendModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: (recipientCount?: number) => void
}) {
  const [count, setCount] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-surface-0 rounded-2xl border border-border shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-display font-semibold text-slate-900 mb-1">
          Mark issue as sent?
        </h3>
        <p className="text-sm font-body text-slate-600 mb-4">
          This will assign the next issue number, move the record to Archive, and remove it from Drafts.
          This action cannot be undone in v1.
        </p>
        <label className="block text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
          Recipient count (optional)
        </label>
        <input
          type="number"
          min={0}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          placeholder="e.g. 24"
          className="w-full mb-5 rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm font-display font-medium text-slate-700 hover:border-slate-400 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setSubmitting(true)
              const parsed = count.trim() ? Number(count) : undefined
              onConfirm(parsed && !Number.isNaN(parsed) ? parsed : undefined)
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-display font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Mark as Sent
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
