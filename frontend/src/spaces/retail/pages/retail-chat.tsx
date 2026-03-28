import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Send,
  MessageSquare,
  Trash2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useRetailStore } from '../stores/retail-store'
import { useLayoutContext } from '@/shared/components/layout'
import { TopHeader } from '@/shared/components/top-header'

const SUGGESTED_QUESTIONS = [
  'What are the biggest AI adoption trends in grocery retail right now?',
  'How are retailers using computer vision for loss prevention?',
  'What Cloudera capabilities map best to supply chain optimization?',
  'Summarize the most actionable retail insights from this week.',
]

export function RetailChat() {
  const { onMobileMenuToggle } = useLayoutContext()
  const { chatMessages, chatStreaming, sendChatMessage, clearChat } = useRetailStore()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages])

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || chatStreaming) return
    setInput('')
    sendChatMessage(msg)
  }

  return (
    <div className="h-full flex flex-col">
      <TopHeader title="Retail Intelligence Chat" subtitle="Ask about retail trends, use cases, and Cloudera opportunities" onMenuToggle={onMobileMenuToggle}>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </TopHeader>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 md:px-6 py-4">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-sky-500" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-display font-bold text-slate-900 mb-1">Retail Intelligence Chat</h2>
              <p className="text-sm text-slate-500 max-w-md">
                Ask questions about retail industry trends, AI use cases, and how Cloudera capabilities map to retail opportunities.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-lg">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); sendChatMessage(q) }}
                  className="text-left px-3 py-2.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-sky-300 hover:bg-sky-50 transition-colors leading-relaxed"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {chatMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-sky-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                >
                  {msg.thinkingSteps.length > 0 && msg.role === 'assistant' && (
                    <div className="mb-2 pb-2 border-b border-slate-100">
                      {msg.thinkingSteps.map((step, i) => (
                        <p key={i} className="text-[11px] text-slate-400 italic">{step.content}</p>
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-slate max-w-none [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-sm [&_h3]:text-sm [&_h3]:font-semibold">
                      <ReactMarkdown>{msg.content || (chatStreaming ? '...' : '')}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 md:px-6 py-3 border-t border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about retail trends, use cases..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
            disabled={chatStreaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatStreaming}
            className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center hover:bg-sky-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
