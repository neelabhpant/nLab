import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Maximize2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/spaces/finance/stores/chat-store'
import { ChatMessageBubble } from '@/spaces/finance/components/chat-message'
import { ChatInput } from '@/spaces/finance/components/chat-input'

export function ChatWidget() {
  const { messages, streaming, sendMessage, widgetOpen: open, setWidgetOpen: setOpen } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (scrollRef.current && open) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streaming, open])

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content)
    },
    [sendMessage],
  )

  const handleOpenFull = useCallback(() => {
    setOpen(false)
    navigate('/finance/chat')
  }, [navigate])

  return (
    <div className="hidden md:contents">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed bottom-20 right-6 w-[400px] h-[520px] rounded-2xl border border-border bg-surface-0 shadow-xl flex flex-col overflow-hidden z-50"
          >

            <div className="relative flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan flex items-center justify-center">
                  <span className="text-[8px] font-display font-bold text-white">nL</span>
                </div>
                <span className="text-sm font-display font-semibold text-slate-900">AI Crew</span>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan" />
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleOpenFull}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors cursor-pointer"
                  title="Open full chat"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6">
                  <div className="w-10 h-10 rounded-xl bg-cyan flex items-center justify-center mb-3">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-display font-semibold text-foreground mb-1">Ask anything</p>
                  <p className="text-xs text-muted-foreground text-center font-body">
                    Multi-agent crew for crypto analysis
                  </p>
                </div>
              ) : (
                <div className="px-4 py-3 space-y-4">
                  {messages.map((msg, i) => (
                    <ChatMessageBubble
                      key={msg.id}
                      message={msg}
                      isStreaming={streaming && i === messages.length - 1}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="relative flex-shrink-0 border-t border-border">
              <ChatInput onSend={handleSend} disabled={streaming} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-2xl bg-cyan text-white shadow-lg flex items-center justify-center z-50 cursor-pointer"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageSquare className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
