import { motion } from 'framer-motion'
import { FileText, Table, Image, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import type { VaultDocument } from '@/shared/stores/vault-store'

const DOC_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  bank_statement: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  brokerage_statement: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  receipt: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  invoice: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  contract: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  lease: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  legal: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  insurance: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  tax_document: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  pay_stub: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  medical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  research: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  report: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  notes: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  letter: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  resume: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  other: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
}

const FILE_TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  pdf: { icon: FileText, color: '#DC2626', bg: '#FEF2F2' },
  csv: { icon: Table, color: '#16A34A', bg: '#F0FDF4' },
  txt: { icon: FileText, color: '#6B7280', bg: '#F9FAFB' },
  docx: { icon: FileText, color: '#2563EB', bg: '#EFF6FF' },
  doc: { icon: FileText, color: '#2563EB', bg: '#EFF6FF' },
  png: { icon: Image, color: '#7C3AED', bg: '#F5F3FF' },
  jpg: { icon: Image, color: '#7C3AED', bg: '#F5F3FF' },
  jpeg: { icon: Image, color: '#7C3AED', bg: '#F5F3FF' },
  webp: { icon: Image, color: '#7C3AED', bg: '#F5F3FF' },
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
        <CheckCircle className="w-3 h-3" />
        Ready
      </span>
    )
  }
  if (status === 'processing' || status === 'pending') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600">
        <Loader2 className="w-3 h-3 animate-spin" />
        Processing
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-red-600">
      <AlertCircle className="w-3 h-3" />
      Failed
    </span>
  )
}

interface DocumentCardProps {
  document: VaultDocument
  onClick: () => void
  index: number
}

export function DocumentCard({ document, onClick, index }: DocumentCardProps) {
  const fileConfig = FILE_TYPE_CONFIG[document.file_type] ?? FILE_TYPE_CONFIG.txt
  const FileIcon = fileConfig.icon
  const typeColors = DOC_TYPE_COLORS[document.doc_type ?? 'other'] ?? DOC_TYPE_COLORS.other

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      onClick={onClick}
      className="group rounded-xl border border-border bg-surface-0 p-4 shadow-sm hover:shadow-md hover:border-cyan/30 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: fileConfig.bg }}
        >
          <FileIcon className="w-5 h-5" style={{ color: fileConfig.color }} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-display font-semibold text-slate-900 truncate">
            {document.title ?? document.filename}
          </h3>
          {document.title && (
            <p className="text-[11px] text-slate-400 font-body truncate">{document.filename}</p>
          )}
        </div>
        <StatusBadge status={document.status} />
      </div>

      {document.summary && document.status === 'completed' && (
        <p className="mt-2.5 text-xs text-slate-500 font-body line-clamp-2 leading-relaxed">
          {document.summary}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {document.doc_type && document.doc_type !== 'other' && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeColors.bg} ${typeColors.text} ${typeColors.border}`}>
            {document.doc_type.replace(/_/g, ' ')}
          </span>
        )}
        <span className="text-[10px] text-slate-400 font-body uppercase">{document.file_type}</span>
        <span className="text-[10px] text-slate-300">·</span>
        <span className="text-[10px] text-slate-400 font-body">{formatFileSize(document.file_size)}</span>
        {document.created_at && (
          <>
            <span className="text-[10px] text-slate-300">·</span>
            <span className="text-[10px] text-slate-400 font-body flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatDate(document.created_at)}
            </span>
          </>
        )}
      </div>
    </motion.div>
  )
}

export { DOC_TYPE_COLORS, formatFileSize, formatDate }
