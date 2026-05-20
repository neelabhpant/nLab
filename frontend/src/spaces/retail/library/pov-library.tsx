import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Target, Eye, Pencil, Sparkles, X } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { usePOVStore, type POV } from './stores/pov-store'

export function POVLibraryPage() {
  const { onMobileMenuToggle } = useLayoutContext()
  const navigate = useNavigate()
  const { povs, loading, error, fetchPOVs, seedLibrary } = usePOVStore()

  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    fetchPOVs()
  }, [fetchPOVs])

  const allTags = useMemo(() => {
    const seen = new Map<string, number>()
    for (const p of povs) {
      for (const t of p.tags) seen.set(t, (seen.get(t) ?? 0) + 1)
    }
    return Array.from(seen.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag)
  }, [povs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return povs.filter((p) => {
      if (activeTag && !p.tags.includes(activeTag)) return false
      if (!q) return true
      const haystack = [
        p.name,
        p.one_liner,
        ...p.tags,
        ...p.target_accounts,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [povs, query, activeTag])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedLibrary()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <TopHeader
        title="POV Library"
        subtitle="Hand-curated retail AI use cases for the Newsletter and customer conversations"
        onMenuToggle={onMobileMenuToggle}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-5">
          {/* Search row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, tag, or account"
                className="w-full rounded-xl border border-border bg-surface-0 pl-9 pr-9 py-2.5 text-sm font-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => navigate('/retail/library/povs/new')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-display font-medium hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New POV
            </button>
          </div>

          {/* Tag chip filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTag(null)}
                className={`px-3 py-1 rounded-full text-xs font-display font-medium border transition-colors cursor-pointer ${
                  activeTag === null
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-surface-0 text-slate-600 border-border hover:border-slate-400'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`px-3 py-1 rounded-full text-xs font-display font-medium border transition-colors cursor-pointer ${
                    activeTag === tag
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-surface-0 text-slate-600 border-border hover:border-emerald-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Grid / empty / loading / error */}
          {loading && povs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Loading POVs...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-loss/20 bg-loss/5 p-4 text-sm text-loss">
              {error}
            </div>
          ) : povs.length === 0 ? (
            <EmptyState onSeed={handleSeed} seeding={seeding} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Target className="w-8 h-8 text-slate-300" />
              <p className="text-sm text-slate-500">No POVs match your filters.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p, i) => (
                  <POVCard key={p.id} pov={p} index={i} />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}

function POVCard({ pov, index }: { pov: POV; index: number }) {
  const navigate = useNavigate()
  const accountsToShow = pov.target_accounts.slice(0, 3)
  const overflow = pov.target_accounts.length - accountsToShow.length
  const tagsToShow = pov.tags.slice(0, 3)
  const tagOverflow = pov.tags.length - tagsToShow.length

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
      className="group rounded-xl border border-border bg-surface-0 p-5 shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col"
    >
      <Link to={`/retail/library/povs/${pov.id}`} className="block flex-1">
        <h3 className="text-base font-display font-semibold text-slate-900 leading-snug mb-2 group-hover:text-emerald-700 transition-colors">
          {pov.name}
        </h3>
        <p
          className="text-sm font-body text-slate-600 mb-4"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {pov.one_liner}
        </p>
      </Link>

      <div className="space-y-3 mt-auto">
        <div>
          <p className="text-[10px] font-display font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Target accounts
          </p>
          <div className="flex flex-wrap gap-1">
            {accountsToShow.map((a) => (
              <span
                key={a}
                className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-body text-slate-700"
              >
                {a}
              </span>
            ))}
            {overflow > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-slate-50 text-[11px] font-body text-slate-500">
                +{overflow} more
              </span>
            )}
          </div>
        </div>

        {tagsToShow.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tagsToShow.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full bg-emerald-50 text-[10px] font-display font-medium text-emerald-700 border border-emerald-100"
              >
                {t}
              </span>
            ))}
            {tagOverflow > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-50 text-[10px] font-display font-medium text-slate-500 border border-slate-100">
                +{tagOverflow}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            onClick={() => navigate(`/retail/library/povs/${pov.id}`)}
            className="inline-flex items-center gap-1 text-xs font-display font-medium text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </button>
          <button
            onClick={() => navigate(`/retail/library/povs/${pov.id}/edit`)}
            className="inline-flex items-center gap-1 text-xs font-display font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState({ onSeed, seeding }: { onSeed: () => void; seeding: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 inline-flex items-center justify-center mb-4">
        <Target className="w-6 h-6" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-display font-semibold text-slate-900 mb-1">No POVs yet</h3>
      <p className="text-sm font-body text-slate-500 mb-5 text-center max-w-md">
        Load the six pre-seeded retail POVs (NIE, Visual Intelligence, Customer 360, Demand Intelligence, Mars Innovation Engine, Workforce Intelligence) to get started.
      </p>
      <button
        onClick={onSeed}
        disabled={seeding}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-display font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
      >
        {seeding ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {seeding ? 'Loading…' : 'Load Seed Data'}
      </button>
    </div>
  )
}
