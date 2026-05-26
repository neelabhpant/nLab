# Phase 6 Notes — Export Formats + Voice-Corpus Auto-Growth

What was built, decisions made, and follow-ups observed.

## Delivered

- **`services/newsletter/exports.py`** — three pure builders:
  - `build_pdf(issue, spotlight_image=None)` — PyMuPDF, Cloudera orange (`#F96302`) + deep navy header, 5 sections, optional inline POV screenshot, footer with author block. Helvetica family (PDF built-in) for the sans-serif look — Space Grotesk/Outfit aren't embeddable without shipping font files.
  - `build_email_html(issue)` — single-column ~600px table layout, **all CSS inlined** (no `<style>` block; email clients drop them). No `premailer` dependency added.
  - `build_slack_text(issue)` — `*bold*` headers, `•` bullets, generated on demand.
- **`composer.mark_sent`** — now generates + persists PDF/HTML to `issues/{YYYY-MM}/{slug}/` and harvests each non-empty section into the voice corpus (`from_published_issue=1`). Both steps are wrapped in try/except so a failure can't block the send.
- **Voice auto-growth** — `from_published_issue` column added to `voice_examples` (schema + idempotent `ALTER TABLE` migration in `LocalStorageBackend._apply_migrations`). `get_few_shot_examples` now orders published-first, then newest.
- **3 endpoints** — `GET /newsletter/issues/{id}/{pdf,html,slack}`.
- **Frontend** — `issue-view.tsx` export toolbar (Download PDF, Download HTML, Copy HTML for email via rich `ClipboardItem`, Copy for Slack). API helpers `issuePdfUrl`/`issueHtmlUrl`/`getSlackText`/`getEmailHtml`.
- **Tests** — `test_exports.py`, 7 tests. Full backend suite 73/73.

## Decisions

- **Slack served on demand**, not stored (your call) — no schema change, never stale.
- **Exports generated synchronously inside `mark_sent`.** PDF/HTML build is local and fast (~100ms, no LLM), so no background task. The send response now includes populated `pdf_path`/`html_path`.
- **Resilient generation** — if PDF/HTML or corpus harvest throws, the issue still ships (moves to archive); endpoints return 404 for a missing artifact. Rationale: never trap a finished issue because of a rendering hiccup.
- **Voice harvest is one example per non-empty section** (5 max per issue), `source="Issue NNN"`. Empty sections are skipped.

## ⚠ Out-of-scope bug surfaced (recommend a separate hotfix)

On backend start I saw repeated:

```
WARNING app.services.retail_summarizer: Summarization failed ...
litellm.BadRequestError: AnthropicException - `temperature` is deprecated for this model.
```

This is the **same root cause** as the Phase 5 newsletter hotfix (Opus 4.7 rejects `temperature`), but in the **global CrewAI LLM path** (`services/llm.py:get_llm`, which always passes `temperature=0.3`). Because your global model is now `claude-opus-4-7`, every CrewAI-backed feature that runs on Anthropic is affected — confirmed breaking **retail digest summarization**, and almost certainly **finance chat, financial advisor, trading agents, workshop, portfolio** too (all use `get_llm`).

I did **not** fix it — it's outside Phase 6 (exports) and touches shared finance/retail code. But it's an active regression in shipped features. The fix mirrors the newsletter one: in `services/llm.py:get_llm`, drop `temperature` for `claude-opus-4-7` (and any future temperature-less models). Small, surgical. Worth doing before the next demo of any AI feature outside the newsletter.

## Follow-ups / smaller items

- **Author contact line** in PDF/HTML footer is a placeholder constant (`AUTHOR_CONTACT` in `exports.py`). Real contact/email should be filled in before Issue 1 ships (Phase 7).
- **Fonts in PDF** are Helvetica, not the app's Space Grotesk/Outfit. Matching brand fonts needs embedding TTFs via `page.insert_font` — deferred to Phase 8 (visual polish).
- **No "regenerate exports" endpoint.** If an issue's exports failed at send time, there's no way to rebuild them short of re-sending. A `POST /issues/{id}/exports` could be added later; not needed for v1.
- **Copy HTML uses `ClipboardItem`** (rich text/html) with a `writeText` fallback. Works in Chromium/Safari; older browsers fall back to copying source. Fine for a single-user desktop tool.
- **Voice corpus will grow 5/issue.** By ~Issue 10 the `the_read` few-shot pool is published-dominated, which is the intended behavior (spec §5.4). No pruning UI beyond the existing Voice Examples page; monitor corpus size over time.
- **Storage `list()` still loads every row** to filter/sort in Python (carried from earlier phases). Voice corpus + issues are small; revisit if either grows large.

## Verification done

- Migration applied against the live populated DB: 17 existing examples read back intact, `from_published_issue=False` on seeded rows, column present.
- 73/73 backend tests pass. Frontend TS clean (only pre-existing forecast/roadmap/trading-agents/workshop errors remain).
- Both servers boot; all 3 export endpoints present in OpenAPI.
- Live mark-sent through the UI not exercised here (would mutate the real corpus + create a real issue); covered by `test_exports.py` against isolated storage instead.
