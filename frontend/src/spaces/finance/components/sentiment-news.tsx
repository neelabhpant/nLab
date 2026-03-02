import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Newspaper, ExternalLink, Sparkles, Flame } from 'lucide-react'
import { useNewsStore } from '@/spaces/finance/stores/news-store'
import { useChatStore } from '@/spaces/finance/stores/chat-store'

const COIN_COLORS: Record<string, string> = {
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

function Thumbnail({ src, color }: { src: string; color?: string }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${color ?? '#334155'}30, ${color ?? '#334155'}10)` }}
      >
        <Newspaper className="w-4 h-4" style={{ color: color ?? '#64748B' }} />
      </div>
    )
  }

  return (
    <motion.img
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-border/50"
    />
  )
}

function SourceIcon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) return null

  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="w-3.5 h-3.5 rounded-sm object-contain"
    />
  )
}

export function SentimentNews() {
  const { articles, loading, fetchNews } = useNewsStore()
  const openWidgetWithMessage = useChatStore((s) => s.openWidgetWithMessage)

  useEffect(() => {
    if (!articles.length) {
      fetchNews(undefined, 20)
    }
  }, [articles.length, fetchNews])

  const displayArticles = useMemo(() => articles.slice(0, 12), [articles])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-xl border border-border bg-surface-0 shadow-sm flex flex-col"
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border flex-shrink-0">
        <Newspaper className="w-4 h-4 text-cyan" />
        <h3 className="text-sm font-display font-semibold text-slate-900">Latest News</h3>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gain opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gain" />
          </span>
          <span className="text-[10px] text-slate-400 font-body">Live</span>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[400px]">
        {loading && displayArticles.length === 0 ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-14 h-14 bg-surface-2 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-surface-2 rounded w-full mb-1.5" />
                  <div className="h-3 bg-surface-2 rounded w-3/4 mb-1.5" />
                  <div className="h-2 bg-surface-2 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {displayArticles.map((article, i) => {
              const tags = article.related_coins.filter((c) => COIN_TAG_SYMBOLS.has(c))
              const mainCoin = tags[0]
              const borderColor = mainCoin ? COIN_COLORS[mainCoin] : undefined
              const isHot = article.upvotes > 5

              return (
                <motion.a
                  key={`${article.url}-${i}`}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                  className="group flex gap-3 px-5 py-3 hover:bg-surface-1/60 transition-colors"
                  style={borderColor ? { borderLeft: `3px solid ${borderColor}` } : undefined}
                >
                  <Thumbnail src={article.image_url} color={borderColor} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5">
                      <p className="text-[13px] font-body font-medium text-slate-800 leading-snug line-clamp-2 group-hover:text-cyan transition-colors flex-1">
                        {article.title}
                      </p>
                      <div className="flex flex-col items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            openWidgetWithMessage(`Analyze this news and its market impact: ${article.title}`)
                          }}
                          className="w-5 h-5 rounded-md flex items-center justify-center text-cyan hover:bg-cyan/10 transition-colors cursor-pointer"
                          title="Ask AI"
                        >
                          <Sparkles className="w-3 h-3" />
                        </button>
                        <ExternalLink className="w-2.5 h-2.5 text-slate-300" />
                      </div>
                    </div>

                    {article.body && (
                      <p className="text-[11px] text-slate-500 font-body line-clamp-1 mt-0.5 leading-relaxed">
                        {article.body}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <SourceIcon src={article.source_img} />
                      <span className="text-[11px] text-slate-500 font-body truncate max-w-[100px]">{article.source}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] text-slate-400 font-body whitespace-nowrap">{formatRelativeTime(article.published_at)}</span>
                      {isHot && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-display font-semibold text-amber-500">
                            <Flame className="w-2.5 h-2.5" />
                            {article.upvotes}
                          </span>
                        </>
                      )}
                      {tags.length > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <div className="flex items-center gap-1">
                            {tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-display font-semibold px-1.5 py-0.5 rounded"
                                style={{
                                  color: COIN_COLORS[tag] ?? '#6B7280',
                                  backgroundColor: `${COIN_COLORS[tag] ?? '#6B7280'}15`,
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
                </motion.a>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
