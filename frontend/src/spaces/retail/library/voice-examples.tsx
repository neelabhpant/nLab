import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Plus, Pencil, Trash2, Save, X, Loader2, AlertCircle } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import {
  newsletterApi,
  extractErrorMessage,
  type VoiceExample,
  type VoiceExampleCreate,
  type SectionKey,
} from '@/shared/lib/newsletter-api'

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: 'the_read', label: 'The Read' },
  { key: 'whats_moving', label: "What's Moving" },
  { key: 'use_case_spotlight', label: 'Use Case Spotlight' },
  { key: 'wins', label: 'Wins' },
  { key: 'horizon', label: 'On the Horizon' },
]

type EditState =
  | { mode: 'closed' }
  | { mode: 'new'; section: SectionKey }
  | { mode: 'edit'; example: VoiceExample }

export function VoiceExamplesPage() {
  const { onMobileMenuToggle } = useLayoutContext()
  const [examples, setExamples] = useState<VoiceExample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('the_read')
  const [editState, setEditState] = useState<EditState>({ mode: 'closed' })
  const [pendingDelete, setPendingDelete] = useState<VoiceExample | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await newsletterApi.listVoiceExamples()
      setExamples(data)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load voice examples'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const sectionCounts = useMemo(() => {
    const counts: Record<SectionKey, number> = {
      the_read: 0,
      whats_moving: 0,
      use_case_spotlight: 0,
      wins: 0,
      horizon: 0,
    }
    examples.forEach((e) => {
      counts[e.section_type] = (counts[e.section_type] ?? 0) + 1
    })
    return counts
  }, [examples])

  const filtered = examples.filter((e) => e.section_type === activeSection)

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await newsletterApi.deleteVoiceExample(pendingDelete.id)
      setPendingDelete(null)
      await refresh()
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete example'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <TopHeader
        title="Voice Examples"
        subtitle="Few-shot corpus that shapes The Retail Read's voice"
        onMenuToggle={onMobileMenuToggle}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-5">
          {/* Section tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="rounded-xl border border-border bg-surface-0 p-1 inline-flex overflow-x-auto">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-display font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    activeSection === s.key
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                  <span className="ml-1.5 text-[10px] text-slate-400 tabular-nums">
                    {sectionCounts[s.key] ?? 0}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setEditState({ mode: 'new', section: activeSection })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-display font-medium hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Example
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-loss font-body rounded-lg border border-loss/20 bg-loss/5 px-3 py-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-slate-500">Loading corpus…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 rounded-2xl border border-dashed border-border bg-surface-0">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 inline-flex items-center justify-center mb-3">
                <Mic className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <p className="text-sm font-body text-slate-500 text-center max-w-md">
                No examples for this section yet. Add one to shape future generations.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((ex) => (
                <motion.li
                  key={ex.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-border bg-surface-0 p-4 shadow-sm"
                >
                  <p className="text-sm font-body text-slate-800 leading-relaxed whitespace-pre-line">
                    {ex.example_text}
                  </p>
                  {(ex.source || ex.notes) && (
                    <p className="text-[11px] font-body text-slate-500 mt-2">
                      {ex.source && <span className="font-display font-medium">{ex.source}</span>}
                      {ex.source && ex.notes && <span> · </span>}
                      {ex.notes && <span className="italic">{ex.notes}</span>}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <button
                      onClick={() => setEditState({ mode: 'edit', example: ex })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-display font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => setPendingDelete(ex)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-display font-medium text-slate-500 hover:text-loss hover:bg-loss/5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editState.mode !== 'closed' && (
          <EditModal
            initial={
              editState.mode === 'edit'
                ? {
                    section_type: editState.example.section_type,
                    example_text: editState.example.example_text,
                    source: editState.example.source ?? '',
                    notes: editState.example.notes ?? '',
                  }
                : { section_type: editState.section, example_text: '', source: '', notes: '' }
            }
            heading={editState.mode === 'edit' ? 'Edit voice example' : 'Add voice example'}
            onCancel={() => setEditState({ mode: 'closed' })}
            onSave={async (payload) => {
              try {
                if (editState.mode === 'edit') {
                  await newsletterApi.updateVoiceExample(editState.example.id, payload)
                } else {
                  await newsletterApi.addVoiceExample(payload)
                }
                setEditState({ mode: 'closed' })
                await refresh()
              } catch (err) {
                throw new Error(extractErrorMessage(err, 'Save failed'))
              }
            }}
          />
        )}

        {pendingDelete && (
          <DeleteConfirm
            example={pendingDelete}
            onCancel={() => setPendingDelete(null)}
            onConfirm={handleDelete}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function EditModal({
  initial,
  heading,
  onCancel,
  onSave,
}: {
  initial: { section_type: SectionKey; example_text: string; source: string; notes: string }
  heading: string
  onCancel: () => void
  onSave: (payload: VoiceExampleCreate) => Promise<void>
}) {
  const [section, setSection] = useState<SectionKey>(initial.section_type)
  const [text, setText] = useState(initial.example_text)
  const [source, setSource] = useState(initial.source)
  const [notes, setNotes] = useState(initial.notes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!text.trim()) {
      setError('Example text is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        section_type: section,
        example_text: text.trim(),
        source: source.trim() || null,
        notes: notes.trim() || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

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
        className="bg-surface-0 rounded-2xl border border-border shadow-xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-display font-semibold text-slate-900 mb-4">{heading}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Section
            </label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as SectionKey)}
              className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              {SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Example text *
            </label>
            <textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 leading-relaxed"
            />
          </div>
          <div>
            <label className="block text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Source (optional)
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Retail Today Magazine byline"
              className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What makes this example illustrative"
              className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-loss font-body">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm font-display font-medium text-slate-700 hover:border-slate-400 cursor-pointer"
          >
            <X className="w-4 h-4 inline mr-1" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-display font-medium hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function DeleteConfirm({
  example,
  onCancel,
  onConfirm,
  deleting,
}: {
  example: VoiceExample
  onCancel: () => void
  onConfirm: () => void
  deleting: boolean
}) {
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
          Delete this example?
        </h3>
        <p className="text-sm font-body text-slate-600 mb-5">
          <span className="italic line-clamp-3 inline">
            "{example.example_text.slice(0, 120)}{example.example_text.length > 120 ? '…' : ''}"
          </span>
          <br />
          This example will no longer be used as a few-shot for{' '}
          <span className="font-medium text-slate-900">
            {SECTIONS.find((s) => s.key === example.section_type)?.label}
          </span>{' '}
          generation.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm font-display font-medium text-slate-700 hover:border-slate-400 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-loss text-white text-sm font-display font-medium hover:bg-loss/90 disabled:opacity-50 cursor-pointer"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
