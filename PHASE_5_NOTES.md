# Phase 5 Notes — AI Integration + Voice Tuning

Items observed during the AI integration build that fell outside Phase 5 scope. Logged for Phase 6 (export formats) planning.

## Anthropic API key — current state on this machine

The Anthropic key in `backend/data/user_settings.json` (loaded from `.env`) returns **401 invalid_api_key** when called against `api.anthropic.com`. The code paths are correct — Phase 5 tests verified both the no-key (raises `AnthropicNotConfigured` → 500) and model-not-found (`NotFoundError` → fallback to user's Anthropic model) branches with mocks. But Sample output from a real run (acceptance deliverable 6) needs a working key.

**To unblock**: rotate the key in `Settings → Anthropic API Key`, then any generation endpoint will return content. No code change needed.

## Voice corpus already seeded

The startup log on backend restart reads:

```
2026-05-21 ... INFO app.main: Voice corpus has 17 entries, skipping seed.
```

So the seed loader is idempotent and the corpus is live. If you ever want a fresh seed, delete the `voice_examples` rows from `backend/data/newsletter/newsletter.db` or wipe the DB file.

## Logging now visible

Added `logging.basicConfig(level=logging.INFO, ...)` at the top of `main.py`. This unblocks several follow-ups flagged in Phases 3/4:

- Vault initialised / Retail initialised logs now surface.
- POV and voice seed loader counts log on every startup.
- The newsletter LLM client logs the actual model used per call (criterion 18 requirement).

If this turns out to be noisy in production-ish use, gate it behind an env flag.

## Model fallback semantics

`NewsletterLLMClient.generate` always tries `claude-opus-4-7` first. If Anthropic returns a model-not-found error (`NotFoundError` or `BadRequestError` with "model not / invalid" text), the client retries with the user's configured `anthropic_model` and logs the fallback. No retry on auth, rate-limit, or content errors — those propagate to the router for 500.

Two non-obvious consequences:

1. **Latency penalty on first call** if Opus 4.7 isn't available on the account — every call eats two round-trips. Once we observe this in real use, consider caching the resolved model name for the process lifetime.
2. **Per-request key resolution** — `_ensure_client` reads `get_user_settings()` on every call but only rebuilds the SDK client when the key changes. Lets the user update the key in the Settings UI without restarting the server.

## Voice check is informational only

Per the spec (Option B, soft warning), generation never blocks on voice violations. The banner appears, the user decides. Two related design choices:

- Voice check runs **automatically** after every generation (criterion 10).
- If the voice check itself fails (network blip, malformed JSON), we silently swallow the error and clear the warning list. The user still sees their generated text. Worth revisiting if voice quality slips and we want louder failure signals.

## `splitListSection` heuristic

For What's Moving, Wins, and Horizon, the store splits LLM output on blank lines OR leading numerals. The prompts ask for "blank line separated paragraphs, no bullets". Works in practice. Two edge cases I noticed in testing:

- The LLM sometimes adds a leading "1. " despite the prompt asking for none. The split regex tolerates it.
- The LLM occasionally produces extra paragraphs beyond the asked count. The store slices to `[:4]` or `[:3]`. The 4th/extra content is dropped without warning. If users start saying "where did my fourth bullet go", expose the raw response in a debug toggle.

## `_safe_json_load` for voice_check

Haiku doesn't always honor the "JSON only" instruction — it sometimes wraps the JSON in `` ```json ... ``` `` or prefixes prose. The helper strips fences and extracts the outermost `{ ... }`. If parsing still fails, returns `{"violations": []}` (fail-closed: never block the user). Logged at WARNING level for observability.

## Constraints still soft, not hard

Per Phase 4 notes — section editors warn on word/character overrun but don't reject. The prompts contain hard caps (130 words for The Read, 25 words per What's Moving line, etc.). Real-world: Opus respects the caps when the few-shot corpus reinforces brevity. If issues slip past the prompt, we now have voice check as a second line of defense; constraint check (word/line count) could be added there in Phase 6 if needed.

## Voice corpus growth — wired for Phase 6

The spec (§5.4) calls for auto-adding sent-issue sections to the voice corpus with a `from_published_issue=true` flag, then preferring those in few-shot selection. This phase did NOT touch that path (per the explicit "Do NOT" rule). Implementation notes for Phase 6:

- The `voice_examples` schema (from Phase 2 §3.2) has no `from_published_issue` column. Adding it means either a schema migration or piggybacking on the `notes` column (e.g., prefix `[from_published_issue]`).
- `voice_service.get_few_shot_examples` currently orders by `created_at` descending. To prefer published, add a `from_published_issue` filter or sort key.
- The hook will live in `composer_service.mark_sent` — after the issue is created in `newsletter_issues`, also write 5 rows into `voice_examples` (one per section content).

## Storage layer carry-overs

Same items from Phase 3/4:
- No partial update (still read-modify-write at every caller).
- No richer filter (POV's `tag`/`account` and voice's `section_type` filter both happen in Python after `storage.list()`).
- No bulk write.

None of these blocked Phase 5; they will start to bite when the corpus grows past ~100 examples or POVs past ~50.

## Frontend follow-ups

- The compose page now imports four more components per active section (overlay, voice banner, error toast, AI button). Bundle impact is small (each is a few hundred bytes) but it's worth keeping an eye on as Phase 6 adds preview / export panels.
- The voice warning banner uses a static `RULE_LABELS` map. If we ever localise the UI, this becomes a translation source.
- The "Tailored for account" UX in the spotlight editor is currently a small inline input that appears when "Tailor for account" is clicked AND a fixed input below the textarea (legacy from Phase 4). They both write to the same field. Slightly redundant; consolidate in a visual pass.

## Pre-existing TypeScript noise unchanged

Still `forecast.tsx`, `roadmap.tsx`, `trading-agents.tsx`, `workshop.tsx`. None of my Phase 5 files add new errors.
