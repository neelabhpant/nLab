import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Save, Check, AlertCircle, Eye, EyeOff, Rss, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { api } from '@/shared/lib/api'

interface LlmSettings {
  provider: string
  openai_model: string
  anthropic_model: string
  groq_model: string
  has_openai_key: boolean
  has_anthropic_key: boolean
  has_groq_key: boolean
  provider_models: Record<string, string[]>
  newsletter_generation_model: string
  generation_model_choices: string[]
  voice_check_mode: string
  voice_check_modes: string[]
}

const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-7': 'Opus 4.7',
  'claude-opus-4-6': 'Opus 4.6',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-haiku-4-5': 'Haiku 4.5',
}

const VOICE_MODE_LABELS: Record<string, string> = {
  manual: 'Manual only',
  auto_save: 'Auto on save',
  auto_preview: 'Auto on final preview',
}

export function Settings() {
  const { onMobileMenuToggle } = useLayoutContext()
  const [settings, setSettings] = useState<LlmSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [provider, setProvider] = useState('openai')
  const [openaiModel, setOpenaiModel] = useState('gpt-4o')
  const [anthropicModel, setAnthropicModel] = useState('claude-opus-4-7')
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile')
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showGroqKey, setShowGroqKey] = useState(false)
  const [newsletterModel, setNewsletterModel] = useState('claude-sonnet-4-6')
  const [voiceCheckMode, setVoiceCheckMode] = useState('manual')

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await api.get<LlmSettings>('/settings')
      setSettings(data)
      setProvider(data.provider)
      setOpenaiModel(data.openai_model)
      setAnthropicModel(data.anthropic_model)
      setGroqModel(data.groq_model)
      setNewsletterModel(data.newsletter_generation_model)
      setVoiceCheckMode(data.voice_check_mode)
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const payload: Record<string, string> = {
        provider,
        openai_model: openaiModel,
        anthropic_model: anthropicModel,
        groq_model: groqModel,
        newsletter_generation_model: newsletterModel,
        voice_check_mode: voiceCheckMode,
      }
      if (openaiKey) payload.openai_api_key = openaiKey
      if (anthropicKey) payload.anthropic_api_key = anthropicKey
      if (groqKey) payload.groq_api_key = groqKey

      const { data } = await api.post<LlmSettings>('/settings', payload)
      setSettings(data)
      setOpenaiKey('')
      setAnthropicKey('')
      setGroqKey('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const models = settings?.provider_models ?? { openai: [], anthropic: [] }

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Settings" subtitle="LLM provider and model configuration" onMenuToggle={onMobileMenuToggle} />
      <div className="flex-1 overflow-auto p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl border border-border bg-surface-0 p-6 shadow-sm"
            >
              <h2 className="text-base font-display font-semibold text-slate-900 mb-4">LLM Provider</h2>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] font-display font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Closed Source</p>
                  <div className="flex items-center gap-1 rounded-lg bg-surface-1 border border-border p-0.5">
                    {(['openai', 'anthropic'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setProvider(p)}
                        className={`px-4 py-2 rounded-md text-sm font-display font-medium transition-colors cursor-pointer ${
                          provider === p
                            ? 'bg-surface-0 text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {p === 'openai' ? 'OpenAI' : 'Anthropic'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-display font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Open Source</p>
                  <div className="flex items-center gap-1 rounded-lg bg-surface-1 border border-border p-0.5">
                    <button
                      onClick={() => setProvider('groq')}
                      className={`px-4 py-2 rounded-md text-sm font-display font-medium transition-colors cursor-pointer ${
                        provider === 'groq'
                          ? 'bg-surface-0 text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Groq
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="rounded-xl border border-border bg-surface-0 p-6 shadow-sm"
            >
              <h2 className="text-base font-display font-semibold text-slate-900 mb-4">Model Selection</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-body text-slate-600 mb-1.5">OpenAI Model</label>
                  <select
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan"
                  >
                    {models.openai?.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-body text-slate-600 mb-1.5">Anthropic Model</label>
                  <select
                    value={anthropicModel}
                    onChange={(e) => setAnthropicModel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan"
                  >
                    {models.anthropic?.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs font-body text-slate-500">
                    Global model for Finance, Retail, Vault, and Labs features. The newsletter composer has its own model toggle (below).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-body text-slate-600 mb-1.5">Groq Model</label>
                  <select
                    value={groqModel}
                    onChange={(e) => setGroqModel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan"
                  >
                    {models.groq?.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08 }}
              className="rounded-xl border border-border bg-surface-0 p-6 shadow-sm"
            >
              <h2 className="text-base font-display font-semibold text-slate-900 mb-4">Newsletter Composer</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-body text-slate-600 mb-1.5">Generation model</label>
                  <select
                    value={newsletterModel}
                    onChange={(e) => setNewsletterModel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan"
                  >
                    {(settings?.generation_model_choices ?? ['claude-sonnet-4-6', 'claude-opus-4-7']).map((m) => (
                      <option key={m} value={m}>{MODEL_LABELS[m] ?? m}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs font-body text-slate-500">
                    Model for section drafting/polish (The Read, What's Moving, Spotlight, Wins, Horizon). Sonnet 4.6 is the cost-efficient default; Opus 4.7 costs ~5× more. Voice check always runs on Haiku 4.5.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-body text-slate-600 mb-1.5">Voice check</label>
                  <select
                    value={voiceCheckMode}
                    onChange={(e) => setVoiceCheckMode(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan"
                  >
                    {(settings?.voice_check_modes ?? ['manual', 'auto_save', 'auto_preview']).map((m) => (
                      <option key={m} value={m}>{VOICE_MODE_LABELS[m] ?? m}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs font-body text-slate-500">
                    Manual only (default) avoids an extra LLM call after every generation — use the "Check voice" button per section. Auto on save runs it after each generation.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="rounded-xl border border-border bg-surface-0 p-6 shadow-sm"
            >
              <h2 className="text-base font-display font-semibold text-slate-900 mb-1">API Keys</h2>
              <p className="text-xs text-slate-400 font-body mb-4">
                Keys from .env are used by default. Override them here if needed — leave blank to keep existing.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-body text-slate-600 mb-1.5">
                    OpenAI API Key
                    {settings?.has_openai_key && (
                      <span className="ml-2 text-xs text-gain font-medium">configured</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showOpenaiKey ? 'text' : 'password'}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 pr-10 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-body text-slate-600 mb-1.5">
                    Anthropic API Key
                    {settings?.has_anthropic_key && (
                      <span className="ml-2 text-xs text-gain font-medium">configured</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showAnthropicKey ? 'text' : 'password'}
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 pr-10 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-body text-slate-600 mb-1.5">
                    Groq API Key
                    {settings?.has_groq_key && (
                      <span className="ml-2 text-xs text-gain font-medium">configured</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showGroqKey ? 'text' : 'password'}
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      placeholder="gsk_..."
                      className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 pr-10 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGroqKey(!showGroqKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <Link
                to="/settings/sources"
                className="flex items-center justify-between rounded-xl border border-border bg-surface-0 p-5 shadow-sm hover:border-cyan/40 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-cyan/10 text-cyan">
                    <Rss className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-semibold text-slate-900">Data Sources</h3>
                    <p className="text-xs font-body text-slate-500 mt-0.5">RSS feeds powering the Retail research surface</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan transition-colors" />
              </Link>
            </motion.div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-loss font-body">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan text-white text-sm font-display font-medium hover:bg-cyan/90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : saved ? 'Saved' : 'Save Settings'}
              </button>
            </motion.div>

          </div>
        )}
      </div>
    </div>
  )
}
