import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react'
import type { VaultDocument } from '@/shared/stores/vault-store'
import { useVaultStore } from '@/shared/stores/vault-store'
import { DOC_TYPE_COLORS, formatFileSize, formatDate } from './document-card'

interface DocumentDetailProps {
  document: VaultDocument
  onClose: () => void
  onChatAbout?: () => void
}

export function DocumentDetail({ document, onClose, onChatAbout }: DocumentDetailProps) {
  const { deleteDocument } = useVaultStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showRawText, setShowRawText] = useState(false)

  const typeColors = DOC_TYPE_COLORS[document.doc_type ?? 'other'] ?? DOC_TYPE_COLORS.other

  let entities: Array<{ name: string; type: string; value: string }> = []
  let keyFacts: string[] = []

  try {
    if (document.entities_json) {
      entities = typeof document.entities_json === 'string'
        ? JSON.parse(document.entities_json)
        : document.entities_json as typeof entities
    }
  } catch { /* ignore */ }

  try {
    if (document.key_facts_json) {
      keyFacts = typeof document.key_facts_json === 'string'
        ? JSON.parse(document.key_facts_json)
        : document.key_facts_json as typeof keyFacts
    }
  } catch { /* ignore */ }

  const entityGroups = entities.reduce<Record<string, typeof entities>>((acc, e) => {
    const key = e.type || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawText = (document as any).raw_text as string | undefined

  const handleDelete = async () => {
    await deleteDocument(document.id)
    onClose()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[480px] bg-surface-0 border-l border-border shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-display font-semibold text-slate-900 truncate pr-4">
            {document.title ?? document.filename}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-surface-1 transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {(document.status === 'pending' || document.status === 'processing') && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <Loader2 className="w-5 h-5 text-amber-600 animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-display font-semibold text-amber-800">Processing your document...</p>
                <p className="text-xs text-amber-600 font-body mt-0.5">This usually takes 15–30 seconds.</p>
              </div>
            </div>
          )}

          {document.status === 'failed' && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-display font-semibold text-red-800">Processing failed</p>
                {document.error_message && (
                  <p className="text-xs text-red-600 font-body mt-0.5">{document.error_message}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {document.doc_type && document.doc_type !== 'other' && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${typeColors.bg} ${typeColors.text} ${typeColors.border}`}>
                  {document.doc_type.replace(/_/g, ' ')}
                </span>
              )}
              <span className="text-xs text-slate-400 font-body uppercase">.{document.file_type}</span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs text-slate-400 font-body">{formatFileSize(document.file_size)}</span>
            </div>
            <p className="text-xs text-slate-400 font-body">
              <FileText className="w-3 h-3 inline mr-1" />
              {document.filename}
              {document.created_at && <> · Uploaded {formatDate(document.created_at)}</>}
            </p>
          </div>

          {document.summary && (
            <div>
              <h3 className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider mb-2">Summary</h3>
              <p className="text-sm text-slate-700 font-body leading-relaxed">{document.summary}</p>
            </div>
          )}

          {keyFacts.length > 0 && (
            <div>
              <h3 className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Facts</h3>
              <ul className="space-y-1.5">
                {keyFacts.map((fact, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700 font-body leading-relaxed">
                    <span className="text-cyan mt-0.5 flex-shrink-0">•</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(entityGroups).length > 0 && (
            <div>
              <h3 className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider mb-2">Entities</h3>
              <div className="space-y-3">
                {Object.entries(entityGroups).map(([type, items]) => (
                  <div key={type}>
                    <p className="text-[11px] font-display font-medium text-slate-400 uppercase mb-1.5">{type}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((entity, i) => (
                        <span
                          key={i}
                          className="text-xs font-body px-2.5 py-1 rounded-lg bg-surface-1 text-slate-700 border border-border"
                          title={entity.value || entity.name}
                        >
                          {entity.name}{entity.value && entity.value !== entity.name ? `: ${entity.value}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rawText && (
            <div>
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="flex items-center gap-1.5 text-xs font-display font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors cursor-pointer"
              >
                {showRawText ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Raw Text
              </button>
              {showRawText && (
                <motion.pre
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-2 p-3 rounded-lg bg-surface-1 border border-border text-xs text-slate-600 font-mono overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap"
                >
                  {rawText}
                </motion.pre>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center gap-2">
          {onChatAbout && document.status === 'completed' && (
            <button
              onClick={onChatAbout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan text-white text-sm font-display font-medium hover:bg-cyan/90 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              Ask about this
            </button>
          )}
          <div className="flex-1" />
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-body text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 rounded-lg text-sm font-body text-slate-500 hover:bg-surface-1 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-2 rounded-lg text-sm font-display font-medium text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
