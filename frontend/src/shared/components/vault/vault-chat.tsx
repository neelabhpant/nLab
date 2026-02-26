import { useEffect, useRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Trash2, MessageSquare, Loader2 } from 'lucide-react'
import { useVaultStore } from '@/shared/stores/vault-store'
import Markdown from 'react-markdown'

export function VaultChatTab() {
  const { chatMessages, isChatStreaming, sendChatMessage, clearChat } = useVaultStore()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages, isChatStreaming])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isChatStreaming) return
    setInput('')
    sendChatMessage(trimmed)
  }, [input, isChatStreaming, sendChatMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className="flex flex-col h-full">
      {chatMessages.length > 0 && (
        <div className="flex items-center justify-end px-4 py-2 border-b border-border">
          <button
            onClick={clearChat}
            disabled={isChatStreaming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-display font-medium text-slate-500 hover:text-slate-700 hover:bg-surface-1 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="w-12 h-12 rounded-xl bg-cyan/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-cyan" />
            </div>
            <p className="text-sm font-display font-semibold text-slate-900 mb-1">Chat with your documents</p>
            <p className="text-xs text-slate-500 text-center font-body max-w-[280px]">
              Ask questions about your uploaded documents. The AI will search and cite relevant sources.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {['Summarize my financial documents', 'What contracts do I have?', 'Find all amounts over $1000'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion)
                    inputRef.current?.focus()
                  }}
                  className="text-xs font-body px-3 py-1.5 rounded-lg bg-surface-1 border border-border text-slate-600 hover:bg-surface-2 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {chatMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-cyan text-white'
                      : 'bg-surface-1 border border-border text-slate-700'
                  }`}
                >
                  {msg.role === 'assistant' && !msg.content && isChatStreaming ? (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan" />
                      <span className="text-xs text-slate-500 font-body">Searching documents...</span>
                    </div>
                  ) : (
                    <div className="text-sm font-body leading-relaxed">
                      {msg.role === 'assistant' ? (
                        <Markdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                            ul: ({ children }) => <ul className="mb-2 space-y-1">{children}</ul>,
                            li: ({ children }) => (
                              <li className="flex gap-2 text-sm">
                                <span className="text-cyan mt-0.5 flex-shrink-0">•</span>
                                <span>{children}</span>
                              </li>
                            ),
                          }}
                        >
                          {msg.content}
                        </Markdown>
                      ) : (
                        msg.content
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-4 py-3 border-t border-border">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your documents..."
            rows={1}
            className="flex-1 resize-none rounded-lg bg-surface-1 border border-border px-3 py-2.5 text-sm font-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/50 transition-all"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isChatStreaming}
            className="w-9 h-9 rounded-lg bg-cyan text-white flex items-center justify-center hover:bg-cyan/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
