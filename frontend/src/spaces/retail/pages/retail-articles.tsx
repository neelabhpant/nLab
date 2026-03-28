import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Copy,
  Check,
  Filter,
  RefreshCw,
} from 'lucide-react'
import { useRetailStore } from '../stores/retail-store'
import type { RetailArticle } from '../stores/retail-store'
import { useLayoutContext } from '@/shared/components/layout'
import { TopHeader } from '@/shared/components/top-header'

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
    <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
      <span className="text-xs font-bold text-white">{initial}</span>
    </div>
  )
}

export function RetailArticles() {
  const { onMobileMenuToggle } = useLayoutContext()
  const {
    articles,
    articlesLoading,
    sources,
    fetchArticles,
    fetchSources,
    toggleBookmark,
    fetchNewArticles,
    fetchingArticles,
  } = useRetailStore()

  const [filterSource, setFilterSource] = useState<string>('')
  const [filterTag, setFilterTag] = useState<string>('')
  const [onlyBookmarked, setOnlyBookmarked] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetchSources()
    fetchArticles({ limit: 100 })
  }, [fetchSources, fetchArticles])

  useEffect(() => {
    fetchArticles({
      source_id: filterSource || undefined,
      tag: filterTag || undefined,
      bookmarked: onlyBookmarked || undefined,
      limit: 100,
    })
  }, [filterSource, filterTag, onlyBookmarked, fetchArticles])

  const handleCopy = (article: RetailArticle) => {
    const dateStr = (article.published_at || article.fetched_at || '').slice(0, 10)
    const lines = [
      article.title,
      `Source: ${article.source_id.replace(/_/g, ' ')} | ${dateStr}`,
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

  const allTags = [...new Set(articles.flatMap((a) => a.tags))].sort()

  return (
    <div className="h-full flex flex-col">
      <TopHeader title="Article Feed" subtitle="All retail intelligence articles" onMenuToggle={onMobileMenuToggle}>
        <button
          onClick={() => fetchNewArticles()}
          disabled={fetchingArticles}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 text-sky-700 text-sm font-medium hover:bg-sky-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${fetchingArticles ? 'animate-spin' : ''}`} />
          {fetchingArticles ? 'Fetching...' : 'Fetch New'}
        </button>
      </TopHeader>
      <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:ring-1 focus:ring-sky-300 focus:border-sky-300"
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:ring-1 focus:ring-sky-300 focus:border-sky-300"
          >
            <option value="">All Tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={() => setOnlyBookmarked(!onlyBookmarked)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              onlyBookmarked ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Bookmark className="w-3 h-3" />
            Bookmarked
          </button>
        </div>

        {articlesLoading && articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading articles...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="w-10 h-10 text-slate-300" />
            <p className="text-sm text-slate-500">No articles found. Try fetching new sources.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {articles.map((article, i) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={`group px-4 py-3.5 hover:bg-slate-50/50 transition-colors ${article.is_read ? 'opacity-60' : ''}`}
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
                      {article.relevance_score !== null && (
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          article.relevance_score >= 0.7 ? 'bg-emerald-500' : article.relevance_score >= 0.4 ? 'bg-amber-500' : 'bg-slate-400'
                        }`} />
                      )}
                      <span className="text-[11px] font-medium text-slate-400 uppercase">{article.source_id.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] text-slate-400">{timeAgo(article.published_at || article.fetched_at)}</span>
                    </div>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-slate-900 hover:text-sky-600 transition-colors leading-snug">
                      {article.title}
                      <ExternalLink className="inline w-3 h-3 ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </a>
                    {article.summary && (
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{article.summary}</p>
                    )}
                    {article.key_takeaways.length > 0 && (
                      <ul className="mt-1.5 flex flex-col gap-0.5">
                        {article.key_takeaways.slice(0, 3).map((t, j) => (
                          <li key={j} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                            <span className="text-sky-400 mt-0.5">•</span> {t}
                          </li>
                        ))}
                      </ul>
                    )}
                    {article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {article.tags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setFilterTag(tag)}
                            className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleCopy(article)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      {copied === article.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => toggleBookmark(article.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                    >
                      {article.is_bookmarked ? <BookmarkCheck className="w-3.5 h-3.5 text-amber-500" /> : <Bookmark className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
