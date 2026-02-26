import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useVaultStore } from '@/shared/stores/vault-store'

const ALLOWED_EXTENSIONS = ['pdf', 'csv', 'txt', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'webp']
const MAX_FILE_SIZE = 20 * 1024 * 1024
const ACCEPT_STRING = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')

interface QueueItem {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

export function UploadArea() {
  const { uploadFile } = useVaultStore()
  const [dragOver, setDragOver] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false)

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type: .${ext}`
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 20MB.'
    }
    return null
  }

  const processQueue = useCallback(async (items: QueueItem[]) => {
    if (processingRef.current) return
    processingRef.current = true

    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== 'pending') continue

      setQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, status: 'uploading' as const } : q)),
      )

      try {
        await uploadFile(items[i].file)
        setQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: 'done' as const } : q)),
        )
      } catch (err) {
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? { ...q, status: 'error' as const, error: err instanceof Error ? err.message : 'Upload failed' }
              : q,
          ),
        )
      }
    }

    processingRef.current = false
    setTimeout(() => {
      setQueue((prev) => prev.filter((q) => q.status === 'pending' || q.status === 'uploading'))
    }, 4000)
  }, [uploadFile])

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newItems: QueueItem[] = []
      for (const file of Array.from(files)) {
        const error = validateFile(file)
        if (error) {
          newItems.push({ file, status: 'error', error })
        } else {
          newItems.push({ file, status: 'pending' })
        }
      }
      const updated = [...queue, ...newItems]
      setQueue(updated)
      processQueue(updated)
    },
    [queue, processQueue],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files)
        e.target.value = ''
      }
    },
    [addFiles],
  )

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'border-cyan bg-cyan/5 scale-[1.01]'
            : 'border-border hover:border-cyan/40 hover:bg-surface-1/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload
          className={`w-8 h-8 mx-auto mb-2 transition-colors ${
            dragOver ? 'text-cyan' : 'text-slate-300'
          }`}
          strokeWidth={1.5}
        />
        <p className="text-sm font-display font-medium text-slate-700">
          {dragOver ? 'Drop files here' : 'Drop files or click to upload'}
        </p>
        <p className="text-xs text-slate-400 font-body mt-1">
          PDF, CSV, TXT, DOCX, images · Max 20MB
        </p>
      </div>

      <AnimatePresence>
        {queue.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-1.5 overflow-hidden"
          >
            {queue.map((item, i) => (
              <motion.div
                key={`${item.file.name}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-1 border border-border"
              >
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-xs font-body text-slate-700 truncate flex-1">{item.file.name}</span>
                {item.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 text-cyan animate-spin flex-shrink-0" />}
                {item.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                {item.status === 'error' && (
                  <span className="flex items-center gap-1 text-[10px] text-red-500 flex-shrink-0" title={item.error}>
                    <AlertCircle className="w-3.5 h-3.5" />
                  </span>
                )}
                {item.status === 'pending' && (
                  <span className="text-[10px] text-slate-400 flex-shrink-0">Queued</span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
