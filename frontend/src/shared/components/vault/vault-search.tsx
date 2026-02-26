import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Database, Brain, X } from 'lucide-react'
import { useVaultStore, type VaultSearchResult } from '@/shared/stores/vault-store'

interface VaultSearchTabProps {
  onDocumentClick: (docId: string) => void
}

export function VaultSearchTab({ onDocumentClick }: VaultSearchTabProps) {
  const { searchResults, isSearching, searchDocuments } = useVaultStore()
  const [query, setQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        searchDocuments(value)
      }, 400)
    },
    [searchDocuments],
  )

  const clearSearch = useCallback(() => {
    setQuery('')
    searchDocuments('')
  }, [searchDocuments])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-8 py-2.5 rounded-lg bg-surface-1 border border-border text-sm font-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/50 transition-all"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!query.trim() && (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <Search className="w-10 h-10 text-slate-200 mb-3" strokeWidth={1.2} />
            <p className="text-sm font-display font-semibold text-slate-700">Search your vault</p>
            <p className="text-xs text-slate-400 font-body text-center mt-1">
              Find information across all your documents using keyword or semantic search.
            </p>
          </div>
        )}

        {query.trim() && isSearching && (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {query.trim() && !isSearching && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <Search className="w-8 h-8 text-slate-200 mb-2" strokeWidth={1.2} />
            <p className="text-sm text-slate-500 font-body">No results found for "{query}"</p>
          </div>
        )}

        <AnimatePresence>
          {searchResults.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              {searchResults.map((result, i) => (
                <SearchResultCard
                  key={`${result.doc_id}-${result.source}-${i}`}
                  result={result}
                  index={i}
                  onClick={() => result.doc_id && onDocumentClick(result.doc_id)}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function SearchResultCard({
  result,
  index,
  onClick,
}: {
  result: VaultSearchResult
  index: number
  onClick: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      onClick={onClick}
      className="rounded-lg border border-border bg-surface-0 p-3 hover:border-cyan/30 hover:shadow-sm transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-md bg-surface-1 flex items-center justify-center flex-shrink-0 mt-0.5">
          {result.source === 'memory' ? (
            <Brain className="w-3.5 h-3.5 text-purple-500" />
          ) : (
            <Database className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-display font-semibold text-slate-900 truncate">
              {result.title ?? result.filename ?? 'Untitled'}
            </h4>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
              result.source === 'memory'
                ? 'bg-purple-50 text-purple-600 border border-purple-200'
                : 'bg-slate-50 text-slate-500 border border-slate-200'
            }`}>
              {result.source}
            </span>
          </div>
          {result.snippet && (
            <p className="text-xs text-slate-500 font-body mt-1 line-clamp-2 leading-relaxed">
              {result.snippet}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
