import { useEffect, useRef, useCallback, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Trash2, ArrowUp, User, BriefcaseBusiness, FileText, Target, Sparkles } from 'lucide-react'
import Markdown from 'react-markdown'
import { useAdvisorStore, type AdvisorMessage } from '@/spaces/finance/stores/advisor-store'
import { AdvisorSidebar } from '@/spaces/finance/components/advisor-sidebar'
import { AdvisorInsights } from '@/spaces/finance/components/advisor-insights'
import { CrewThinking } from '@/shared/components/crew-thinking'
import { TopHeader } from '@/shared/components/top-header'

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-base font-display font-bold text-slate-900 mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-[15px] font-display font-bold text-slate-900 mt-3 mb-1.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-sm font-display font-semibold text-slate-800 mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-slate-800">{children}</strong>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-2 last:mb-0 space-y-1 ml-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-2 last:mb-0 space-y-1 ml-0.5 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-relaxed flex gap-2">
      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-cyan flex-shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  code: ({ children, className }: { children?: ReactNode; className?: string }) => {
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

function AdvisorInput({ onSend, disabled }: { onSend: (msg: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [value, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const hasContent = value.trim().length > 0

  return (
    <div className="relative">
      <div className="absolute -top-px left-0 right-0 h-px bg-border" />
      <div className="p-3">
        <div
          className={`relative flex items-end gap-2 rounded-2xl border bg-surface-0 px-3.5 py-2.5 transition-all duration-300 ${
            hasContent ? 'border-cyan/40 shadow-sm' : 'border-border'
          }`}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? 'Advisor is thinking...' : 'Ask about your finances...'}
            rows={1}
            className="relative flex-1 bg-transparent text-sm text-slate-900 font-body placeholder:text-muted-foreground/50 resize-none outline-none min-h-[24px] max-h-[120px] leading-relaxed disabled:opacity-50"
          />
          <motion.button
            onClick={handleSend}
            disabled={!hasContent || disabled}
            whileTap={{ scale: 0.92 }}
            className={`relative flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
              hasContent && !disabled
                ? 'bg-cyan text-white shadow-sm'
                : 'bg-surface-2 text-muted-foreground'
            } disabled:cursor-not-allowed`}
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          </motion.button>
        </div>
        <p className="text-[11px] text-muted-foreground/40 text-center mt-1.5 font-body">
          AI financial advisor · Not professional financial advice
        </p>
      </div>
    </div>
  )
}

function AdvisorMessageBubble({ message, isStreaming, index }: { message: AdvisorMessage; isStreaming: boolean; index: number }) {
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
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      <div className={isUser ? 'max-w-[85%]' : 'max-w-[90%]'}>
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
              <p className="text-[13px] text-slate-900 font-body leading-relaxed">
                {message.content}
              </p>
            ) : (
              <div className="text-[13px] text-slate-700 font-body leading-relaxed prose-nlab">
                <Markdown components={markdownComponents}>{message.content}</Markdown>
              </div>
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

function AdvisorEmpty({ onSuggestionClick }: { onSuggestionClick: (s: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan/10 border border-cyan/20 mb-5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan" />
          </span>
          <span className="text-xs font-display font-medium text-cyan">Advisor ready</span>
        </div>
        <h2 className="text-xl font-display font-bold text-foreground tracking-tight mb-1.5">
          Financial Advisor
        </h2>
        <p className="text-sm text-muted-foreground font-body max-w-[320px]">
          Upload documents, share your details, and get personalised financial guidance
        </p>
      </motion.div>

      <div className="grid grid-cols-3 gap-2.5 mb-8 max-w-[480px] w-full">
        {[
          { icon: FileText, name: 'Documents', desc: 'Upload statements and tax returns', color: '#00D4FF' },
          { icon: BriefcaseBusiness, name: 'Analysis', desc: 'AI extracts your financial data', color: '#00E599' },
          { icon: Target, name: 'Planning', desc: 'Personalised goal-based advice', color: '#F5A623' },
        ].map((item, i) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
            className="rounded-xl border border-border bg-surface-0 p-3 shadow-sm"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
              style={{ backgroundColor: `${item.color}15` }}
            >
              <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
            </div>
            <h3 className="text-sm font-display font-semibold text-foreground mb-0.5">{item.name}</h3>
            <p className="text-xs text-muted-foreground font-body leading-snug">{item.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-wrap justify-center gap-2 max-w-[480px]"
      >
        {[
          'Review my financial health',
          'Help me create a savings plan',
          'How can I reduce my debt?',
        ].map((s) => (
          <button
            key={s}
            onClick={() => onSuggestionClick(s)}
            className="px-3 py-1.5 rounded-xl bg-surface-0 border border-border text-xs font-body text-muted-foreground hover:text-foreground hover:border-foreground/20 hover:shadow-sm transition-all duration-200 cursor-pointer"
          >
            {s}
          </button>
        ))}
      </motion.div>
    </div>
  )
}

export function AdvisorFinancial() {
  const { messages, streaming, profile, sendMessage, clearChat, fetchProfile, fetchDocuments } = useAdvisorStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProfile()
    fetchDocuments()
  }, [fetchProfile, fetchDocuments])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streaming])

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content)
    },
    [sendMessage],
  )

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Financial Advisor" subtitle="AI-powered financial guidance">
        {messages.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={clearChat}
            disabled={streaming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </motion.button>
        )}
      </TopHeader>

      <div className="flex-1 flex min-h-0">
        <div className="w-72 flex-shrink-0 border-r border-border overflow-y-auto">
          <AdvisorSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
            {messages.length === 0 ? (
              <AdvisorEmpty onSuggestionClick={handleSend} />
            ) : (
              <div className="max-w-3xl mx-auto px-6 py-4 space-y-5">
                {messages.map((msg, i) => (
                  <AdvisorMessageBubble
                    key={msg.id}
                    message={msg}
                    isStreaming={streaming && i === messages.length - 1}
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 max-w-3xl mx-auto w-full">
            <AdvisorInput onSend={handleSend} disabled={streaming} />
          </div>
        </div>

        <div className="w-64 flex-shrink-0 border-l border-border overflow-y-auto">
          <AdvisorInsights profile={profile} onSuggestionClick={handleSend} />
        </div>
      </div>
    </div>
  )
}
