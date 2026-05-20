import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw,
  Newspaper,
  Lightbulb,
  TrendingUp,
  Clock,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Copy,
  Check,
  ChevronRight,
  Calendar,
  FileText,
  Download,
  X,
  Loader2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useRetailStore } from '../stores/retail-store'
import { generateProfessionalPDF } from '../utils/pdf-report'
import type { RetailArticle, UseCaseSpark } from '../stores/retail-store'
import { useLayoutContext } from '@/shared/components/layout'
import { TopHeader } from '@/shared/components/top-header'
import { Link } from 'react-router-dom'

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const SOURCE_COLORS: Record<string, string> = {
  retail_dive: 'bg-blue-500',
  grocery_dive: 'bg-green-500',
  chain_store_age: 'bg-indigo-500',
  total_retail: 'bg-purple-500',
  nrf_blog: 'bg-red-500',
  retail_touchpoints: 'bg-teal-500',
  progressive_grocer: 'bg-emerald-500',
  supermarket_news: 'bg-amber-500',
  ris_news: 'bg-orange-500',
  retail_wire: 'bg-pink-500',
}

function SourceAvatar({ sourceId }: { sourceId: string }) {
  const color = SOURCE_COLORS[sourceId] || 'bg-slate-400'
  const label = sourceId.replace(/_/g, ' ')
  const initial = label.charAt(0).toUpperCase()
  return (
    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
      <span className="text-[11px] font-bold text-white">{initial}</span>
    </div>
  )
}

function RelevanceDot({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null
  const color = score >= 0.7 ? 'bg-emerald-500' : score >= 0.4 ? 'bg-amber-500' : 'bg-slate-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[11px] font-medium text-slate-500">{(score * 100).toFixed(0)}</span>
    </div>
  )
}

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

function SparkCard({ spark, copiedId, onCopy }: { spark: UseCaseSpark; copiedId: string | null; onCopy: (id: string, text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-semibold text-slate-900 leading-snug">{spark.title}</h4>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">
              {(spark.confidence * 100).toFixed(0)}%
            </span>
          </div>
          {spark.article_title && (
            <p className="text-[11px] text-slate-400 mb-1.5 truncate">From: {spark.article_title}</p>
          )}
          <p className="text-xs text-slate-600 leading-relaxed mb-2">{spark.description}</p>
          {spark.retail_problem && (
            <div className="border-l-2 border-amber-300 pl-3 mb-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Problem</p>
              <p className="text-xs text-slate-700 leading-relaxed">{spark.retail_problem}</p>
            </div>
          )}
          {spark.architecture_flow && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2 overflow-x-auto">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Architecture</p>
              <p className="text-[11px] text-slate-700 font-mono leading-relaxed whitespace-pre">{spark.architecture_flow}</p>
            </div>
          )}
          {spark.competitive_advantage && (
            <div className="bg-teal-50 rounded-lg px-3 py-2 mb-2">
              <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider mb-0.5">Why Cloudera</p>
              <p className="text-[11px] text-teal-800 leading-relaxed">{spark.competitive_advantage}</p>
            </div>
          )}
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {spark.cloudera_capabilities.map((cap) => {
                const label = cap.includes(':') ? cap.split(':')[0].trim() : cap
                return (
                  <span
                    key={cap}
                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md border ${getCapColor(label)}`}
                    title={cap}
                  >
                    {cap}
                  </span>
                )
              })}
            </div>
            <button
              onClick={() => onCopy(spark.id || spark.title, copySparkText(spark))}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
              title="Copy spark"
            >
              {copiedId === (spark.id || spark.title) ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ArticleRow({
  article,
  onBookmark,
  onCopy,
  copied,
}: {
  article: RetailArticle
  onBookmark: (id: string) => void
  onCopy: (article: RetailArticle) => void
  copied: string | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`group px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors ${
        article.is_read ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <SourceAvatar sourceId={article.source_id} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <RelevanceDot score={article.relevance_score} />
            <span className="text-[11px] font-medium text-slate-400 uppercase">{article.source_id.replace(/_/g, ' ')}</span>
            <span className="text-[11px] text-slate-400">{timeAgo(article.published_at || article.fetched_at)}</span>
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-slate-900 hover:text-sky-600 transition-colors leading-snug"
          >
            {article.title}
            <ExternalLink className="inline w-3 h-3 ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />
          </a>
          {article.summary && (
            <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">{article.summary}</p>
          )}
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {article.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onCopy(article)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Copy summary"
          >
            {copied === article.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onBookmark(article.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
            title="Bookmark"
          >
            {article.is_bookmarked ? <BookmarkCheck className="w-3.5 h-3.5 text-amber-500" /> : <Bookmark className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function RetailDashboard() {
  const { onMobileMenuToggle } = useLayoutContext()
  const {
    digest,
    digestLoading,
    digestDates,
    fetchDigest,
    refreshDigest,
    fetchDigestDates,
    toggleBookmark,
    fetchingArticles,
    fetchNewArticles,
    report,
    reportLoading,
    generateReport,
    clearReport,
    fetchStructuredReport,
    structuredReportLoading,
  } = useRetailStore()

  const [copied, setCopied] = useState<string | null>(null)
  const [copiedTheme, setCopiedTheme] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportCopied, setReportCopied] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    fetchDigest()
    fetchDigestDates()
  }, [fetchDigest, fetchDigestDates])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchNewArticles()
    await refreshDigest()
    setRefreshing(false)
  }

  const handleCopy = (article: RetailArticle) => {
    const dateStr2 = (article.published_at || article.fetched_at || '').slice(0, 10)
    const lines = [
      article.title,
      `Source: ${article.source_id.replace(/_/g, ' ')} | ${dateStr2}`,
    ]
    if (article.summary) {
      lines.push('', 'Summary:', article.summary)
    }
    if (article.key_takeaways.length > 0) {
      lines.push('', 'Key Takeaways:', ...article.key_takeaways.map((t) => `- ${t}`))
    }
    const bestSpark = article.use_case_sparks.length > 0
      ? article.use_case_sparks.reduce((best, s) => s.confidence > best.confidence ? s : best, article.use_case_sparks[0])
      : null
    if (bestSpark) {
      lines.push('', `Use Case Opportunity: ${bestSpark.title} — ${bestSpark.description}`)
    }
    lines.push('', `Link: ${article.url}`)
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(article.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCopySpark = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCopyTheme = () => {
    if (!digest) return
    const d = digest.date
    const topArticles = articles.slice(0, 3)
    const lines = [
      `RETAIL INTEL — ${d}`,
      '',
      `Theme: ${digest.top_theme}`,
      '',
      digest.theme_summary,
    ]
    if (topArticles.length > 0) {
      lines.push('', 'Top Articles:')
      topArticles.forEach((a, i) => {
        lines.push(`${i + 1}. ${a.title} (${a.source_id.replace(/_/g, ' ')})`)
      })
    }
    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedTheme(true)
    setTimeout(() => setCopiedTheme(false), 2000)
  }

  const articles = digest?.articles ?? []
  const sparks = digest?.use_case_sparks ?? []

  const dateStr = digest?.date
    ? new Date(digest.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Loading...'

  return (
    <div className="h-full flex flex-col">
      <TopHeader title="Daily Digest" subtitle={dateStr} onMenuToggle={onMobileMenuToggle}>
        <button
          onClick={() => {
            setShowReport(true)
            generateReport(digest?.date)
          }}
          disabled={!digest || reportLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          Generate Report
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing || fetchingArticles || digestLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 text-sky-700 text-sm font-medium hover:bg-sky-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing || fetchingArticles ? 'animate-spin' : ''}`} />
          {refreshing || fetchingArticles ? 'Fetching...' : 'Refresh'}
        </button>
      </TopHeader>
      <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">

        {digestLoading && !digest ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading retail intelligence...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6">
              {digest?.top_theme && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative bg-gradient-to-br from-sky-50 to-white rounded-xl border border-sky-200 p-5"
                >
                  <button
                    onClick={handleCopyTheme}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-sky-400 hover:text-sky-700 hover:bg-sky-100 transition-colors"
                    title="Copy theme"
                  >
                    {copiedTheme ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider mb-1">Today's Theme</p>
                      <h2 className="text-lg font-display font-bold text-slate-900 leading-tight">
                        {digest.top_theme}
                      </h2>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{digest.theme_summary}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-sky-100">
                    {digest.source_breakdown && Object.keys(digest.source_breakdown).length > 0 ? (
                      <div className="flex items-center gap-3">
                        <Newspaper className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-[11px] text-slate-500">
                          {digest.article_count} articles from {Object.keys(digest.source_breakdown).length} sources
                        </span>
                      </div>
                    ) : <div />}
                    <span className="text-[10px] text-slate-400 italic">nLab Retail Intelligence</span>
                  </div>
                </motion.div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-display font-semibold text-slate-900 uppercase tracking-wider">Top Articles</h3>
                  <Link
                    to="/retail/articles"
                    className="flex items-center gap-1 text-xs text-sky-600 font-medium hover:text-sky-700"
                  >
                    View All <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[calc(100vh-340px)] overflow-y-auto">
                  {articles.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Newspaper className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No articles yet. Click Refresh to fetch sources.</p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {articles.slice(0, 8).map((article, i) => (
                        <motion.div
                          key={article.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <ArticleRow
                            article={article}
                            onBookmark={toggleBookmark}
                            onCopy={handleCopy}
                            copied={copied}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
              {sparks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-display font-semibold text-slate-900 uppercase tracking-wider">Use Case Sparks</h3>
                    <Link
                      to="/retail/sparks"
                      className="flex items-center gap-1 text-xs text-sky-600 font-medium hover:text-sky-700"
                    >
                      All <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="flex flex-col gap-3">
                    {sparks.slice(0, 4).map((spark, i) => (
                      <motion.div
                        key={spark.id || i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                      >
                        <SparkCard spark={spark} copiedId={copied} onCopy={handleCopySpark} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {digestDates.length > 0 && (
                <div>
                  <h3 className="text-sm font-display font-semibold text-slate-900 uppercase tracking-wider mb-3">Digest Timeline</h3>
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-col gap-1">
                      {digestDates.slice(0, 7).map((date) => {
                        const d = new Date(date + 'T00:00:00')
                        const isToday = date === digest?.date
                        return (
                          <button
                            key={date}
                            onClick={() => fetchDigest(date)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              isToday ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5" />
                              {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            {isToday && <span className="w-2 h-2 rounded-full bg-sky-500" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">Auto-refresh</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Sources are fetched automatically every hour during active hours (6am–10pm). Articles are summarized and embedded for search.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      <AnimatePresence>
        {showReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowReport(false); clearReport() } }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
                    <FileText className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-display font-bold text-slate-900">Executive Briefing</h2>
                    <p className="text-[11px] text-slate-400">{dateStr}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {report && (
                    <>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(report)
                          setReportCopied(true)
                          setTimeout(() => setReportCopied(false), 2000)
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        {reportCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {reportCopied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        disabled={exportingPdf || structuredReportLoading}
                        onClick={async () => {
                          setExportingPdf(true)
                          setPdfError(null)
                          try {
                            const structured = await fetchStructuredReport(digest?.date)
                            if (structured) {
                              generateProfessionalPDF(structured)
                            } else {
                              setPdfError('PDF generation failed — try again')
                              setTimeout(() => setPdfError(null), 4000)
                            }
                          } catch {
                            setPdfError('PDF generation failed — try again')
                            setTimeout(() => setPdfError(null), 4000)
                          } finally {
                            setExportingPdf(false)
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                      >
                        {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {pdfError ? pdfError : exportingPdf ? 'Generating PDF...' : 'PDF'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setShowReport(false); clearReport() }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto px-8 py-6">
                {reportLoading && !report ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                    <p className="text-sm text-slate-500">Generating executive briefing...</p>
                    <p className="text-[11px] text-slate-400">Analyzing {digest?.article_count || 0} articles and use case sparks</p>
                  </div>
                ) : report ? (
                  <div className="prose prose-slate prose-sm max-w-none prose-headings:font-display prose-h1:text-xl prose-h1:border-b prose-h1:border-slate-200 prose-h1:pb-3 prose-h2:text-base prose-h3:text-sm prose-p:text-slate-900 prose-p:leading-relaxed prose-li:text-slate-900 prose-strong:text-black">
                    <ReactMarkdown>{report}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <FileText className="w-8 h-8 text-slate-300" />
                    <p className="text-sm text-slate-500">No report generated yet.</p>
                  </div>
                )}
                {reportLoading && report && (
                  <div className="flex items-center gap-2 mt-4 py-2">
                    <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                    <span className="text-[11px] text-slate-400">Generating...</span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
