import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
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

      <div className="p-4">
        <div
          className={`relative flex items-end gap-2 rounded-2xl border bg-surface-0 px-4 py-3 transition-all duration-300 ${
            hasContent
              ? 'border-cyan/40 shadow-sm'
              : 'border-border'
          }`}
        >

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? 'Crew is working...' : 'Ask about crypto markets...'}
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

        <p className="text-[10px] text-muted-foreground/40 text-center mt-2 font-body">
          Multi-agent crew powered by GPT-4o · Not financial advice
        </p>
      </div>
    </div>
  )
}
