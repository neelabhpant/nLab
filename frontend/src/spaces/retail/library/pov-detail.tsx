import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ExternalLink,
  Building2,
  Target as TargetIcon,
  Megaphone,
  ImageOff,
  AlertCircle,
} from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { usePOVStore, povScreenshotUrl, type POV } from './stores/pov-store'

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

export function POVDetailPage() {
  const { onMobileMenuToggle } = useLayoutContext()
  const navigate = useNavigate()
  const { povId } = useParams<{ povId: string }>()
  const { getPOV, deletePOV } = usePOVStore()

  const [pov, setPov] = useState<POV | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    if (!povId) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setImgFailed(false)
    getPOV(povId).then((p) => {
      if (cancelled) return
      if (!p) setNotFound(true)
      setPov(p)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [povId, getPOV])

  const handleDelete = async () => {
    if (!povId) return
    setDeleting(true)
    try {
      await deletePOV(povId)
      navigate('/retail/library/povs')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <TopHeader
        title={pov?.name ?? 'POV'}
        subtitle="POV Library"
        onMenuToggle={onMobileMenuToggle}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
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
              <p className="text-sm text-slate-500">Loading POV…</p>
            </div>
          ) : notFound || !pov ? (
            <div className="rounded-xl border border-loss/20 bg-loss/5 p-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-loss" />
              <p className="text-sm text-slate-700">
                POV not found.{' '}
                <Link to="/retail/library/povs" className="underline text-loss font-medium">
                  Back to library
                </Link>
              </p>
            </div>
          ) : (
            <>
              {/* Title row + actions */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 leading-tight">
                    {pov.name}
                  </h1>
                  <p className="text-base font-body text-slate-700 mt-2 leading-relaxed max-w-3xl">
                    {pov.one_liner}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/retail/library/povs/${pov.id}/edit`)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-0 text-sm font-display font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-loss/30 bg-loss/5 text-sm font-display font-medium text-loss hover:bg-loss/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left column: 60% */}
                <div className="lg:col-span-3 space-y-5">
                  <Section title="Problem">
                    <p className="text-sm font-body text-slate-700 leading-relaxed whitespace-pre-line">
                      {pov.problem_statement}
                    </p>
                  </Section>

                  <Section title="Architecture">
                    <pre className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-3 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                      {pov.architecture}
                    </pre>
                  </Section>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
                    <p className="text-[10px] font-display font-semibold uppercase tracking-wider text-emerald-700 mb-2">
                      Why Cloudera
                    </p>
                    <p className="text-sm font-body text-slate-800 leading-relaxed whitespace-pre-line">
                      {pov.why_cloudera}
                    </p>
                  </div>
                </div>

                {/* Right column: 40% */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Screenshot */}
                  <div className="rounded-xl border border-border bg-surface-0 overflow-hidden">
                    {pov.demo_screenshot_path && !imgFailed ? (
                      <img
                        src={povScreenshotUrl(pov.id)}
                        alt={`${pov.name} screenshot`}
                        onError={() => setImgFailed(true)}
                        className="w-full aspect-[16/10] object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-[16/10] flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">
                        <ImageOff className="w-6 h-6" />
                        <p className="text-xs font-body">No screenshot</p>
                      </div>
                    )}
                  </div>

                  <SidebarBlock
                    icon={<Building2 className="w-4 h-4" />}
                    title="Target accounts"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {pov.target_accounts.length === 0 ? (
                        <span className="text-xs text-slate-400">None</span>
                      ) : (
                        pov.target_accounts.map((a) => (
                          <span
                            key={a}
                            className="px-2 py-1 rounded-md bg-slate-100 text-[12px] font-body text-slate-800"
                          >
                            {a}
                          </span>
                        ))
                      )}
                    </div>
                  </SidebarBlock>

                  <SidebarBlock
                    icon={<TargetIcon className="w-4 h-4" />}
                    title="Target persona"
                  >
                    <p className="text-sm font-body text-slate-700 leading-relaxed">
                      {pov.target_persona}
                    </p>
                  </SidebarBlock>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Megaphone className="w-4 h-4 text-amber-700" />
                      <p className="text-[10px] font-display font-semibold uppercase tracking-wider text-amber-800">
                        AE hook
                      </p>
                    </div>
                    <p className="text-sm font-body text-slate-800 leading-relaxed whitespace-pre-line">
                      {pov.ae_hook}
                    </p>
                  </div>

                  {pov.tags.length > 0 && (
                    <SidebarBlock title="Tags">
                      <div className="flex flex-wrap gap-1">
                        {pov.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-full bg-emerald-50 text-[11px] font-display font-medium text-emerald-700 border border-emerald-100"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </SidebarBlock>
                  )}

                  {pov.demo_link && (
                    <a
                      href={pov.demo_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-display font-medium hover:bg-slate-800 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open demo
                    </a>
                  )}

                  <div className="text-[11px] text-slate-400 font-body pt-2 border-t border-border">
                    <div>Created {formatDate(pov.created_at)}</div>
                    <div>Updated {formatDate(pov.updated_at)}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDelete && pov && (
          <DeleteConfirm
            name={pov.name}
            onCancel={() => setShowDelete(false)}
            onConfirm={handleDelete}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </p>
      {children}
    </div>
  )
}

function SidebarBlock({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-0 p-4">
      <div className="flex items-center gap-1.5 mb-2 text-slate-500">
        {icon}
        <p className="text-[10px] font-display font-semibold uppercase tracking-wider">
          {title}
        </p>
      </div>
      {children}
    </div>
  )
}

function DeleteConfirm({
  name,
  onCancel,
  onConfirm,
  deleting,
}: {
  name: string
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
          Delete this POV?
        </h3>
        <p className="text-sm font-body text-slate-600 mb-5">
          <span className="font-medium text-slate-900">{name}</span> will be permanently
          removed from the library. This cannot be undone.
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
            {deleting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {deleting ? 'Deleting…' : 'Delete POV'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
