import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Target,
  Building2,
  GraduationCap,
  Flame,
  Home,
  Sparkles,
  Clock,
  Calendar,
  ShieldAlert,
  TrendingUp,
  LineChart,
  Plus,
  Trash2,
  Download,
  Wallet,
  Ban,
  Leaf,
  CircleDollarSign,
  Globe,
  BarChart3,
} from 'lucide-react'
import { usePortfolioStore, type Holding } from '@/spaces/finance/stores/portfolio-store'

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-3 mb-10">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full overflow-hidden bg-slate-200">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: i + 1 <= step ? '#00D4FF' : 'transparent' }}
              initial={{ width: '0%' }}
              animate={{ width: i + 1 <= step ? '100%' : '0%' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
      ))}
      <span className="text-xs font-display font-semibold text-slate-500 tabular-nums min-w-[44px] text-right">
        {step} / {total}
      </span>
    </div>
  )
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1.5">{title}</h2>
      <p className="text-sm font-body text-slate-500 mb-8">{subtitle}</p>
      {children}
    </div>
  )
}

function MultiSelectButton({
  label,
  icon: Icon,
  selected,
  onClick,
}: {
  label: string
  icon: typeof Target
  selected: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left ${
        selected
          ? 'border-cyan bg-cyan/5 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          selected ? 'bg-cyan/10' : 'bg-slate-100'
        }`}
      >
        <Icon className={`w-5 h-5 ${selected ? 'text-cyan' : 'text-slate-400'}`} />
      </div>
      <span className={`text-sm font-display font-semibold ${selected ? 'text-slate-900' : 'text-slate-600'}`}>
        {label}
      </span>
    </motion.button>
  )
}

function SingleSelectCard({
  label,
  description,
  selected,
  onClick,
}: {
  label: string
  description?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`px-5 py-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left ${
        selected
          ? 'border-cyan bg-cyan/5 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <span className={`text-sm font-display font-semibold block ${selected ? 'text-slate-900' : 'text-slate-600'}`}>
        {label}
      </span>
      {description && (
        <span className="text-xs font-body text-slate-400 mt-0.5 block">{description}</span>
      )}
    </motion.button>
  )
}

function Pill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs font-display font-semibold transition-all duration-200 cursor-pointer ${
        selected
          ? 'bg-cyan text-white shadow-sm'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

const GOAL_OPTIONS = [
  { id: 'retirement', label: 'Retirement', icon: Clock },
  { id: 'wealth_building', label: 'Wealth Building', icon: TrendingUp },
  { id: 'house_purchase', label: 'House Purchase', icon: Home },
  { id: 'education', label: 'Education Fund', icon: GraduationCap },
  { id: 'financial_independence', label: 'Financial Independence', icon: Flame },
  { id: 'other', label: 'Other', icon: Target },
]

const TIMELINE_OPTIONS = [
  { id: '1-3 years', label: '1–3 years', desc: 'Short-term' },
  { id: '3-5 years', label: '3–5 years', desc: 'Medium-term' },
  { id: '5-10 years', label: '5–10 years', desc: 'Long-term' },
  { id: '10-20 years', label: '10–20 years', desc: 'Very long-term' },
  { id: '20+ years', label: '20+ years', desc: 'Maximum horizon' },
]

function Step1Goals() {
  const { answers, setGoals } = usePortfolioStore()
  const selected = answers.goals.selected

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    setGoals({ selected: next })
  }

  return (
    <StepShell title="What are you investing for?" subtitle="Select all that apply — we'll tailor your portfolio to your goals.">
      <div className="grid grid-cols-2 gap-3 mb-6">
        {GOAL_OPTIONS.map((opt) => (
          <MultiSelectButton
            key={opt.id}
            label={opt.label}
            icon={opt.icon}
            selected={selected.includes(opt.id)}
            onClick={() => toggle(opt.id)}
          />
        ))}
      </div>
      <div>
        <label className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Describe your primary goal (optional)
        </label>
        <textarea
          value={answers.goals.description}
          onChange={(e) => setGoals({ description: e.target.value })}
          placeholder="e.g., I want to save $200k for a house down payment in 5 years..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm text-slate-900 font-body placeholder:text-slate-300 focus:border-cyan focus:outline-none resize-none transition-colors"
        />
      </div>
    </StepShell>
  )
}

function Step2Timeline() {
  const { answers, setTimeline } = usePortfolioStore()

  return (
    <StepShell title="When do you need this money?" subtitle="Your investment horizon determines how much risk is appropriate.">
      <div className="grid grid-cols-1 gap-3 mb-6">
        {TIMELINE_OPTIONS.map((opt) => (
          <SingleSelectCard
            key={opt.id}
            label={opt.label}
            description={opt.desc}
            selected={answers.timeline.horizon === opt.id}
            onClick={() => setTimeline({ horizon: opt.id })}
          />
        ))}
      </div>
      <div>
        <label className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Target date (optional)
        </label>
        <div className="relative">
          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={answers.timeline.target_date}
            onChange={(e) => setTimeline({ target_date: e.target.value })}
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm text-slate-900 font-body focus:border-cyan focus:outline-none transition-colors"
          />
        </div>
      </div>
    </StepShell>
  )
}

function Step3Risk() {
  const { answers, setRisk } = usePortfolioStore()

  return (
    <StepShell title="Understanding your risk comfort" subtitle="We use scenario-based questions rather than simple labels — this gives a more accurate picture.">
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-cyan" />
            <h3 className="text-sm font-display font-bold text-slate-800">
              Your portfolio drops 20% in a month. You:
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'hold', label: 'Hold and wait' },
              { id: 'buy_more', label: 'Buy more' },
              { id: 'sell_some', label: 'Sell some' },
              { id: 'sell_everything', label: 'Sell everything' },
            ].map((opt) => (
              <SingleSelectCard
                key={opt.id}
                label={opt.label}
                selected={answers.risk.drawdown_reaction === opt.id}
                onClick={() => setRisk({ drawdown_reaction: opt.id })}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-cyan" />
            <h3 className="text-sm font-display font-bold text-slate-800">
              You prefer investments that:
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[
              { id: 'steady', label: 'Grow steadily with small returns' },
              { id: 'balanced', label: 'Balance growth and stability' },
              { id: 'maximize', label: 'Maximise growth even if volatile' },
            ].map((opt) => (
              <SingleSelectCard
                key={opt.id}
                label={opt.label}
                selected={answers.risk.investment_preference === opt.id}
                onClick={() => setRisk({ investment_preference: opt.id })}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <LineChart className="w-4 h-4 text-cyan" />
            <h3 className="text-sm font-display font-bold text-slate-800">
              Your investing experience:
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'beginner', label: 'Beginner' },
              { id: 'intermediate', label: 'Intermediate' },
              { id: 'advanced', label: 'Advanced' },
            ].map((opt) => (
              <SingleSelectCard
                key={opt.id}
                label={opt.label}
                selected={answers.risk.experience === opt.id}
                onClick={() => setRisk({ experience: opt.id })}
              />
            ))}
          </div>
        </div>

        {answers.risk.drawdown_reaction && answers.risk.investment_preference && answers.risk.experience && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-5 py-3 rounded-xl bg-cyan/5 border border-cyan/20"
          >
            <div className="text-sm font-display font-bold text-cyan">
              Risk Score: {answers.risk.score}/10
            </div>
            <div className="text-xs font-body text-slate-500">
              {answers.risk.score <= 3 && 'Conservative — you prioritise capital preservation'}
              {answers.risk.score > 3 && answers.risk.score <= 6 && 'Moderate — you balance growth with stability'}
              {answers.risk.score > 6 && 'Aggressive — you maximise growth and tolerate volatility'}
            </div>
          </motion.div>
        )}
      </div>
    </StepShell>
  )
}

function Step4Portfolio() {
  const { answers, setPortfolio, importProfile } = usePortfolioStore()
  const [importing, setImporting] = useState(false)

  const addHolding = () => {
    setPortfolio({
      holdings: [...answers.portfolio.holdings, { account_type: '', asset: '', value: 0 }],
    })
  }

  const removeHolding = (index: number) => {
    setPortfolio({
      holdings: answers.portfolio.holdings.filter((_, i) => i !== index),
    })
  }

  const updateHolding = (index: number, field: keyof Holding, value: string | number) => {
    const updated = answers.portfolio.holdings.map((h, i) =>
      i === index ? { ...h, [field]: value } : h
    )
    setPortfolio({ holdings: updated })
  }

  const handleImport = async () => {
    setImporting(true)
    await importProfile()
    setImporting(false)
  }

  return (
    <StepShell title="Your current investments" subtitle="Tell us about your existing portfolio so we can factor it into the recommendation.">
      <div className="space-y-6">
        <div className="flex gap-3">
          <button
            onClick={() => setPortfolio({ has_investments: true })}
            className={`flex-1 px-5 py-4 rounded-xl border-2 text-sm font-display font-semibold transition-all duration-200 cursor-pointer ${
              answers.portfolio.has_investments
                ? 'border-cyan bg-cyan/5 text-slate-900'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            }`}
          >
            Yes, I have investments
          </button>
          <button
            onClick={() => setPortfolio({ has_investments: false, holdings: [] })}
            className={`flex-1 px-5 py-4 rounded-xl border-2 text-sm font-display font-semibold transition-all duration-200 cursor-pointer ${
              !answers.portfolio.has_investments
                ? 'border-cyan bg-cyan/5 text-slate-900'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            }`}
          >
            Starting fresh
          </button>
        </div>

        <AnimatePresence>
          {answers.portfolio.has_investments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">
                  Holdings
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-cyan hover:bg-cyan/5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3 h-3" />
                    {importing ? 'Importing...' : 'Import from profile'}
                  </button>
                  <button
                    onClick={addHolding}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
              </div>

              {answers.portfolio.holdings.length > 0 && (
                <div className="space-y-2">
                  {answers.portfolio.holdings.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={h.account_type}
                        onChange={(e) => updateHolding(i, 'account_type', e.target.value)}
                        className="w-36 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 font-body focus:border-cyan focus:outline-none"
                      >
                        <option value="">Account type</option>
                        <option value="401k">401(k)</option>
                        <option value="ira">IRA</option>
                        <option value="roth_ira">Roth IRA</option>
                        <option value="brokerage">Brokerage</option>
                        <option value="crypto">Crypto</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="text"
                        value={h.asset}
                        onChange={(e) => updateHolding(i, 'asset', e.target.value)}
                        placeholder="Fund/asset (e.g. VOO)"
                        className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 font-body placeholder:text-slate-300 focus:border-cyan focus:outline-none"
                      />
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                        <input
                          type="number"
                          value={h.value || ''}
                          onChange={(e) => updateHolding(i, 'value', parseFloat(e.target.value) || 0)}
                          placeholder="Value"
                          className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 font-body placeholder:text-slate-300 focus:border-cyan focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => removeHolding(i)}
                        className="p-2 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {answers.portfolio.holdings.length === 0 && (
                <div className="text-center py-6 text-xs font-body text-slate-400">
                  No holdings added yet. Click "Add" or "Import from profile".
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <label className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
            Monthly investment capacity *
          </label>
          <div className="relative">
            <Wallet className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-body">$</span>
            <input
              type="number"
              value={answers.portfolio.monthly_investment || ''}
              onChange={(e) => setPortfolio({ monthly_investment: parseFloat(e.target.value) || 0 })}
              placeholder="2,000"
              className="w-full pl-14 pr-4 py-3.5 rounded-xl border-2 border-slate-200 bg-white text-lg text-slate-900 font-display font-bold placeholder:text-slate-300 placeholder:font-normal focus:border-cyan focus:outline-none transition-colors"
            />
          </div>
          <p className="text-xs font-body text-slate-400 mt-1.5">
            How much can you invest each month? This determines your DCA plan.
          </p>
        </div>
      </div>
    </StepShell>
  )
}

const AVOID_OPTIONS = [
  { id: 'fossil_fuels', label: 'Fossil Fuels', icon: Leaf },
  { id: 'weapons', label: 'Weapons', icon: Ban },
  { id: 'gambling', label: 'Gambling', icon: CircleDollarSign },
  { id: 'tobacco', label: 'Tobacco', icon: Ban },
  { id: 'crypto', label: 'Crypto', icon: CircleDollarSign },
]

const INCLUDE_OPTIONS = [
  { id: 'crypto', label: 'Crypto', icon: CircleDollarSign },
  { id: 'reits', label: 'REITs', icon: Building2 },
  { id: 'bonds', label: 'Bonds', icon: ShieldAlert },
  { id: 'international', label: 'International', icon: Globe },
  { id: 'small_cap', label: 'Small Cap', icon: BarChart3 },
]

function Step5Preferences() {
  const { answers, setPreferences } = usePortfolioStore()

  const toggleAvoid = (id: string) => {
    const next = answers.preferences.avoid.includes(id)
      ? answers.preferences.avoid.filter((s) => s !== id)
      : [...answers.preferences.avoid, id]
    setPreferences({ avoid: next })
  }

  const toggleInclude = (id: string) => {
    const next = answers.preferences.include.includes(id)
      ? answers.preferences.include.filter((s) => s !== id)
      : [...answers.preferences.include, id]
    setPreferences({ include: next })
  }

  return (
    <StepShell title="Preferences & constraints" subtitle="Any sectors to avoid or asset types you specifically want? These aren't required.">
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-display font-bold text-slate-800 mb-3">Sectors to avoid</h3>
          <div className="flex flex-wrap gap-2">
            {AVOID_OPTIONS.map((opt) => (
              <Pill
                key={opt.id}
                label={opt.label}
                selected={answers.preferences.avoid.includes(opt.id)}
                onClick={() => toggleAvoid(opt.id)}
              />
            ))}
            <Pill
              label="None"
              selected={answers.preferences.avoid.length === 0}
              onClick={() => setPreferences({ avoid: [] })}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-display font-bold text-slate-800 mb-3">Asset types to include</h3>
          <div className="flex flex-wrap gap-2">
            {INCLUDE_OPTIONS.map((opt) => (
              <Pill
                key={opt.id}
                label={opt.label}
                selected={answers.preferences.include.includes(opt.id)}
                onClick={() => toggleInclude(opt.id)}
              />
            ))}
            <Pill
              label="None"
              selected={answers.preferences.include.length === 0}
              onClick={() => setPreferences({ include: [] })}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-display font-bold text-slate-800 mb-3">Tax situation</h3>
          <div className="grid grid-cols-1 gap-3">
            {[
              { id: 'tax_advantaged', label: 'Tax-advantaged accounts (401k/IRA)', desc: 'Most or all investments in pre-tax accounts' },
              { id: 'taxable', label: 'Taxable accounts only', desc: 'Standard brokerage accounts' },
              { id: 'both', label: 'Both', desc: 'A mix of tax-advantaged and taxable' },
            ].map((opt) => (
              <SingleSelectCard
                key={opt.id}
                label={opt.label}
                description={opt.desc}
                selected={answers.preferences.tax_situation === opt.id}
                onClick={() => setPreferences({ tax_situation: opt.id })}
              />
            ))}
          </div>
        </div>
      </div>
    </StepShell>
  )
}

function canAdvance(step: number, answers: ReturnType<typeof usePortfolioStore.getState>['answers']): boolean {
  switch (step) {
    case 1:
      return answers.goals.selected.length > 0
    case 2:
      return answers.timeline.horizon !== ''
    case 3:
      return (
        answers.risk.drawdown_reaction !== '' &&
        answers.risk.investment_preference !== '' &&
        answers.risk.experience !== ''
      )
    case 4:
      return answers.portfolio.monthly_investment > 0
    case 5:
      return true
    default:
      return false
  }
}

const STEPS = [Step1Goals, Step2Timeline, Step3Risk, Step4Portfolio, Step5Preferences]

export function Questionnaire({ onSubmit }: { onSubmit: () => void }) {
  const { currentStep, answers, nextStep, prevStep } = usePortfolioStore()
  const [direction, setDirection] = useState(1)

  const StepComponent = STEPS[currentStep - 1]
  const valid = canAdvance(currentStep, answers)

  const handleNext = () => {
    if (currentStep === 5) {
      onSubmit()
      return
    }
    setDirection(1)
    nextStep()
  }

  const handleBack = () => {
    setDirection(-1)
    prevStep()
  }

  return (
    <div className="flex-1 flex flex-col px-8 py-6 overflow-y-auto">
      <ProgressBar step={currentStep} total={5} />

      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <StepComponent />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <motion.button
          whileTap={valid ? { scale: 0.97 } : undefined}
          onClick={handleNext}
          disabled={!valid}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-display font-semibold transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            currentStep === 5
              ? 'bg-cyan text-white shadow-md hover:shadow-lg'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {currentStep === 5 ? (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Portfolio
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </motion.button>
      </div>
    </div>
  )
}
