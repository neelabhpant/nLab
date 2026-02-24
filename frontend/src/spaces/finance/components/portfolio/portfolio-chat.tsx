import { useEffect, useRef, useCallback, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, User, Sparkles, X } from 'lucide-react'
import Markdown from 'react-markdown'
import { usePortfolioStore, type FollowUpMessage } from '@/spaces/finance/stores/portfolio-store'
import { CrewThinking } from '@/shared/components/crew-thinking'

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
}

function ChatInput({ onSend, disabled }: { onSend: (msg: string) => void; disabled: boolean }) {
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
    <div className="p-3 border-t border-slate-100">
      <div
        className={`relative flex items-end gap-2 rounded-2xl border bg-white px-3.5 py-2.5 transition-all duration-300 ${
          hasContent ? 'border-cyan/40 shadow-sm' : 'border-slate-200'
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'Thinking...' : 'Ask about your portfolio...'}
          rows={1}
          className="relative flex-1 bg-transparent text-sm text-slate-900 font-body placeholder:text-slate-300 resize-none outline-none min-h-[24px] max-h-[120px] leading-relaxed disabled:opacity-50"
        />
        <motion.button
          onClick={handleSend}
          disabled={!hasContent || disabled}
          whileTap={{ scale: 0.92 }}
          className={`relative flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
            hasContent && !disabled
              ? 'bg-cyan text-white shadow-sm'
              : 'bg-slate-100 text-slate-300'
          } disabled:cursor-not-allowed`}
        >
          <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
        </motion.button>
      </div>
    </div>
  )
}

function MessageBubble({ message, isStreaming, index }: { message: FollowUpMessage; isStreaming: boolean; index: number }) {
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
        {showThinking && <CrewThinking steps={message.thinkingSteps} visible={true} />}

        {message.content && (
          <div
            className={`rounded-2xl px-4 py-3 ${
              isUser
                ? 'bg-slate-50 border border-slate-200'
                : 'bg-white border border-slate-200 shadow-sm'
            }`}
          >
            {isUser ? (
              <p className="text-[13px] text-slate-900 font-body leading-relaxed">{message.content}</p>
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
        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-slate-400" />
        </div>
      )}
    </motion.div>
  )
}

export function PortfolioChat({ onClose }: { onClose: () => void }) {
  const { followUpMessages, streaming, sendFollowUp } = usePortfolioStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [followUpMessages, streaming])

  const handleSend = useCallback(
    (content: string) => {
      sendFollowUp(content)
    },
    [sendFollowUp],
  )

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 right-6 w-[440px] h-[520px] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col z-50 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-display font-bold text-slate-900">Portfolio Advisor</h3>
              <p className="text-[10px] font-body text-slate-400">Refine your recommendation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
          {followUpMessages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <p className="text-sm font-body text-slate-400 mb-4">
                Ask questions about your portfolio recommendation
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Why did you choose VOO?',
                  'Can I add more crypto?',
                  'What if I invest $3k/mo?',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-body text-slate-500 hover:text-slate-700 hover:border-slate-200 transition-all duration-200 cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {followUpMessages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={streaming && i === followUpMessages.length - 1}
              index={i}
            />
          ))}
        </div>

        <ChatInput onSend={handleSend} disabled={streaming} />
      </motion.div>
    </AnimatePresence>
  )
}
