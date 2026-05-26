import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, AlertCircle, Loader2, FileDown, Code2, MessageSquare, Check, Type } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { useComposeStore, type SentIssue } from './stores/compose-store'
import { newsletterApi, issuePdfUrl, issueHtmlUrl } from '@/shared/lib/newsletter-api'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function IssueView() {
  const { onMobileMenuToggle } = useLayoutContext()
  const { issueId } = useParams<{ issueId: string }>()
  const { loadIssue } = useComposeStore()
  const [issue, setIssue] = useState<SentIssue | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!issueId) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    loadIssue(issueId).then((i) => {
      if (cancelled) return
      if (!i) setNotFound(true)
      setIssue(i)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [issueId, loadIssue])

  return (
    <div className="h-full flex flex-col">
      <TopHeader
        title={issue?.title ?? 'Issue'}
        subtitle={issue?.slug ? `The Retail Read — ${issue.slug}` : 'Archive'}
        onMenuToggle={onMobileMenuToggle}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
          <Link
            to="/retail/compose/archive"
            className="inline-flex items-center gap-1.5 text-sm font-display font-medium text-slate-500 hover:text-slate-900 mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to archive
          </Link>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-slate-500">Loading issue…</p>
            </div>
          ) : notFound || !issue ? (
            <div className="rounded-xl border border-loss/20 bg-loss/5 p-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-loss" />
              <p className="text-sm text-slate-700">
                Issue not found.{' '}
                <Link to="/retail/compose/archive" className="underline text-loss font-medium">
                  Back to archive
                </Link>
              </p>
            </div>
          ) : (
            <motion.article
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-7"
            >
              <header className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-[11px] font-display font-semibold uppercase tracking-wider">
                    {issue.slug}
                  </span>
                  <span className="text-[11px] font-display font-medium text-slate-500">
                    Sent {formatDate(issue.sent_at)}
                    {issue.recipient_count != null && ` · ${issue.recipient_count} recipients`}
                  </span>
                </div>
                <h1 className="text-2xl font-display font-bold text-slate-900 leading-tight">
                  {issue.title}
                </h1>
                <ExportToolbar issue={issue} />
              </header>

              <ReadOnlySection title="The Read">
                <ReadOnlyProse text={issue.sections.the_read.content} />
              </ReadOnlySection>

              <ReadOnlySection title="What's Moving">
                {issue.sections.whats_moving.items.length === 0 ? (
                  <Empty />
                ) : (
                  <ul className="list-disc pl-5 space-y-1.5 marker:text-emerald-500">
                    {issue.sections.whats_moving.items
                      .filter((i) => i.line.trim())
                      .map((i, idx) => (
                        <li key={idx} className="text-sm font-body text-slate-800 leading-relaxed">
                          {i.line}
                        </li>
                      ))}
                  </ul>
                )}
              </ReadOnlySection>

              <ReadOnlySection title="Use Case Spotlight">
                {issue.sections.use_case_spotlight.tailored_for_account && (
                  <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-emerald-700 mb-2">
                    Tailored for {issue.sections.use_case_spotlight.tailored_for_account}
                  </p>
                )}
                <ReadOnlyProse text={issue.sections.use_case_spotlight.content} />
              </ReadOnlySection>

              <ReadOnlySection title="Wins & References">
                {issue.sections.wins.items.length === 0 ? (
                  <Empty />
                ) : (
                  <ul className="list-disc pl-5 space-y-1.5 marker:text-emerald-500">
                    {issue.sections.wins.items
                      .filter((s) => s.trim())
                      .map((s, idx) => (
                        <li key={idx} className="text-sm font-body text-slate-800 leading-relaxed">
                          {s}
                        </li>
                      ))}
                  </ul>
                )}
              </ReadOnlySection>

              <ReadOnlySection title="On the Horizon">
                {issue.sections.horizon.items.length === 0 ? (
                  <Empty />
                ) : (
                  <ul className="list-disc pl-5 space-y-1.5 marker:text-emerald-500">
                    {issue.sections.horizon.items
                      .filter((s) => s.trim())
                      .map((s, idx) => (
                        <li key={idx} className="text-sm font-body text-slate-800 leading-relaxed">
                          {s}
                        </li>
                      ))}
                  </ul>
                )}
              </ReadOnlySection>

              {issue.footer_cta && (
                <footer className="rounded-xl border border-border bg-surface-1 px-5 py-4 text-sm font-body text-slate-700 italic">
                  {issue.footer_cta}
                </footer>
              )}
            </motion.article>
          )}
        </div>
      </div>
    </div>
  )
}

function ExportToolbar({ issue }: { issue: SentIssue }) {
  const [copied, setCopied] = useState<'slack' | 'html' | 'subject' | null>(null)
  const [busy, setBusy] = useState<'slack' | 'html' | null>(null)

  const flash = (which: 'slack' | 'html' | 'subject') => {
    setCopied(which)
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000)
  }

  const copySubject = async () => {
    try {
      await navigator.clipboard.writeText(issue.title)
      flash('subject')
    } catch {
      /* silent */
    }
  }

  const copySlack = async () => {
    setBusy('slack')
    try {
      const text = await newsletterApi.getSlackText(issue.id)
      await navigator.clipboard.writeText(text)
      flash('slack')
    } catch {
      /* clipboard or network failure — silent; user can retry */
    } finally {
      setBusy(null)
    }
  }

  const copyHtml = async () => {
    setBusy('html')
    try {
      const htmlText = await newsletterApi.getEmailHtml(issue.id)
      // Prefer rich clipboard so pasting into Outlook/Gmail yields the rendered
      // email; fall back to copying the source text.
      try {
        const item = new ClipboardItem({
          'text/html': new Blob([htmlText], { type: 'text/html' }),
          'text/plain': new Blob([htmlText], { type: 'text/plain' }),
        })
        await navigator.clipboard.write([item])
      } catch {
        await navigator.clipboard.writeText(htmlText)
      }
      flash('html')
    } catch {
      /* silent */
    } finally {
      setBusy(null)
    }
  }

  const btn =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium border transition-colors cursor-pointer'

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      <button
        type="button"
        onClick={copySubject}
        className={`${btn} border-slate-300 bg-surface-0 text-slate-700 hover:border-amber-400 hover:text-amber-800`}
        title="Copy the issue title to use as the email subject line"
      >
        {copied === 'subject' ? (
          <Check className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <Type className="w-3.5 h-3.5" />
        )}
        {copied === 'subject' ? 'Copied subject' : 'Copy subject'}
      </button>
      <a
        href={issuePdfUrl(issue.id)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btn} border-slate-300 bg-surface-0 text-slate-700 hover:border-amber-400 hover:text-amber-800`}
      >
        <FileDown className="w-3.5 h-3.5" />
        Download PDF
      </a>
      <a
        href={issueHtmlUrl(issue.id)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btn} border-slate-300 bg-surface-0 text-slate-700 hover:border-amber-400 hover:text-amber-800`}
      >
        <FileDown className="w-3.5 h-3.5" />
        Download HTML
      </a>
      <button
        type="button"
        onClick={copyHtml}
        disabled={busy === 'html'}
        className={`${btn} border-slate-300 bg-surface-0 text-slate-700 hover:border-amber-400 hover:text-amber-800 disabled:opacity-50`}
      >
        {busy === 'html' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : copied === 'html' ? (
          <Check className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <Code2 className="w-3.5 h-3.5" />
        )}
        {copied === 'html' ? 'Copied for email' : 'Copy HTML (email)'}
      </button>
      <button
        type="button"
        onClick={copySlack}
        disabled={busy === 'slack'}
        className={`${btn} border-slate-300 bg-surface-0 text-slate-700 hover:border-amber-400 hover:text-amber-800 disabled:opacity-50`}
      >
        {busy === 'slack' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : copied === 'slack' ? (
          <Check className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <MessageSquare className="w-3.5 h-3.5" />
        )}
        {copied === 'slack' ? 'Copied for Slack' : 'Copy for Slack'}
      </button>
    </div>
  )
}

function ReadOnlySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </p>
      <div className="rounded-xl border border-border bg-surface-0 px-5 py-4">{children}</div>
    </section>
  )
}

function ReadOnlyProse({ text }: { text: string }) {
  if (!text.trim()) return <Empty />
  return (
    <p className="text-sm font-body text-slate-800 leading-relaxed whitespace-pre-line">{text}</p>
  )
}

function Empty() {
  return <p className="text-xs font-body text-slate-400 italic">— empty —</p>
}
