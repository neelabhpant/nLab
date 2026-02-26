import { create } from 'zustand'
import { api } from '@/shared/lib/api'

const TOKEN_KEY = 'nlab_auth_token'

export interface AuthUser {
  email: string
  name: string
  picture: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  loginWithGoogle: () => void
  handleCallback: (code: string) => Promise<void>
  checkAuth: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  loginWithGoogle: () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID is not set')
      return
    }

    const redirectUri = `${window.location.origin}/auth/callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    })

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  },

  handleCallback: async (code: string) => {
    const redirectUri = `${window.location.origin}/auth/callback`

    const { data } = await api.post<{ token: string; user: AuthUser }>(
      '/auth/google',
      { code, redirect_uri: redirectUri },
    )

    localStorage.setItem(TOKEN_KEY, data.token)
    set({
      token: data.token,
      user: data.user,
      isAuthenticated: true,
      isLoading: false,
    })
  },

  checkAuth: async () => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) {
      set({ isLoading: false, isAuthenticated: false, user: null, token: null })
      return
    }

    try {
      const { data } = await api.get<AuthUser>('/auth/me', {
        headers: { Authorization: `Bearer ${stored}` },
      })
      set({
        token: stored,
        user: data,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      set({ isLoading: false, isAuthenticated: false, user: null, token: null })
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null, token: null, isAuthenticated: false })
    window.location.href = '/login'
  },
}))

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
