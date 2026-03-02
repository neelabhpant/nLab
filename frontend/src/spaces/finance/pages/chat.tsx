import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useChatStore } from '@/spaces/finance/stores/chat-store'
import { ChatMessageBubble } from '@/spaces/finance/components/chat-message'
import { ChatInput } from '@/spaces/finance/components/chat-input'
import { ChatEmpty } from '@/spaces/finance/components/chat-empty'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'

export function Chat() {
  const { onMobileMenuToggle } = useLayoutContext()
  const { messages, streaming, sendMessage, clearChat } = useChatStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialQueryHandled = useRef(false)

  useEffect(() => {
    if (initialQueryHandled.current) return
    const q = searchParams.get('q')
    if (q && !streaming && messages.length === 0) {
      initialQueryHandled.current = true
      setSearchParams({}, { replace: true })
      sendMessage(q)
    }
  }, [searchParams, setSearchParams, sendMessage, streaming, messages.length])

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
      <TopHeader title="AI Assistant" subtitle="Multi-agent financial intelligence" onMenuToggle={onMobileMenuToggle}>
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <ChatEmpty onSuggestionClick={handleSend} />
        ) : (
          <div className="px-4 md:px-8 lg:px-12 py-4 space-y-6">
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

      <div className="flex-shrink-0 px-4 lg:px-8">
        <ChatInput onSend={handleSend} disabled={streaming} />
      </div>
    </div>
  )
}
