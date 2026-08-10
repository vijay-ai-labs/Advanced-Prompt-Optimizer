# Handoff Guide

For a developer picking this project up for the first time — either taking over maintenance or reviewing it before contributing.

## Start here

1. Read [01-overview.md](01-overview.md) (2 min) and [02-architecture.md](02-architecture.md) (5 min).
2. Follow [04-setup.md](04-setup.md) to get it running locally.
3. Try the golden path: enter a vague prompt, hit Optimize, watch it stream, check the score improved.
4. Pull the network cable (or stop `npm run server`) and try again — confirm the local fallback kicks in without an error toast. That silent-fallback behavior is intentional, not a bug — see [02-architecture.md](02-architecture.md#fallback-path).

## Repo tour

```
├── server.js              # Express backend — entire API surface lives in this one file
├── src/
│   ├── App.tsx             # top-level state + orchestration (start here on the frontend)
│   ├── components/         # Header, InputPanel, OutputPanel, HistoryDrawer
│   └── lib/
│       ├── types.ts         # all shared TS types
│       ├── optimizer.ts     # scoring + local fallback generator
│       └── savedPrompts.ts  # localStorage read/write
├── .env / .env.example     # OPENAI_API_KEY, OPENAI_MODEL, PORT
└── docs/                   # you are here
```

## Conventions to follow

- **No new backend files** unless the API surface genuinely grows — `server.js` is intentionally a single file for a two-endpoint API. If it starts exceeding ~1000 lines or gains a third concern, that's the signal to split it.
- **Scoring always runs client-side**, never ask the model to self-grade. Keep `analyzePrompt`/`computeScore` as the single source of truth for both raw and optimized scores.
- **Every use case needs a local `build*` fallback** in `optimizer.ts` — if you add a 9th use case, add both the AI-side system prompt handling in `server.js` and a deterministic `buildX()` fallback, or the app breaks when OpenAI is unreachable for that use case.
- **Types first.** Add/change shapes in `src/lib/types.ts` before wiring up UI or backend — both sides import from there.

## Known gotchas

- `OptimizedResult.taskType` is computed by both the backend and the local optimizer, and drives scoring math (`computeScore`/`computeScoreBreakdown` in `optimizer.ts` branch on it for `image-generation` and `research-analysis`), but it is **not rendered anywhere in the UI** — no badge, no label. If you're asked to "show the detected task type to the user," the data is already there in `result.taskType`; it just needs a UI element.
- The streaming endpoint extracts the `prompt` field from **partial** JSON using regex (`server.js`, `PROMPT_RE`/`PROMPT_PARTIAL_RE`). If you change the JSON schema the model returns (e.g., rename `"prompt"`), update these regexes or streaming breaks silently (it'll just show no partial text until `done`).
- `handleRestoreSaved()` in `App.tsx` recomputes `afterScore` from the saved optimized text but does **not** restore `improvements`/`missingDetails`/`scoreBreakdown` (they're set to empty arrays) — this is a known gap, not a bug you're missing something about. If you need full fidelity on restore, those fields would need to be included in `SavedPrompt`.
- CORS in `server.js` is regex-restricted to `localhost`. It's not actually exercised in normal dev use — `vite.config.ts` proxies `/api/*` to `:8787` so the browser never makes a cross-origin request. It only matters if you call the backend directly (curl/Postman) or deploy frontend and backend to different origins without a reverse proxy; in the latter case, update the CORS origin *and* remember there's no Vite proxy in a production build, so relative `/api/*` calls will fail unless both are served from the same origin.
- `HistoryDrawer.tsx` still uses the original fuchsia/sky glassmorphic theme (gradient title text, fuchsia badges/icons) — it wasn't repainted during the V2 slate/indigo redesign that touched `Header`, `InputPanel`, and `OutputPanel`. Not a bug, just inconsistent; worth knowing before you assume the whole app shares one palette.

## Constraints / non-goals

These were deliberate scope decisions, not oversights:

- **No login/auth** — single-user tool, no need to gate access.
- **No database** — saved prompts live in `localStorage` only; clearing browser storage loses them. Don't add a backend persistence layer without discussing whether that changes the product's shape (multi-device sync, accounts, etc.).
- **No deployment configured** — see [03-sdlc.md](03-sdlc.md#part-2--how-this-project-followed-that-procedure) for why this phase was intentionally deferred, and [04-setup.md](04-setup.md#build) for the build command when it's time.

## Roadmap / natural next steps

Not committed to, but the logical next increments if the project continues:

- Persist saved prompts server-side (would require introducing a database and reopening the "no database" decision above).
- Add automated tests for `optimizer.ts` scoring logic — it's pure and deterministic, making it the highest-value target for unit tests in this codebase.
- Deploy frontend (Vercel/Netlify) + backend (Railway/Render/Fly.io) per [04-setup.md](04-setup.md).

## Who to ask

This is currently a single-developer project. See the repo's `git log` and commit history for prior context on specific changes; there's no separate issue tracker or chat channel at this stage.
