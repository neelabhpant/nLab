# Phase 4 Notes — Composer Shell + State Management

Items observed during the composer-shell build that fell outside Phase 4 scope. Logged so Phase 5 planning can pick what to keep, what to triage.

## Auto-save design — known caveats

Implementation uses a module-scoped `setTimeout` debounce (5 seconds) inside `compose-store.ts`. It is intentionally simple. Three sharp edges to keep in mind:

1. **One in-flight save at a time.** If the user keeps typing through a 5-second save round-trip, the *next* edit schedules another save 5 seconds out. If the save fails mid-flight, the next change cycle retries — but there's no exponential backoff. For a single-user tool that's fine; if Phase 5 makes saves heavier (AI summarization on save?), reconsider.
2. **No save on tab close.** If the user closes the tab during the 5-second window after typing, that change is lost. A `beforeunload` listener calling `saveCurrentDraft()` synchronously would close this gap. Left out because it's a real UX trade-off (browser warning prompt vs silent data loss) and Phase 5 will likely revisit auto-save mechanics when AI assist starts mutating the draft.
3. **Module-scoped timer leaks across navigation.** The `useEffect` cleanup in `ComposePage` calls `resetCurrentDraft()` which clears the timer. But if a future page also imports `compose-store` and triggers a save outside the composer, that timer could fire unexpectedly. Acceptable for the v1 surface; will need refactoring when the composer is embedded elsewhere.

## Title derivation duplicated front/back

`_derive_title` in `services/newsletter/composer.py` and `deriveTitle` in `stores/compose-store.ts` implement the same logic. The frontend version is used while editing (so the page title updates live without a round-trip); the backend version owns the persisted `title` field at send-time. The two are consistent today but will drift if anyone touches one without the other. Worth pulling into a shared spec or a thin JSON-schema test in Phase 5.

## "Mark as Sent" is irreversible in v1

The send modal language says so, and it's true: there's no API to demote a `SentIssue` back to a draft. If Neelabh accidentally hits Send, the only recovery is direct SQLite editing. The spec calls this out (§9.3), so this is by design — but consider adding a soft-delete or "rollback to draft" endpoint in v2 once a real user hits this.

## Backend logging still silent

Confirmed in Phase 3, still true here: `logger.info(...)` calls in `main.py` and services never surface because uvicorn's default config doesn't configure root logging. Trivial to fix with a `logging.basicConfig(level=logging.INFO)` near the top of `main.py`. Left out of scope.

## Empty draft creation pattern

`POST /newsletter/drafts` accepts an optional body. When the frontend creates a fresh draft, it sends an empty `sections` payload with the `EMPTY_SECTIONS` shape (4 empty `whats_moving` items, 3 empty `wins` / `horizon` strings). This is convenient for editing — the section editors don't need to "insert row" logic. But it means the DB stores empty rows that look like content. The backend's `sectionHasContent` helper compensates for the frontend; the backend has no equivalent. If we ever query "drafts with content" server-side, we'll need to add that filter.

## Stepper accessibility

The horizontal section stepper uses `<button>` elements but doesn't implement arrow-key navigation between steps. Keyboard users can Tab through, which works but isn't the WAI-ARIA "tabs" pattern. If Phase 8 (design polish) adopts ARIA tabs, this becomes a non-trivial refactor.

## Pre-existing TypeScript noise unchanged

Same set as Phases 2/3 — `forecast.tsx`, `roadmap.tsx`, `trading-agents.tsx`, `workshop.tsx`. None of my Phase 4 files add new errors. Recommend a dedicated TS hygiene PR.

## Storage layer: what bumps did Phase 4 surface?

Same items as Phase 3 (no partial update; no rich filter; no bulk ops). One new observation: the `content_json` blob is loaded entirely every time we read a draft. For "list drafts" we deserialize the full sections payload of every draft just to display a derived title. At 5 drafts that's fine. At 50 it'll feel slow. Two paths:

1. Promote `title` to a column on `newsletter_drafts` and update it on every save (read-cheap, write-cheap).
2. Add a server-side projection method to `LocalStorageBackend` that returns just specified columns.

Option 1 is simpler; option 2 generalizes better. Punt to Phase 8 alongside any list-density redesign.

## What the assistant panel will need from Phase 5

The right pane currently shows a static placeholder per section. To make it useful in Phase 5, the contract for each section will need:

- **The Read:** access to this week's digest articles + the seed/angle in the section state.
- **What's Moving:** a way to pick 4 articles from the digest + write them to `whats_moving.items` with `article_id` set.
- **Use Case Spotlight:** the picked POV record (already wired via POVPicker) + ability to generate from it.
- **Wins / Horizon:** access to the section's current text.

The compose store doesn't yet expose article fetching — `retail-store.ts` does. Phase 5 will likely have to either lift the digest fetch into a shared hook or import `useRetailStore` directly into the assistant panel. Worth deciding the wiring before writing the AI prompts.

## What's not yet enforced

A few constraints in the spec that the UI hints at but doesn't enforce:
- The Read 130-word hard cap — counter colors red but save still goes through.
- Use Case Spotlight 230-word cap — same.
- Wins / Horizon exactly 3 items — the editor always renders 3 inputs but doesn't reject other counts on save (e.g., a 4th could slip in via the API).
- Horizon "must be time-bound" — no validator.

These are soft constraints today, with the assumption that voice rules / verification in Phase 5 will catch them programmatically. If you want hard rejection at save-time, that's a Phase 5 decision worth flagging early.
