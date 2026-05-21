import { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search, ExternalLink, ChevronDown, Check } from 'lucide-react'
import { usePOVStore, type POV } from '@/spaces/retail/library/stores/pov-store'

interface POVPickerProps {
  selectedId: string | null | undefined
  onChange: (povId: string | null, pov: POV | null) => void
}

export function POVPicker({ selectedId, onChange }: POVPickerProps) {
  const { povs, fetchPOVs } = usePOVStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (povs.length === 0) void fetchPOVs()
  }, [povs.length, fetchPOVs])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const selected = useMemo(() => povs.find((p) => p.id === selectedId) ?? null, [povs, selectedId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return povs
    return povs.filter((p) => {
      const hay = [p.name, p.one_liner, ...p.tags, ...p.target_accounts].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [povs, query])

  const handleSelect = (pov: POV) => {
    onChange(pov.id, pov)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-0 px-3 py-2.5 text-left text-sm font-body text-slate-900 hover:border-emerald-400 transition-colors cursor-pointer"
      >
        {selected ? (
          <div className="min-w-0 flex-1">
            <div className="font-display font-semibold text-slate-900 truncate">{selected.name}</div>
            <div className="text-xs text-slate-500 truncate">{selected.one_liner}</div>
          </div>
        ) : (
          <span className="text-slate-400">
            Select a POV from your library{' '}
            <Link
              to="/retail/library/povs"
              onClick={(e) => e.stopPropagation()}
              className="text-emerald-700 underline ml-1"
            >
              Browse Library
            </Link>
          </span>
        )}
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 rounded-xl border border-border bg-surface-0 shadow-xl overflow-hidden">
          <div className="relative border-b border-border">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search POVs"
              className="w-full pl-9 pr-3 py-2.5 text-sm font-body text-slate-900 bg-transparent focus:outline-none"
            />
          </div>
          <ul className="max-h-72 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm font-body text-slate-500">No POVs match.</li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(p)}
                    className={`w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-start gap-2 cursor-pointer ${
                      p.id === selectedId ? 'bg-emerald-50/60' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-display font-semibold text-slate-900 truncate">{p.name}</div>
                      <div className="text-xs font-body text-slate-500 truncate">{p.one_liner}</div>
                    </div>
                    {p.id === selectedId && (
                      <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {selected && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          <Link
            to={`/retail/library/povs/${selected.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-700 font-display font-medium hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Open POV
          </Link>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="text-slate-500 font-display font-medium hover:text-slate-900 cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
