import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/auth-store'

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { handleCallback } = useAuthStore()
  const [error, setError] = useState('')
  const calledRef = useRef(false)

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    const code = searchParams.get('code')
    if (!code) {
      setError('No authorization code received')
      return
    }

    handleCallback(code)
      .then(() => {
        const returnTo = sessionStorage.getItem('nlab_return_to') || '/finance'
        sessionStorage.removeItem('nlab_return_to')
        navigate(returnTo, { replace: true })
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail || err?.message || 'Authentication failed'
        setError(msg)
      })
  }, [searchParams, handleCallback, navigate])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-0">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center px-6"
        >
          <div className="w-12 h-12 rounded-xl bg-loss/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-loss" />
          </div>
          <h2 className="text-lg font-display font-bold text-slate-900 mb-2">
            Sign in failed
          </h2>
          <p className="text-sm font-body text-slate-500 mb-6 max-w-sm">
            {error}
          </p>
          <Link
            to="/login"
            className="px-5 py-2.5 rounded-lg bg-cyan text-white text-sm font-display font-medium hover:bg-cyan/90 transition-colors"
          >
            Try again
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-surface-0 gap-4">
      <div className="w-6 h-6 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-body text-slate-500">Signing you in...</p>
    </div>
  )
}
