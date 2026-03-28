import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb,
  Zap,
  Copy,
  Check,
  FileDown,
  Mail,
  Send,
  X,
  Loader2,
  Download,
  CheckCircle2,
} from 'lucide-react'
import type { UseCaseSpark } from '../stores/retail-store'
import { useRetailStore } from '../stores/retail-store'
import { useLayoutContext } from '@/shared/components/layout'
import { TopHeader } from '@/shared/components/top-header'

const CAPABILITY_COLORS: Record<string, string> = {
  NiFi: 'bg-orange-50 text-orange-700 border-orange-200',
  Kafka: 'bg-purple-50 text-purple-700 border-purple-200',
  Spark: 'bg-red-50 text-red-700 border-red-200',
  Iceberg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  CML: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Agent Studio': 'bg-blue-50 text-blue-700 border-blue-200',
  'RAG Studio': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Data Warehouse': 'bg-amber-50 text-amber-700 border-amber-200',
  DataFlow: 'bg-teal-50 text-teal-700 border-teal-200',
}

function getCapColor(cap: string): string {
  return CAPABILITY_COLORS[cap] || 'bg-slate-50 text-slate-700 border-slate-200'
}

function copySparkText(spark: UseCaseSpark) {
  const lines = [
    `USE CASE: ${spark.title}`,
    `Confidence: ${(spark.confidence * 100).toFixed(0)}%`,
    '',
    'PROBLEM:',
    spark.retail_problem || '(none)',
    '',
    'SOLUTION:',
    spark.description,
  ]
  if (spark.architecture_flow) {
    lines.push('', 'ARCHITECTURE:', spark.architecture_flow)
  }
  if (spark.competitive_advantage) {
    lines.push('', 'WHY CLOUDERA:', spark.competitive_advantage)
  }
  lines.push(
    '',
    `Cloudera Capabilities: ${spark.cloudera_capabilities.join(', ')}`,
  )
  if (spark.article_title) {
    lines.push(`Source Article: ${spark.article_title}`)
  }
  return lines.join('\n')
}

function NewsletterModal({ onClose }: { onClose: () => void }) {
  const {
    sparks,
    newsletterFileId,
    newsletterLoading,
    newsletterSending,
    newsletterSent,
    generateNewsletter,
    downloadNewsletter,
    sendNewsletter,
    clearNewsletter,
  } = useRetailStore()

  const [topN, setTopN] = useState(Math.min(sparks.length, 10))
  const [recipients, setRecipients] = useState('')
  const [subject, setSubject] = useState('Retail AI Use Case Sparks — Weekly Newsletter')
  const [body, setBody] = useState('')

  const handleClose = () => {
    clearNewsletter()
    onClose()
  }

  const handleGenerate = () => {
    generateNewsletter(topN)
  }

  const handleSend = () => {
    if (!newsletterFileId || !recipients.trim()) return
    const recipientList = recipients.split(',').map((r) => r.trim()).filter(Boolean)
    sendNewsletter(newsletterFileId, recipientList, subject || undefined, body || undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 overflow-hidden"
      >
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-base">Create Newsletter</h2>
            <p className="text-slate-400 text-xs mt-0.5">Generate a PDF of top use case sparks and share via email</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Include top sparks
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={Math.min(sparks.length, 20)}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="text-sm font-semibold text-slate-900 w-8 text-center">{topN}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Top {topN} sparks by confidence will be included
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={newsletterLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {newsletterLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Generate PDF
                </>
              )}
            </button>
            {newsletterFileId && (
              <button
                onClick={() => downloadNewsletter(newsletterFileId)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 border border-emerald-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            )}
          </div>

          {newsletterFileId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 pt-3 border-t border-slate-100"
            >
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Newsletter</span>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Recipients</label>
                <input
                  type="text"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="email@example.com, another@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Message (optional)</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="Add a personal note..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 resize-none"
                />
              </div>

              <button
                onClick={handleSend}
                disabled={newsletterSending || !recipients.trim() || newsletterSent}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  newsletterSent
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50'
                }`}
              >
                {newsletterSent ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Newsletter Sent
                  </>
                ) : newsletterSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Newsletter
                  </>
                )}
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export function RetailSparks() {
  const { onMobileMenuToggle } = useLayoutContext()
  const { sparks, sparksLoading, fetchSparks } = useRetailStore()
  const [copied, setCopied] = useState<string | null>(null)
  const [showNewsletter, setShowNewsletter] = useState(false)

  const handleCopySpark = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  useEffect(() => {
    fetchSparks()
  }, [fetchSparks])

  return (
    <div className="h-full flex flex-col">
      <TopHeader title="Use Case Sparks" subtitle="AI-identified opportunities linking retail trends to Cloudera capabilities" onMenuToggle={onMobileMenuToggle} />
      <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">

        {sparks.length > 0 && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowNewsletter(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Mail className="w-4 h-4" />
              Create Newsletter
            </button>
          </div>
        )}

        {sparksLoading && sparks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading sparks...</p>
          </div>
        ) : sparks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Lightbulb className="w-10 h-10 text-slate-300" />
            <p className="text-sm text-slate-500">No use case sparks yet. Fetch and summarize articles to generate sparks.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sparks.map((spark, i) => (
              <motion.div
                key={spark.id || i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-4.5 h-4.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">{spark.title}</h3>
                    {spark.article_title && (
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">From: {spark.article_title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span className="text-[11px] font-semibold text-amber-600">{(spark.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-3">{spark.description}</p>

                {spark.retail_problem && (
                  <div className="border-l-2 border-amber-300 pl-3 mb-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Problem</p>
                    <p className="text-xs text-slate-700">{spark.retail_problem}</p>
                  </div>
                )}

                {spark.architecture_flow && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3 overflow-x-auto">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Architecture</p>
                    <p className="text-[11px] text-slate-700 font-mono leading-relaxed whitespace-pre">{spark.architecture_flow}</p>
                  </div>
                )}

                {spark.competitive_advantage && (
                  <div className="bg-teal-50 rounded-lg px-3 py-2 mb-3">
                    <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider mb-0.5">Why Cloudera</p>
                    <p className="text-[11px] text-teal-800 leading-relaxed">{spark.competitive_advantage}</p>
                  </div>
                )}

                <div className="flex items-end justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {spark.cloudera_capabilities.map((cap) => {
                      const label = cap.includes(':') ? cap.split(':')[0].trim() : cap
                      return (
                        <span
                          key={cap}
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getCapColor(label)}`}
                          title={cap}
                        >
                          {cap}
                        </span>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => handleCopySpark(spark.id || spark.title, copySparkText(spark))}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
                    title="Copy spark"
                  >
                    {copied === (spark.id || spark.title) ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      </div>

      <AnimatePresence>
        {showNewsletter && <NewsletterModal onClose={() => setShowNewsletter(false)} />}
      </AnimatePresence>
    </div>
  )
}
