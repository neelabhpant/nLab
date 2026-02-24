import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  prefix?: string
  decimals?: number
  className?: string
  duration?: number
}

export function AnimatedNumber({
  value,
  prefix = '',
  decimals = 2,
  className = '',
  duration = 0.6,
}: AnimatedNumberProps) {
  const nodeRef = useRef<HTMLSpanElement>(null)
  const prevValue = useRef(value)
  const [flash, setFlash] = useState<'gain' | 'loss' | null>(null)

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return

    const from = prevValue.current
    const to = value

    if (from !== to) {
      setFlash(to > from ? 'gain' : 'loss')
      const timeout = setTimeout(() => setFlash(null), 600)

      const controls = animate(from, to, {
        duration,
        ease: [0.25, 0.1, 0.25, 1],
        onUpdate(latest) {
          node.textContent = `${prefix}${latest.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}`
        },
      })

      prevValue.current = to

      return () => {
        controls.stop()
        clearTimeout(timeout)
      }
    }

    node.textContent = `${prefix}${to.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`
  }, [value, prefix, decimals, duration])

  const flashClass = flash === 'gain'
    ? 'text-gain'
    : flash === 'loss'
      ? 'text-loss'
      : ''

  return (
    <span
      ref={nodeRef}
      className={`${className} transition-colors duration-500 ${flashClass}`}
    />
  )
}
