import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  MessageSquare,
  Search,
  Upload,
  FolderOpen,
  HardDrive,
} from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { useVaultStore, type VaultDocument } from '@/shared/stores/vault-store'
import { DocumentCard } from '@/shared/components/vault/document-card'
import { DocumentDetail } from '@/shared/components/vault/document-detail'
import { UploadArea } from '@/shared/components/vault/upload-area'
import { VaultChatTab } from '@/shared/components/vault/vault-chat'
import { VaultSearchTab } from '@/shared/components/vault/vault-search'

type Tab = 'documents' | 'chat' | 'search'

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'search', label: 'Search', icon: Search },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const DOC_TYPE_LABELS: Record<string, string> = {
  bank_statement: 'Bank Statements',
  brokerage_statement: 'Brokerage',
  receipt: 'Receipts',
  invoice: 'Invoices',
  contract: 'Contracts',
  lease: 'Leases',
  legal: 'Legal',
  insurance: 'Insurance',
  tax_document: 'Tax Documents',
  pay_stub: 'Pay Stubs',
  medical: 'Medical',
  research: 'Research',
  report: 'Reports',
  notes: 'Notes',
  letter: 'Letters',
  resume: 'Resumes',
  other: 'Other',
  unclassified: 'Unclassified',
}

export function Vault() {
  const { onMobileMenuToggle } = useLayoutContext()
  const {
    documents,
    selectedDocument,
    isLoading,
    stats,
    docTypeFilter,
    fetchDocuments,
    fetchDocument,
    fetchStats,
    setDocTypeFilter,
    setSelectedDocument,
  } = useVaultStore()

  const [activeTab, setActiveTab] = useState<Tab>('documents')
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetchDocuments()
    fetchStats()
  }, [fetchDocuments, fetchStats])

  const handleDocumentClick = useCallback(
    (doc: VaultDocument) => {
      fetchDocument(doc.id)
    },
    [fetchDocument],
  )

  const handleSearchDocClick = useCallback(
    (docId: string) => {
      fetchDocument(docId)
    },
    [fetchDocument],
  )

  const handleChatAbout = useCallback(
    () => {
      setSelectedDocument(null)
      setActiveTab('chat')
    },
    [setSelectedDocument],
  )

  return (
    <div className="flex flex-col h-full">
      <TopHeader
        title="Vault"
        subtitle="Your document intelligence library"
        onMenuToggle={onMobileMenuToggle}
      >
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan text-white text-sm font-display font-medium hover:bg-cyan/90 transition-colors cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </TopHeader>

      <div className="flex-1 overflow-hidden flex">
        <aside className="hidden lg:flex w-[220px] border-r border-border flex-col py-4 px-3 flex-shrink-0 overflow-y-auto">
          {stats && (
            <div className="mb-4 px-2">
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Stats</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-surface-1 border border-border p-2.5 text-center">
                  <p className="text-lg font-display font-bold text-slate-900">{stats.total}</p>
                  <p className="text-[10px] text-slate-400 font-body">Documents</p>
                </div>
                <div className="rounded-lg bg-surface-1 border border-border p-2.5 text-center">
                  <p className="text-lg font-display font-bold text-slate-900">{formatBytes(stats.total_size)}</p>
                  <p className="text-[10px] text-slate-400 font-body">Total Size</p>
                </div>
              </div>
            </div>
          )}

          {stats && Object.keys(stats.by_type).length > 0 && (
            <div className="mb-4 px-2">
              <p className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider mb-2">By Type</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => setDocTypeFilter(null)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-body transition-colors cursor-pointer ${
                    !docTypeFilter
                      ? 'bg-cyan/10 text-cyan font-medium'
                      : 'text-slate-600 hover:bg-surface-1'
                  }`}
                >
                  <span>All</span>
                  <span className="text-[10px] text-slate-400">{stats.total}</span>
                </button>
                {Object.entries(stats.by_type)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <button
                      key={type}
                      onClick={() => setDocTypeFilter(type === docTypeFilter ? null : type)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-body transition-colors cursor-pointer ${
                        docTypeFilter === type
                          ? 'bg-cyan/10 text-cyan font-medium'
                          : 'text-slate-600 hover:bg-surface-1'
                      }`}
                    >
                      <span className="truncate">{DOC_TYPE_LABELS[type] ?? type}</span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">{count}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-surface-0 overflow-x-auto flex-shrink-0">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-display font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-surface-1'
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                  {tab.label}
                </button>
              )
            })}

            <div className="lg:hidden flex items-center gap-1 ml-auto overflow-x-auto">
              {stats && Object.keys(stats.by_type).length > 0 && (
                <>
                  <button
                    onClick={() => setDocTypeFilter(null)}
                    className={`text-xs font-body px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors cursor-pointer ${
                      !docTypeFilter
                        ? 'bg-cyan/10 text-cyan border-cyan/30'
                        : 'text-slate-500 border-border hover:border-slate-300'
                    }`}
                  >
                    All
                  </button>
                  {Object.entries(stats.by_type)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([type, count]) => (
                      <button
                        key={type}
                        onClick={() => setDocTypeFilter(type === docTypeFilter ? null : type)}
                        className={`text-xs font-body px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors cursor-pointer ${
                          docTypeFilter === type
                            ? 'bg-cyan/10 text-cyan border-cyan/30'
                            : 'text-slate-500 border-border hover:border-slate-300'
                        }`}
                      >
                        {DOC_TYPE_LABELS[type] ?? type} ({count})
                      </button>
                    ))}
                </>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {showUpload && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-b border-border"
              >
                <div className="p-4">
                  <UploadArea />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'documents' && (
                <motion.div
                  key="documents"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  className="h-full overflow-y-auto p-4"
                >
                  {isLoading && documents.length === 0 && (
                    <div className="flex items-center justify-center py-20">
                      <div className="w-6 h-6 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {!isLoading && documents.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 px-6">
                      <FolderOpen className="w-16 h-16 text-slate-200 mb-4" strokeWidth={1} />
                      <p className="text-base font-display font-semibold text-slate-700 mb-1">No documents yet</p>
                      <p className="text-sm text-slate-400 font-body text-center max-w-[320px]">
                        Upload your first document to get started. We support PDF, CSV, TXT, DOCX, and image files.
                      </p>
                      <button
                        onClick={() => setShowUpload(true)}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan text-white text-sm font-display font-medium hover:bg-cyan/90 transition-colors cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Document
                      </button>
                    </div>
                  )}

                  {documents.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {documents.map((doc, i) => (
                        <DocumentCard
                          key={doc.id}
                          document={doc}
                          onClick={() => handleDocumentClick(doc)}
                          index={i}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'chat' && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  <VaultChatTab />
                </motion.div>
              )}

              {activeTab === 'search' && (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  <VaultSearchTab onDocumentClick={handleSearchDocClick} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedDocument && (
          <DocumentDetail
            document={selectedDocument}
            onClose={() => setSelectedDocument(null)}
            onChatAbout={handleChatAbout}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
