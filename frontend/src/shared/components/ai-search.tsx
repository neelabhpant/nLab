import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Sparkles, X } from 'lucide-react'
import Markdown from 'react-markdown'

const API_BASE = 'http://localhost:8000/api/v1'

const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A', XRP: '#00D4FF', ETH: '#627EEA', SOL: '#00E599', DOGE: '#C3A634',
  Bitcoin: '#F7931A', Ripple: '#00D4FF', Ethereum: '#627EEA', Solana: '#00E599', Dogecoin: '#C3A634',
}

function formatFinancialText(text: string): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = []
  const regex = /(\$[\d,]+(?:\.\d+)?(?:[TBMK])?)|([+-]?\d+(?:\.\d+)?%)|(\b(?:BTC|XRP|ETH|SOL|DOGE|Bitcoin|Ripple|Ethereum|Solana|Dogecoin)\b)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyIdx = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const [full] = match
    if (match[1]) {
      parts.push(<span key={`f-${keyIdx++}`} className="font-display font-semibold text-slate-900">{full}</span>)
    } else if (match[2]) {
      const isNeg = full.startsWith('-')
      const isPos = full.startsWith('+') || (!isNeg && parseFloat(full) > 0)
      parts.push(<span key={`p-${keyIdx++}`} className={`font-display font-semibold ${isNeg ? 'text-loss' : isPos ? 'text-gain' : 'text-slate-900'}`}>{full}</span>)
    } else if (match[3]) {
      parts.push(<span key={`c-${keyIdx++}`} className="font-display font-semibold" style={{ color: COIN_COLORS[full] }}>{full}</span>)
    }
    lastIndex = match.index + full.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

export function AISearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [thinking, setThinking] = useState<string[]>([])
  const [response, setResponse] = useState('')
  const [streaming, setStreaming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed || streaming) return

    setOpen(true)
    setThinking([])
    setResponse('')
    setStreaming(true)

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: trimmed }] }),
      })

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') continue
          try {
            const event = JSON.parse(payload) as { type: string; content: string }
            if (event.type === 'thinking') {
              setThinking((prev) => [...prev, event.content])
            } else if (event.type === 'text') {
              setResponse(event.content)
            } else if (event.type === 'error') {
              setResponse(event.content)
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setStreaming(false)
    }
  }, [query, streaming])

  const hasResults = thinking.length > 0 || response || streaming

  return (
    <div ref={containerRef} className="relative">
      <div className={`relative flex items-center transition-all duration-200 ${open ? 'w-72' : 'w-48'}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (hasResults) setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
          }}
          placeholder="Ask AI... ⌘K"
          className="w-full pl-9 pr-8 py-2 rounded-lg bg-surface-1 border border-border text-sm font-body text-slate-900 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/50 transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); setResponse(''); setThinking([]) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && hasResults && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-[420px] max-h-[400px] rounded-xl border border-border bg-surface-0 shadow-xl overflow-hidden z-[60]"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-1/50">
              <Sparkles className="w-3.5 h-3.5 text-cyan" />
              <span className="text-xs font-display font-semibold text-slate-700">AI Response</span>
              {streaming && (
                <div className="flex gap-1 ml-auto">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1 h-1 rounded-full bg-cyan"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-y-auto max-h-[340px] p-4">
              {thinking.length > 0 && !response && (
                <div className="space-y-1.5 mb-3">
                  {thinking.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {i === thinking.length - 1 && streaming ? (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-60" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan" />
                        </span>
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-surface-3" />
                      )}
                      <span className="text-xs text-slate-500 font-body">{step}</span>
                    </div>
                  ))}
                </div>
              )}

              {response && (
                <div className="text-sm text-slate-700 font-body leading-relaxed">
                  <Markdown
                    components={{
                      p: ({ children }) => {
                        if (typeof children === 'string') {
                          return <p className="mb-2 last:mb-0">{formatFinancialText(children)}</p>
                        }
                        return <p className="mb-2 last:mb-0">{children}</p>
                      },
                      strong: ({ children }) => {
                        if (typeof children === 'string') {
                          return <strong className="font-semibold text-slate-900">{formatFinancialText(children)}</strong>
                        }
                        return <strong className="font-semibold text-slate-900">{children}</strong>
                      },
                      ul: ({ children }) => <ul className="mb-2 space-y-1 ml-0.5">{children}</ul>,
                      li: ({ children }) => (
                        <li className="text-sm leading-relaxed flex gap-2">
                          <span className="text-cyan mt-1.5 flex-shrink-0">•</span>
                          <span>{children}</span>
                        </li>
                      ),
                    }}
                  >
                    {response}
                  </Markdown>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
