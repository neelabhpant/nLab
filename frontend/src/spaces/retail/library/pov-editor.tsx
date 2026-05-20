import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  X,
  Upload,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import {
  usePOVStore,
  povScreenshotUrl,
  type POVCreate,
  type POV,
} from './stores/pov-store'

interface FormState {
  name: string
  one_liner: string
  problem_statement: string
  architecture: string
  why_cloudera: string
  target_accounts: string[]
  target_persona: string
  ae_hook: string
  demo_link: string
  tags: string[]
}

const EMPTY: FormState = {
  name: '',
  one_liner: '',
  problem_statement: '',
  architecture: '',
  why_cloudera: '',
  target_accounts: [],
  target_persona: '',
  ae_hook: '',
  demo_link: '',
  tags: [],
}

const REQUIRED: Array<keyof FormState> = [
  'name',
  'one_liner',
  'problem_statement',
  'architecture',
  'why_cloudera',
  'target_persona',
  'ae_hook',
]

export function POVEditorPage() {
  const { onMobileMenuToggle } = useLayoutContext()
  const navigate = useNavigate()
  const { povId } = useParams<{ povId: string }>()
  const isEdit = Boolean(povId)
  const { getPOV, createPOV, updatePOV, uploadScreenshot } = usePOVStore()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [existing, setExisting] = useState<POV | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<keyof FormState>>(new Set())

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!isEdit || !povId) return
    setLoading(true)
    getPOV(povId).then((p) => {
      if (p) {
        setExisting(p)
        setForm({
          name: p.name,
          one_liner: p.one_liner,
          problem_statement: p.problem_statement,
          architecture: p.architecture,
          why_cloudera: p.why_cloudera,
          target_accounts: p.target_accounts,
          target_persona: p.target_persona,
          ae_hook: p.ae_hook,
          demo_link: p.demo_link ?? '',
          tags: p.tags,
        })
      } else {
        setError('POV not found')
      }
      setLoading(false)
    })
  }, [isEdit, povId, getPOV])

  // Clean up object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    }
  }, [pendingPreview])

  const missing = useMemo(() => {
    return REQUIRED.filter((f) => {
      const v = form[f]
      return typeof v === 'string' ? v.trim().length === 0 : false
    })
  }, [form])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const markTouched = (key: keyof FormState) =>
    setTouched((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Screenshot must be an image (PNG, JPG, WEBP, or GIF).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Screenshot exceeds the 5 MB limit.')
      return
    }
    setError(null)
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingFile(file)
    setPendingPreview(URL.createObjectURL(file))
  }

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleSave = async () => {
    setTouched(new Set(REQUIRED))
    if (missing.length > 0) {
      setError(`Please fill required fields: ${missing.join(', ')}`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: POVCreate = {
        name: form.name.trim(),
        one_liner: form.one_liner.trim(),
        problem_statement: form.problem_statement.trim(),
        architecture: form.architecture.trim(),
        why_cloudera: form.why_cloudera.trim(),
        target_accounts: form.target_accounts,
        target_persona: form.target_persona.trim(),
        ae_hook: form.ae_hook.trim(),
        demo_link: form.demo_link.trim() || null,
        tags: form.tags,
        demo_screenshot_path: existing?.demo_screenshot_path ?? null,
      }

      let saved: POV
      if (isEdit && povId) {
        saved = await updatePOV(povId, payload)
      } else {
        saved = await createPOV(payload)
      }

      if (pendingFile) {
        await uploadScreenshot(saved.id, pendingFile)
      }

      navigate(`/retail/library/povs/${saved.id}`)
    } catch (err) {
      const message =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to save POV')
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const subtitle = isEdit ? 'Edit POV' : 'New POV'
  const screenshotPreview = pendingPreview
    ?? (existing?.demo_screenshot_path ? povScreenshotUrl(existing.id) : null)

  return (
    <div className="h-full flex flex-col">
      <TopHeader
        title={isEdit ? form.name || 'Edit POV' : 'New POV'}
        subtitle={subtitle}
        onMenuToggle={onMobileMenuToggle}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
          <Link
            to="/retail/library/povs"
            className="inline-flex items-center gap-1.5 text-sm font-display font-medium text-slate-500 hover:text-slate-900 mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to library
          </Link>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Loading…</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <Field
                label="Name"
                required
                error={touched.has('name') && form.name.trim() === ''}
              >
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  onBlur={() => markTouched('name')}
                  placeholder="e.g. New Item Evaluation Platform"
                  className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </Field>

              <Field
                label="One-liner"
                required
                error={touched.has('one_liner') && form.one_liner.trim() === ''}
              >
                <textarea
                  rows={2}
                  value={form.one_liner}
                  onChange={(e) => setField('one_liner', e.target.value)}
                  onBlur={() => markTouched('one_liner')}
                  placeholder="Single-sentence positioning"
                  className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </Field>

              <Field
                label="Problem statement"
                required
                error={touched.has('problem_statement') && form.problem_statement.trim() === ''}
              >
                <textarea
                  rows={5}
                  value={form.problem_statement}
                  onChange={(e) => setField('problem_statement', e.target.value)}
                  onBlur={() => markTouched('problem_statement')}
                  placeholder="The problem this POV solves"
                  className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 leading-relaxed"
                />
              </Field>

              <Field
                label="Architecture"
                required
                error={touched.has('architecture') && form.architecture.trim() === ''}
              >
                <textarea
                  rows={4}
                  value={form.architecture}
                  onChange={(e) => setField('architecture', e.target.value)}
                  onBlur={() => markTouched('architecture')}
                  placeholder="e.g. POS → NiFi → Kafka → Iceberg → CrewAI agents"
                  className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 leading-relaxed"
                />
              </Field>

              <Field
                label="Why Cloudera"
                required
                error={touched.has('why_cloudera') && form.why_cloudera.trim() === ''}
              >
                <textarea
                  rows={4}
                  value={form.why_cloudera}
                  onChange={(e) => setField('why_cloudera', e.target.value)}
                  onBlur={() => markTouched('why_cloudera')}
                  placeholder="Competitive differentiation"
                  className="w-full rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 leading-relaxed"
                />
              </Field>

              <Field label="Target accounts">
                <TagInput
                  values={form.target_accounts}
                  onChange={(v) => setField('target_accounts', v)}
                  placeholder="Type and press Enter or comma"
                />
              </Field>

              <Field
                label="Target persona"
                required
                error={touched.has('target_persona') && form.target_persona.trim() === ''}
              >
                <input
                  type="text"
                  value={form.target_persona}
                  onChange={(e) => setField('target_persona', e.target.value)}
                  onBlur={() => markTouched('target_persona')}
                  placeholder="e.g. CPG merchandising, category management"
                  className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </Field>

              <Field
                label="AE hook"
                required
                error={touched.has('ae_hook') && form.ae_hook.trim() === ''}
              >
                <textarea
                  rows={3}
                  value={form.ae_hook}
                  onChange={(e) => setField('ae_hook', e.target.value)}
                  onBlur={() => markTouched('ae_hook')}
                  placeholder='"Use this when…" for the AE'
                  className="w-full rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 leading-relaxed"
                />
              </Field>

              <Field label="Demo link">
                <input
                  type="url"
                  value={form.demo_link}
                  onChange={(e) => setField('demo_link', e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </Field>

              <Field label="Tags">
                <TagInput
                  values={form.tags}
                  onChange={(v) => setField('tags', v)}
                  placeholder="e.g. agent-studio, iceberg, cpg"
                />
              </Field>

              <Field label="Demo screenshot">
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                    dragging
                      ? 'border-emerald-500 bg-emerald-50/60'
                      : 'border-border bg-surface-1'
                  }`}
                >
                  {screenshotPreview ? (
                    <div className="space-y-3">
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="mx-auto max-h-48 rounded-lg border border-border"
                      />
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-display font-medium hover:bg-slate-800 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          Replace
                          <input type="file" accept="image/*" onChange={onFileInput} className="hidden" />
                        </label>
                        {pendingFile && (
                          <button
                            type="button"
                            onClick={() => {
                              if (pendingPreview) URL.revokeObjectURL(pendingPreview)
                              setPendingFile(null)
                              setPendingPreview(null)
                            }}
                            className="inline-flex items-center gap-1 text-xs font-display font-medium text-slate-500 hover:text-slate-900"
                          >
                            Discard new file
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {pendingFile
                          ? `New file ready: ${pendingFile.name} — will upload after save.`
                          : 'Existing screenshot. Choose a new file to replace.'}
                      </p>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2 py-2">
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                      <span className="text-sm font-display font-medium text-slate-700">
                        Drop an image here or <span className="text-emerald-700 underline">browse</span>
                      </span>
                      <span className="text-[11px] text-slate-400">PNG, JPG, WEBP, or GIF · up to 5 MB</span>
                      <input type="file" accept="image/*" onChange={onFileInput} className="hidden" />
                    </label>
                  )}
                </div>
              </Field>

              {error && (
                <div className="flex items-start gap-2 text-sm font-body text-loss rounded-lg border border-loss/20 bg-loss/5 px-3 py-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => navigate('/retail/library/povs')}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-display font-medium text-slate-700 hover:border-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-display font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create POV'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-sm font-display font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-loss text-xs">*</span>}
        {error && (
          <span className="text-xs font-body text-loss ml-1">required</span>
        )}
      </label>
      {children}
    </div>
  )
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [text, setText] = useState('')

  const commit = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !values.includes(p))
    if (parts.length === 0) return
    onChange([...values, ...parts])
    setText('')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(text)
    } else if (e.key === 'Backspace' && text === '' && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  const remove = (v: string) => onChange(values.filter((x) => x !== v))

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-2 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-[12px] font-display font-medium text-emerald-800 border border-emerald-100"
        >
          {v}
          <button
            type="button"
            onClick={() => remove(v)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            aria-label={`Remove ${v}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => commit(text)}
        placeholder={values.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none px-1 py-0.5"
      />
    </div>
  )
}
