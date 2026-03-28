import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Trash2, User, Bot, Loader2, Square } from 'lucide-react'
import { useOpenClawStore, type ChatMessage } from '@/spaces/labs/stores/openclaw-store'

const ACCENT = '#FF6B35'

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-[#FF6B35]/10' : 'bg-surface-2'
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-[#FF6B35]" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-slate-500" />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-orange-50 border border-orange-200/60'
            : 'bg-surface-0 border border-border shadow-sm'
        }`}
      >
        <p className="text-sm font-body leading-relaxed whitespace-pre-wrap text-slate-900">
          {message.content}
        </p>
      </div>
    </motion.div>
  )
}

export function ChatPanel() {
  const { messages, gatewayStatus, error, sendMessage, stopExecution, clearChat } = useOpenClawStore()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isProcessing = gatewayStatus === 'processing'

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, isProcessing])

  const handleSend = () => {
    if (!input.trim() || isProcessing) return
    sendMessage(input.trim())
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bot className="w-5 h-5 text-[#FF6B35]" />
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${
                isProcessing ? 'bg-[#FF6B35] animate-pulse' : 'bg-emerald-500'
              }`}
            />
          </div>
          <h3 className="text-sm font-display font-bold text-slate-900">Agent</h3>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-[11px] font-display font-medium text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}12, ${ACCENT}05)`,
                  borderColor: `${ACCENT}20`,
                }}
              >
                <Bot className="w-8 h-8" style={{ color: `${ACCENT}80` }} />
              </div>
              <div>
                <p className="text-sm font-display font-bold text-slate-900">OpenClaw Lite</p>
                <p className="text-xs font-body text-slate-500 mt-1 max-w-xs">
                  Your personal AI agent with configurable skills.
                  Toggle skills in the left panel and start chatting.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {['What can you do?', 'Search for AI news', 'Calculate 42 * 1337'].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q)
                      inputRef.current?.focus()
                    }}
                    className="text-[11px] font-body text-slate-500 px-3 py-1.5 rounded-full border border-border hover:border-[#FF6B35]/30 hover:text-[#FF6B35] hover:bg-[#FF6B35]/5 transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-3.5 h-3.5 text-[#FF6B35] animate-spin" />
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-1 border border-border">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]/50"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                  />
                ))}
              </span>
            </div>
            <button
              onClick={stopExecution}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-display font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop
            </button>
          </motion.div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 border-t border-red-200 bg-red-50">
          <p className="text-[11px] font-body text-red-600">{error}</p>
        </div>
      )}

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message the agent..."
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-lg bg-surface-1 border border-border text-sm font-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]/50 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: input.trim() && !isProcessing
                ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT}DD)`
                : 'var(--surface-1, #F0F1F4)',
              border: input.trim() && !isProcessing ? 'none' : '1px solid var(--border)',
            }}
          >
            <Send
              className={`w-4 h-4 ${
                input.trim() && !isProcessing ? 'text-white' : 'text-slate-400'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
