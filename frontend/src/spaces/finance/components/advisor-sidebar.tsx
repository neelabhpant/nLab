import { useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  User,
  FileText,
  Upload,
  X,
  Check,
  Pencil,
  Loader2,
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  MessageSquare,
} from 'lucide-react'
import { useAdvisorStore, type UserProfile, type DocumentMeta } from '@/spaces/finance/stores/advisor-store'

const DOC_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  tax_return: { bg: 'bg-amber-100', text: 'text-amber-700' },
  bank_statement: { bg: 'bg-blue-100', text: 'text-blue-700' },
  pay_stub: { bg: 'bg-green-100', text: 'text-green-700' },
  investment_statement: { bg: 'bg-purple-100', text: 'text-purple-700' },
  credit_card_statement: { bg: 'bg-red-100', text: 'text-red-700' },
  insurance_document: { bg: 'bg-teal-100', text: 'text-teal-700' },
  loan_document: { bg: 'bg-orange-100', text: 'text-orange-700' },
  other: { bg: 'bg-slate-100', text: 'text-slate-600' },
  unknown: { bg: 'bg-slate-100', text: 'text-slate-500' },
}

const ACCEPTED = '.pdf,.docx,.txt,.png,.jpg,.jpeg'

function formatDocType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatRelativeDate(ts: number): string {
  const diff = Math.floor((Date.now() / 1000 - ts) / 60)
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

function fmt(val: number | undefined | null): string {
  if (val == null || val === 0) return '—'
  return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function sumNumericValues(obj: Record<string, unknown> | undefined | null, exclude: string[] = []): number {
  if (!obj || typeof obj !== 'object') return 0
  return Object.entries(obj).reduce((sum, [k, v]) => {
    if (exclude.includes(k)) return sum
    if (typeof v === 'number' && v > 0) return sum + v
    return sum
  }, 0)
}

function getMonthlyIncome(profile: UserProfile): number {
  const inc = profile.income
  if (!inc || typeof inc !== 'object') return 0
  if (typeof inc.total_monthly === 'number' && inc.total_monthly > 0) return inc.total_monthly
  if (typeof inc.monthly_income === 'number' && inc.monthly_income > 0) return inc.monthly_income
  if (typeof inc.annual_salary === 'number' && inc.annual_salary > 0) return Math.round(inc.annual_salary / 12)
  return sumNumericValues(inc as Record<string, unknown>)
}

function getMonthlyExpenses(profile: UserProfile): number {
  const exp = profile.expenses
  if (!exp || typeof exp !== 'object') return 0
  if (typeof exp.total_monthly === 'number' && exp.total_monthly > 0) return exp.total_monthly
  return sumNumericValues(exp as Record<string, unknown>)
}

interface AssetItem { label: string; value: number }

function getAssets(profile: UserProfile): { total: number; items: AssetItem[] } {
  const section = profile.assets
  if (!section || typeof section !== 'object') return { total: 0, items: [] }
  const items: AssetItem[] = []
  const accounts = Array.isArray(section.accounts) ? section.accounts : []
  for (const a of accounts) {
    if (a && typeof a === 'object' && typeof a.balance === 'number' && a.balance > 0) {
      items.push({ label: (a.name as string) || (a.type as string) || 'Account', value: a.balance })
    }
  }
  for (const [k, v] of Object.entries(section)) {
    if (k === 'accounts') continue
    if (typeof v === 'number' && v > 0) {
      items.push({ label: formatKey(k), value: v })
    }
  }
  return { total: items.reduce((s, i) => s + i.value, 0), items }
}

function getTotalDebt(profile: UserProfile): number {
  const debts = profile.debts
  if (!Array.isArray(debts)) return 0
  return debts.reduce((s: number, d: Record<string, number>) => s + (d.balance ?? 0), 0)
}

function profileHasData(profile: UserProfile | null): boolean {
  if (!profile) return false
  return getMonthlyIncome(profile) > 0 ||
    getMonthlyExpenses(profile) > 0 ||
    getAssets(profile).total > 0 ||
    getTotalDebt(profile) > 0 ||
    !!(profile.personal && Object.values(profile.personal).some(Boolean))
}

function SectionHeader({ icon: Icon, label, open, onToggle, count }: {
  icon: typeof User
  label: string
  open: boolean
  onToggle: () => void
  count?: number
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-surface-1/50 transition-colors cursor-pointer"
    >
      <span className="flex items-center gap-2 text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" />
        {label}
        {count != null && count > 0 && (
          <span className="text-[11px] font-body font-normal normal-case tracking-normal text-slate-400">
            ({count})
          </span>
        )}
      </span>
      <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </motion.span>
    </button>
  )
}

function FinancialSnapshot({ profile }: { profile: UserProfile }) {
  const income = getMonthlyIncome(profile)
  const expenses = getMonthlyExpenses(profile)
  const { total: totalAssets, items: assetItems } = getAssets(profile)
  const totalDebt = getTotalDebt(profile)
  const netWorth = totalAssets - totalDebt
  const monthlySavings = income - expenses

  return (
    <div className="space-y-2">
      {(income > 0 || expenses > 0) && (
        <div className="rounded-lg bg-gradient-to-br from-cyan/5 to-transparent border border-cyan/10 p-3">
          <p className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-2">Monthly Cash Flow</p>
          <div className="space-y-1.5">
            {income > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] text-slate-600 font-body">
                  <ArrowDownRight className="w-3.5 h-3.5 text-gain" /> Income
                </span>
                <span className="text-[13px] font-display font-semibold text-slate-800">{fmt(income)}</span>
              </div>
            )}
            {expenses > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] text-slate-600 font-body">
                  <ArrowUpRight className="w-3.5 h-3.5 text-loss" /> Expenses
                </span>
                <span className="text-[13px] font-display font-semibold text-slate-800">{fmt(expenses)}</span>
              </div>
            )}
            {income > 0 && expenses > 0 && (
              <>
                <div className="h-px bg-border my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-slate-600 font-body font-medium">Savings</span>
                  <span className={`text-[13px] font-display font-bold ${monthlySavings >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {monthlySavings >= 0 ? '+' : ''}{fmt(monthlySavings)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {(totalAssets > 0 || totalDebt > 0) && (
        <div className="rounded-lg bg-surface-1/50 border border-border p-3">
          <p className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-2">Net Worth</p>
          <p className={`text-xl font-display font-bold ${netWorth >= 0 ? 'text-slate-800' : 'text-loss'}`}>
            {fmt(netWorth)}
          </p>
          <div className="flex gap-3 mt-1.5">
            {totalAssets > 0 && (
              <span className="text-xs font-body text-slate-400">
                Assets <span className="font-display font-medium text-slate-600">{fmt(totalAssets)}</span>
              </span>
            )}
            {totalDebt > 0 && (
              <span className="text-xs font-body text-slate-400">
                Debt <span className="font-display font-medium text-loss">{fmt(totalDebt)}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {assetItems.length > 0 && (
        <div className="space-y-1">
          {assetItems.slice(0, 6).map((item, i) => (
            <div key={i} className="flex items-center justify-between px-1 py-0.5">
              <span className="flex items-center gap-1.5 text-xs text-slate-500 font-body truncate">
                <Landmark className="w-3 h-3 text-slate-300 flex-shrink-0" />
                {item.label}
              </span>
              <span className="text-xs font-display font-medium text-slate-700">{fmt(item.value)}</span>
            </div>
          ))}
          {assetItems.length > 6 && (
            <p className="text-[11px] text-slate-400 font-body text-center">+{assetItems.length - 6} more</p>
          )}
        </div>
      )}
    </div>
  )
}

function OnboardingCard() {
  return (
    <div className="rounded-lg border border-dashed border-cyan/30 bg-cyan/5 p-3.5 text-center">
      <div className="w-8 h-8 rounded-full bg-cyan/10 flex items-center justify-center mx-auto mb-2">
        <MessageSquare className="w-4 h-4 text-cyan" />
      </div>
      <p className="text-[13px] font-display font-semibold text-slate-700 mb-1">Share your financial details</p>
      <p className="text-xs font-body text-slate-400 leading-snug">
        Tell the advisor about your income, expenses, and goals — your profile will build automatically.
      </p>
    </div>
  )
}

function ProfileSection({ profile }: { profile: UserProfile | null }) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const updateProfile = useAdvisorStore((s) => s.updateProfile)

  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [salary, setSalary] = useState('')
  const [monthlyExpenses, setMonthlyExpenses] = useState('')

  const hasData = useMemo(() => profileHasData(profile), [profile])

  const startEdit = () => {
    setName(profile?.personal?.name ?? '')
    setAge(profile?.personal?.age?.toString() ?? '')
    const monthlyInc = profile ? getMonthlyIncome(profile) : 0
    setSalary(monthlyInc > 0 ? String(monthlyInc * 12) : '')
    const monthlyExp = profile ? getMonthlyExpenses(profile) : 0
    setMonthlyExpenses(monthlyExp > 0 ? String(monthlyExp) : '')
    setEditing(true)
  }

  const saveEdit = async () => {
    if (name || age) {
      const personal: Record<string, string | number> = {}
      if (name) personal.name = name
      if (age) personal.age = parseInt(age)
      await updateProfile('personal', personal)
    }
    if (salary) {
      await updateProfile('income', { annual_salary: parseInt(salary), total_monthly: Math.round(parseInt(salary) / 12) })
    }
    if (monthlyExpenses) {
      await updateProfile('expenses', { total_monthly: parseInt(monthlyExpenses) })
    }
    setEditing(false)
  }

  return (
    <div className="border-b border-border">
      <SectionHeader icon={User} label="Your Profile" open={open} onToggle={() => setOpen(!open)} />

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {!editing ? (
                <>
                  {hasData ? (
                    <FinancialSnapshot profile={profile!} />
                  ) : (
                    <OnboardingCard />
                  )}

                  {profile?.personal?.name && (
                    <div className="flex items-center gap-2 mt-2 px-1">
                      <span className="text-xs text-slate-400 font-body">
                        {profile.personal.name}
                        {profile.personal.age ? `, ${profile.personal.age}` : ''}
                        {profile.personal.filing_status ? ` · ${profile.personal.filing_status}` : ''}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1 mt-2 text-xs font-display font-medium text-cyan hover:text-cyan/80 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    {hasData ? 'Edit' : 'Add manually'}
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    className="w-full rounded-md border border-border bg-surface-0 px-2.5 py-1.5 text-xs font-body text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan/30"
                  />
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Age"
                    type="number"
                    className="w-full rounded-md border border-border bg-surface-0 px-2.5 py-1.5 text-xs font-body text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan/30"
                  />
                  <input
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder="Annual salary"
                    type="number"
                    className="w-full rounded-md border border-border bg-surface-0 px-2.5 py-1.5 text-xs font-body text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan/30"
                  />
                  <input
                    value={monthlyExpenses}
                    onChange={(e) => setMonthlyExpenses(e.target.value)}
                    placeholder="Monthly expenses"
                    type="number"
                    className="w-full rounded-md border border-border bg-surface-0 px-2.5 py-1.5 text-xs font-body text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan/30"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveEdit}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan text-white text-xs font-display font-medium hover:bg-cyan/90 transition-colors cursor-pointer"
                    >
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-1 text-slate-500 text-xs font-display font-medium hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DocumentItem({ doc }: { doc: DocumentMeta }) {
  const colors = DOC_TYPE_COLORS[doc.document_type] ?? DOC_TYPE_COLORS.unknown
  return (
    <div className="flex items-start gap-2 py-1.5 px-3">
      <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-display font-medium text-slate-800 truncate">{doc.filename}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[10px] font-display font-semibold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
            {formatDocType(doc.document_type)}
          </span>
          <span className="text-[10px] text-slate-400 font-body">{formatRelativeDate(doc.uploaded_at)}</span>
        </div>
      </div>
    </div>
  )
}

function UploadZone() {
  const { uploading, uploadError, lastUploadResult, uploadDocument, clearUploadResult } = useAdvisorStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      uploadDocument(file)
    },
    [uploadDocument],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile],
  )

  return (
    <div className="px-3 pb-3">
      {lastUploadResult && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 rounded-lg border border-gain/30 bg-gain/5 p-2"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-display font-semibold text-gain">Processed</p>
              <p className="text-[11px] font-body text-slate-600 mt-0.5 leading-snug">{lastUploadResult.summary}</p>
            </div>
            <button onClick={clearUploadResult} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}

      {uploadError && (
        <p className="text-[11px] text-loss font-body mb-2">{uploadError}</p>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-3 transition-all cursor-pointer ${
          dragOver
            ? 'border-cyan bg-cyan/5'
            : 'border-border hover:border-cyan/40 hover:bg-surface-1/30'
        }`}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 text-cyan animate-spin" />
        ) : (
          <Upload className="w-4 h-4 text-slate-400" />
        )}
        <p className="text-[11px] font-body text-slate-400 text-center">
          {uploading ? 'Processing...' : 'Drop files here'}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          onChange={onFileChange}
          className="hidden"
        />
      </div>
    </div>
  )
}

export function AdvisorSidebar() {
  const { profile, documents, documentsLoading } = useAdvisorStore()
  const [docsOpen, setDocsOpen] = useState(true)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <ProfileSection profile={profile} />

      <div>
        <SectionHeader
          icon={FileText}
          label="Documents"
          open={docsOpen}
          onToggle={() => setDocsOpen(!docsOpen)}
          count={documents.length}
        />

        <AnimatePresence initial={false}>
          {docsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {documentsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-4 h-4 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {documents.length > 0 && (
                    <div className="divide-y divide-border/50">
                      {documents.map((doc) => (
                        <DocumentItem key={doc.id} doc={doc} />
                      ))}
                    </div>
                  )}
                  <UploadZone />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
