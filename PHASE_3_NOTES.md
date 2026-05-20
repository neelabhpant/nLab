# Phase 3 Notes — POV Library

Items I observed during the POV Library build that fell outside scope. Not fixed in this phase. Triage in Phase 4 planning.

## Auth and the seed endpoint

`POST /api/v1/pov-library/seed` is described in the prompt as "admin-only", but nLab has no admin role today — every authenticated, allowlisted user is effectively an admin. The endpoint inherits the global JWT-required gate from `app/main.py:auth_middleware`. That's the right v1 treatment for a single-user tool, but worth flagging:

- A v2 deployment with multiple Cloudera users behind it needs a real `role`/`is_admin` field on the JWT payload (currently the token carries `sub, email, name, picture`).
- Until then, the seed endpoint can be triggered by anyone with a valid login. For Neelabh's use case that's fine; for any wider distribution it isn't.

## Backend logging is silent at startup

Uvicorn's default config only surfaces its own `INFO:` access logs. Application-level `logger.info(...)` and `logger.warning(...)` from main.py never appear on stdout. I noticed this when my POV seed log "Seeding POV library from pov_library_seed.json: N loaded" didn't show up — even though the seed actually ran. Same is true of the existing `logger.info("Vault initialized")` line.

Recommendation: add a small `logging.basicConfig(level=logging.INFO)` in `main.py` (or a `logging.yaml`) so startup steps and exceptions are visible. Trivial change; left out of this phase per the "stay in scope" rule.

## Storage layer ergonomics surfaced

Things I bumped into while building POV CRUD:

1. **No partial update.** `LocalStorageBackend.put` does `INSERT OR REPLACE`, which is full-row. The service has to read-modify-write to preserve unmodified fields. Acceptable for v1, but every CRUD service we add will repeat this pattern. Worth a `merge(table, key, patch)` method on the storage interface in a future phase.
2. **No richer filter.** `list(table, prefix=None)` only filters by id prefix. POV filters by `tag` and `target_accounts` are done in Python after a full `list()`. Fine at 6 rows; not at 600. When we hit that, push the filter into SQLite with `json_each()` or a small inverted index.
3. **No bulk operations.** Seeding 6 POVs makes 6 round-trips to SQLite. Cheap, but if we ever import a large CSV of past wins or articles, we want `put_many`.

None of these block Phase 4. Logged so we don't re-discover them.

## Screenshot storage convention

I'm storing the **relative** path (`pov_screenshots/{pov_id}.{ext}`) in the `demo_screenshot_path` column. The storage layer resolves it to an absolute filesystem path on read (v1) or will resolve to a signed S3 URL (v2). This is the right shape for the cloud migration — feature code never sees an absolute path.

One small wrinkle: the seed data ships `demo_screenshot_path: null` for all 6 POVs. So the detail-page placeholder ("No screenshot") will be visible for everything until Neelabh uploads images.

## Image serving uses `?token=`

`<img>` tags can't set Authorization headers, so the screenshot serving route accepts the JWT via `?token=` (same pattern as the SSE endpoints). The store exposes `povScreenshotUrl(povId)` helper. If we ever move to httpOnly cookie auth, this disappears — until then it's the cleanest option.

## Frontend client-side filtering

The list page does search + tag filtering entirely client-side after one `fetchPOVs()` call. The backend supports `?tag=X&account=X` query params (per the prompt), and I'm using them in `fetchPOVs(filters)`. But the list page uses local state for the chip selection — switching to URL-driven query params would let people share filter links. Left for a future visual-polish pass.

## Tag chips in list page

The Tag chip filter only shows tags that exist in the *current* POV set, not a canonical taxonomy. That's the right call for a hand-curated library — but it means a freshly created POV with novel tags can change the chip set on the next load. Worth a note when we wire a "global tags" view.

## TopHeader prop drift

Phase 2 already noted that `forecast.tsx` passes a non-existent `collapsed` prop to `TopHeader`. That's still there; my new pages just don't repeat the mistake. Bundled cleanup recommended.

## Pre-existing TypeScript noise

Same set as Phase 2 — `forecast.tsx`, `roadmap.tsx`, `trading-agents.tsx`, `workshop.tsx`. My new files (`pov-library.tsx`, `pov-detail.tsx`, `pov-editor.tsx`, `pov-store.ts`) are clean. The remaining errors are pre-existing.

## Seed file IDs

The seed file uses stable, semantic IDs (`pov-new-item-evaluation`, `pov-retail-visual-intelligence`, etc.) — not UUIDs. The service uses `pov-{12 hex chars}` for any POV created via the editor. This split is fine, but it means the IDs are visually inconsistent across seeded vs. user-created POVs. Not user-visible unless someone copies a URL. Worth a future decision: keep seeded IDs as-is for stability, or normalise to UUIDs on first edit.

## What would break if cloud were turned on tomorrow

Nothing in the POV path. Every persistence call goes through `get_storage()`. `cloud.py` is still a stub. The day we implement it, the only changes are inside `services/storage/`.
