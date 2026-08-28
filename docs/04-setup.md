# Setup Guide

## Prerequisites

- Node.js 18+
- An OpenAI API key (optional — the app works without one via the local fallback optimizer, but you won't get AI-powered results or streaming)

## Install

```bash
npm install
```

## Configure environment variables

Copy the template and fill in your key:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | No | — | OpenAI API key. Without it, `/api/optimize*` returns a 500 and the frontend silently falls back to the local optimizer. |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model passed to the OpenAI Chat Completions API. |
| `PORT` | No | `8787` | Port the Express backend listens on. |

## Run

```bash
# Frontend + backend together (recommended)
npm run dev:all
```

This starts:
- Frontend at `http://localhost:5173`
- Backend at `http://localhost:8787`

Or run them separately in two terminals:

```bash
npm run dev      # frontend only
npm run server   # backend only
```

## Build

```bash
npm run build
```

Runs `tsc -b` (type-check) then `vite build`. Output goes to `dist/`.

## Preview a production build

```bash
npm run preview
```

## Lint

```bash
npm run lint
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Server configuration error: API key not configured" | `OPENAI_API_KEY` missing from `.env` | Add it, restart `npm run server` |
| "Invalid OpenAI API key" | Key wrong/revoked | Check `.env`, regenerate key on OpenAI dashboard |
| "Rate limit or quota reached" | OpenAI account rate-limited or out of quota | Check OpenAI billing/usage |
| Optimize button silently falls back to a lower-quality local result | Backend unreachable, or model returned invalid JSON | Check `npm run server` is running on the expected port; check server logs for `[server] /api/optimize error:` |
| CORS error in browser console | Frontend running on a non-localhost origin | `server.js` restricts CORS to `http://localhost(:port)?` — see [02-architecture.md](02-architecture.md) |
