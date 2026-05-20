# Phase 2 Notes — Navigation Restructure + Storage Abstraction

Items observed during Phase 2 that fell outside scope. Not fixed in this phase. Triage in Phase 3 planning.

## Pre-existing TypeScript errors (unrelated to Phase 2)

`npx tsc -b --noEmit` surfaces issues in files I did not touch:

- `src/spaces/finance/pages/forecast.tsx`
  - `'LineChart'` imported but unused (TS6133).
  - `'formatTime'` declared but unused (TS6133).
  - Passes `collapsed` prop to `TopHeader`, but `TopHeaderProps` has no `collapsed` field (TS2339, TS2322).
- `src/spaces/finance/pages/roadmap.tsx`
  - Two inline style objects use non-standard CSS prop `ringColor` (TS2322 at lines 140, 189).
- `src/spaces/finance/pages/trading-agents.tsx`
  - `'AlertCircle'` imported but unused.
- `src/spaces/labs/pages/workshop.tsx`
  - `'Pencil'` import + `'agents'` local both unused.

These are pre-existing. Vite is permissive and runs the app fine despite them. Recommend either tightening tsconfig `noUnusedLocals`/`noUnusedParameters` enforcement at build time, or sweeping these up in a dedicated TS hygiene PR.

## Documentation drift

- `README.md` line 51 claims `Charts: Recharts + TradingView Lightweight Charts`. TradingView Lightweight Charts is not installed and not referenced anywhere. Inaccurate.
- `README.md` line 40 says the Vault accepts `XLSX`. `routers/vault.py:21` `ALLOWED_EXTENSIONS` does not include `xlsx` (although `openpyxl` is in `requirements.txt`).
- `README.md` line 33 references a `SOUL.md personality editor` for OpenClaw. There is no SOUL.md feature in the current codebase.
- `README.md` line 40 says vault chat uses `ChromaDB`. The interface is `Mem0` (ChromaDB sits underneath). Technically accurate but misleading.

Recommend fixing the README before sharing this repo as context to anyone (human or AI).

## Backend reload quirk

During Phase 2 the uvicorn dev server appeared to silently exit after a stretch of edits + a `pip install pytest pytest-asyncio` step. Restarting it cleanly fixed it. No traceback in the log. Worth keeping an eye on whether the uvicorn watcher trips on schema/sql file writes; if it does, we can scope `--reload-include`/`--reload-exclude`.

## Storage abstraction edges to handle in Phase 3+

- The schema in `services/storage/schema.sql` has typed columns. `LocalStorageBackend` maps dict keys to columns dynamically. Two things to confirm when Phase 3 (POV CRUD) lands:
  1. Date columns are TEXT (ISO-8601). No automatic timezone normalization in the storage layer. Callers must produce timezone-aware ISO strings.
  2. `INSERT OR REPLACE` is full-row replace. Partial updates require read-modify-write at the caller.
- No `list` filtering beyond id-prefix. POV/Voice screens will probably want `section_type=...` and `tags contains ...` filters. Plan: add an optional `filters: dict` argument to `list` in a future iteration.
- `cloud.py` is a stub — every method raises `NotImplementedError`. The factory in `__init__.py` always returns `LocalStorageBackend`. When Phase 8/9 swaps in cloud, the only switch is in `get_storage()` and an env flag.

## Retail Sources page

Moved verbatim to `frontend/src/shared/pages/sources.tsx`. The component is still exported as `RetailSources` (we import as `Sources` in `App.tsx`). Two possible follow-ups when Phase 3 has room:

1. Rename the export to `Sources` for clarity.
2. The page header still reads "Sources · Retail" — consider repositioning it as a global Settings sub-page in copy.

## Use Case Sparks

`/retail/sparks` still routes to the existing `RetailSparks` component. The component is unlinked from the navigation. Two paths in Phase 3:

1. Repurpose Sparks as part of the POV pipeline (use Spark → POV draft).
2. Sunset and delete the file + store usage.

## Vite reload caveat

Confirm in the browser that the moved page imports resolve cleanly after a full reload (Ctrl+Shift+R). Vite caches module graphs aggressively, and the relative imports in the moved pages didn't change paths (still `../stores/...`), but the cached graph still references the old location. A hard reload clears it.

## Anthropic model naming

The Anthropic provider list was previously
`[claude-sonnet-4-6, claude-opus-4-6, claude-sonnet-4-5, claude-opus-4-5, claude-haiku-4-5]`.
Phase 2 trimmed it per spec to
`[claude-opus-4-7, claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5]`.

Users who saved `claude-sonnet-4-5` or `claude-opus-4-5` in their `user_settings.json` will keep those values (the merge logic in `services/llm.py:get_user_settings` doesn't validate against the list), but the dropdown will not display their saved value, which can be confusing. Phase 3 should add list-validation on save and a one-time silent migration: if the saved model is not in the current list, fall back to `claude-opus-4-7`.
