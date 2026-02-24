import { type ReactNode, useMemo } from 'react'
import { motion } from 'framer-motion'
import { User, ExternalLink } from 'lucide-react'
import Markdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import type { ChatMessage as ChatMessageType } from '@/spaces/finance/stores/chat-store'
import { CrewThinking } from '@/shared/components/crew-thinking'

const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A',
  XRP: '#00D4FF',
  ETH: '#627EEA',
  SOL: '#00E599',
  DOGE: '#C3A634',
  Bitcoin: '#F7931A',
  Ripple: '#00D4FF',
  Ethereum: '#627EEA',
  Solana: '#00E599',
  Dogecoin: '#C3A634',
}

const COIN_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  XRP: 'ripple',
  ETH: 'ethereum',
  SOL: 'solana',
  DOGE: 'dogecoin',
}

function formatFinancialText(text: string): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = []
  const regex = /(\$[\d,]+(?:\.\d+)?(?:[TBMK])?)|([+-]?\d+(?:\.\d+)?%)|(\b(?:BTC|XRP|ETH|SOL|DOGE|Bitcoin|Ripple|Ethereum|Solana|Dogecoin)\b)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyIdx = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const [full] = match
    if (match[1]) {
      parts.push(
        <span key={`fin-${keyIdx++}`} className="font-display font-semibold text-slate-800">
          {full}
        </span>
      )
    } else if (match[2]) {
      const isPositive = full.startsWith('+') || (!full.startsWith('-') && parseFloat(full) > 0)
      const isNegative = full.startsWith('-')
      parts.push(
        <span
          key={`pct-${keyIdx++}`}
          className={`font-display font-semibold ${isNegative ? 'text-loss' : isPositive ? 'text-gain' : 'text-foreground'}`}
        >
          {full}
        </span>
      )
    } else if (match[3]) {
      const color = COIN_COLORS[full]
      parts.push(
        <span key={`coin-${keyIdx++}`} className="font-display font-semibold" style={{ color }}>
          {full}
        </span>
      )
    }
    lastIndex = match.index + full.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

interface NewsArticle {
  title: string
  source: string
  url?: string
  summary: string
  coins: string[]
}

function parseNewsCards(content: string): { prose: string; articles: NewsArticle[] } | null {
  const regex = /```news-cards\s*\n([\s\S]*?)\n?```/
  const match = content.match(regex)
  if (!match) return null
  try {
    const articles = JSON.parse(match[1]) as NewsArticle[]
    if (!Array.isArray(articles) || articles.length === 0) return null
    const prose = content.slice(0, match.index).trim()
    return { prose, articles }
  } catch {
    return null
  }
}

function NewsCards({ articles }: { articles: NewsArticle[] }) {
  return (
    <div className="mt-3 space-y-2.5">
      {articles.map((article, i) => {
        const primaryCoin = article.coins?.[0] ?? 'BTC'
        const borderColor = COIN_COLORS[primaryCoin] ?? '#00D4FF'
        return (
          <motion.a
            key={i}
            href={article.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.06 }}
            className="block rounded-xl border border-border bg-surface-1/50 p-3.5 hover:shadow-md hover:border-cyan/30 transition-all cursor-pointer group"
            style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-display font-semibold text-slate-900 leading-snug mb-1 group-hover:text-cyan transition-colors">
                  {article.title}
                </p>
                <p className="text-xs text-slate-500 font-body leading-relaxed">
                  {formatFinancialText(article.summary)}
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-cyan flex-shrink-0 mt-0.5 transition-colors" />
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[10px] font-body text-slate-400">{article.source}</span>
              <span className="text-slate-200">·</span>
              {article.coins?.map((coin) => (
                <span
                  key={coin}
                  className="text-[10px] font-display font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    color: COIN_COLORS[coin] ?? '#00D4FF',
                    backgroundColor: `${COIN_COLORS[coin] ?? '#00D4FF'}14`,
                  }}
                >
                  {coin}
                </span>
              ))}
            </div>
          </motion.a>
        )
      })}
    </div>
  )
}

function CompareLink({ content }: { content: string }) {
  const navigate = useNavigate()

  const linkData = useMemo(() => {
    const coinPattern = /\b(BTC|XRP|ETH|SOL|DOGE|bitcoin|ripple|ethereum|solana|dogecoin)\b/gi
    const matches = content.match(coinPattern)
    if (!matches || matches.length < 2) return null

    const coins = [...new Set(
      matches.map((m) => COIN_ID_MAP[m.toUpperCase()] ?? m.toLowerCase())
    )].slice(0, 5)

    const daysMatch = content.match(/(\d+)\s*(?:days?|d)\b/i)
    const days = daysMatch ? parseInt(daysMatch[1]) : 30

    const method = /z.?score/i.test(content) ? 'zscore' : 'minmax'

    return { coins, days, method }
  }, [content])

  if (!linkData) return null

  return (
    <button
      onClick={() => navigate(`/finance/analytics?coins=${linkData.coins.join(',')}&days=${linkData.days}&method=${linkData.method}`)}
      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-cyan/10 border border-cyan/20 text-xs font-display font-medium text-cyan hover:bg-cyan/20 transition-colors cursor-pointer"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
      View comparison chart
    </button>
  )
}

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-lg font-display font-bold text-slate-900 mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-base font-display font-bold text-slate-900 mt-4 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-sm font-display font-semibold text-slate-800 mt-3 mb-1.5 first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="text-sm font-display font-semibold text-slate-700 mt-2 mb-1 first:mt-0">{children}</h4>
  ),
  p: ({ children }: { children?: ReactNode }) => {
    if (typeof children === 'string') {
      return <p className="mb-2 last:mb-0 leading-relaxed">{formatFinancialText(children)}</p>
    }
    return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  },
  strong: ({ children }: { children?: ReactNode }) => {
    if (typeof children === 'string') {
      return <strong className="font-semibold text-slate-900">{formatFinancialText(children)}</strong>
    }
    return <strong className="font-semibold text-slate-900">{children}</strong>
  },
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-2 last:mb-0 space-y-1 ml-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-2 last:mb-0 space-y-1 ml-0.5 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="text-sm leading-relaxed flex gap-2">
      <span className="text-cyan mt-[7px] w-1.5 h-1.5 rounded-full bg-cyan flex-shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  code: ({ children, className }: { children?: ReactNode; className?: string }) => {
    if (className?.includes('language-news-cards')) return null
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className="block bg-surface-2 rounded-lg p-3 my-2 text-xs font-mono text-slate-600 overflow-x-auto">
          {children}
        </code>
      )
    }
    return (
      <code className="bg-surface-2 px-1.5 py-0.5 rounded text-xs font-mono text-cyan">{children}</code>
    )
  },
  pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
  hr: () => <hr className="border-surface-3/40 my-3" />,
}

function AssistantContent({ content }: { content: string }) {
  const newsData = useMemo(() => parseNewsCards(content), [content])

  if (newsData) {
    return (
      <div className="text-sm text-slate-700 font-body leading-relaxed prose-nlab">
        {newsData.prose && (
          <Markdown components={markdownComponents}>{newsData.prose}</Markdown>
        )}
        <NewsCards articles={newsData.articles} />
        <CompareLink content={content} />
      </div>
    )
  }

  return (
    <div className="text-sm text-slate-700 font-body leading-relaxed prose-nlab">
      <Markdown components={markdownComponents}>{content}</Markdown>
      <CompareLink content={content} />
    </div>
  )
}

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming: boolean
  index: number
}

export function ChatMessageBubble({ message, isStreaming, index }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const showThinking = isStreaming && !message.content && message.thinkingSteps.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.2) }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-cyan flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[10px] font-display font-bold text-white">FP</span>
        </div>
      )}

      <div className={`max-w-[680px] ${isUser ? 'max-w-[500px]' : ''}`}>
        {showThinking && (
          <CrewThinking steps={message.thinkingSteps} visible={true} />
        )}

        {message.content && (
          <div
            className={`rounded-2xl px-4 py-3 ${
              isUser
                ? 'bg-surface-1 border border-border'
                : 'bg-surface-0 border border-border shadow-sm'
            }`}
          >
            {isUser ? (
              <p className="text-sm text-slate-900 font-body leading-relaxed">
                {message.content}
              </p>
            ) : (
              <AssistantContent content={message.content} />
            )}
          </div>
        )}

        {!isUser && !message.content && !showThinking && isStreaming && (
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyan"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  )
}
