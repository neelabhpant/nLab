import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/shared/stores/auth-store'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export function Login() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, loginWithGoogle } = useAuthStore()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/finance', { replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-0">
        <div className="w-6 h-6 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-screen bg-surface-0 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan/5 via-transparent to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-cyan flex items-center justify-center mb-6 shadow-lg shadow-cyan/20">
          <span className="text-lg font-display font-bold text-white">nL</span>
        </div>

        <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight mb-2">
          Welcome to nLab
        </h1>
        <p className="text-sm font-body text-slate-500 mb-10">
          Your personal AI-powered workspace
        </p>

        <motion.button
          onClick={loginWithGoogle}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer"
        >
          <GoogleIcon className="w-5 h-5" />
          <span className="text-sm font-display font-semibold text-slate-700">
            Sign in with Google
          </span>
        </motion.button>

        <p className="mt-8 text-xs font-body text-slate-400">
          Access restricted to authorized accounts
        </p>
      </motion.div>
    </div>
  )
}
