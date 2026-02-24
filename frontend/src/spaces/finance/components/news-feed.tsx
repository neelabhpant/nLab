import { useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Newspaper, ExternalLink, Sparkles } from 'lucide-react'
import { useNewsStore } from '@/spaces/finance/stores/news-store'
import { useChatStore } from '@/spaces/finance/stores/chat-store'

const NEWS_REFRESH_INTERVAL = 300_000

const HIGHLIGHT_COINS = new Set(['BTC', 'XRP'])

const COIN_BORDER_COLORS: Record<string, string> = {
  BTC: '#F7931A',
  XRP: '#0EA5E9',
  ETH: '#627EEA',
  SOL: '#14B8A6',
  DOGE: '#C3A634',
}

const COIN_TAG_SYMBOLS = new Set(['BTC', 'XRP', 'ETH', 'SOL', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK'])

function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function NewsFeed() {
  const { articles, loading, fetchNews } = useNewsStore()
  const openWidgetWithMessage = useChatStore((s) => s.openWidgetWithMessage)

  const handleAskAI = useCallback((title: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openWidgetWithMessage(`Analyze this news and its impact on crypto markets: ${title}`)
  }, [openWidgetWithMessage])

  useEffect(() => {
    fetchNews(undefined, 20)
    const interval = setInterval(() => fetchNews(undefined, 20), NEWS_REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchNews])

  const displayArticles = useMemo(() => articles.slice(0, 20), [articles])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-xl border border-border bg-surface-0 shadow-sm flex flex-col h-full"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-display font-semibold text-slate-900">Market News</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gain opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gain" />
          </span>
          <span className="text-[10px] text-slate-500 font-body">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && displayArticles.length === 0 ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-surface-2 rounded w-full mb-2" />
                <div className="h-3 bg-surface-2 rounded w-3/4 mb-2" />
                <div className="h-2 bg-surface-2 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {displayArticles.map((article, i) => {
              const highlightCoin = article.related_coins.find((c) => HIGHLIGHT_COINS.has(c))
              const borderColor = highlightCoin ? COIN_BORDER_COLORS[highlightCoin] : undefined
              const tags = article.related_coins.filter((c) => COIN_TAG_SYMBOLS.has(c))

              return (
                <motion.a
                  key={`${article.url}-${i}`}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                  className="group flex gap-3 px-5 py-3.5 hover:bg-surface-1/60 transition-colors"
                  style={borderColor ? { borderLeft: `2px solid ${borderColor}` } : undefined}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-body font-medium text-slate-800 leading-snug line-clamp-2 group-hover:text-cyan transition-colors">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-slate-500 font-body truncate max-w-[120px]">{article.source}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] text-slate-400 font-body whitespace-nowrap">{formatRelativeTime(article.published_at)}</span>
                      {tags.length > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <div className="flex items-center gap-1">
                            {tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-display font-semibold px-1.5 py-0.5 rounded"
                                style={{
                                  color: COIN_BORDER_COLORS[tag] ?? '#6B7280',
                                  backgroundColor: `${COIN_BORDER_COLORS[tag] ?? '#6B7280'}15`,
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleAskAI(article.title, e)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-cyan hover:bg-cyan/10 transition-colors cursor-pointer"
                      title="Ask AI about this"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-slate-400" />
                  </div>
                </motion.a>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
