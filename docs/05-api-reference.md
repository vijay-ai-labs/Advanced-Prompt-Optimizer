# API Reference

Backend base URL (dev): `http://localhost:8787`. Both endpoints require `OPENAI_API_KEY` to be set — without it, both return a 500 before calling OpenAI.

## POST /api/optimize

Non-streaming. Returns the full optimized result as a single JSON response once the model finishes.

### Request body

```json
{
  "rawPrompt": "write a blog post about coffee",
  "useCase": "general",
  "tone": "clear",
  "outputFormat": "paragraph"
}
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `rawPrompt` | `string` | Yes | — | Rejected with 400 if empty/whitespace. |
| `useCase` | `UseCase` | No | `"general"` | One of `general`, `writing`, `coding`, `marketing`, `research`, `image-generation`, `business`, `gtm`. When `"general"`, the server auto-detects the task type from prompt content. |
| `tone` | `Tone` | No | `"clear"` | `clear`, `professional`, `friendly`, `persuasive`, `technical`. |
| `outputFormat` | `OutputFormat` | No | `"paragraph"` | `paragraph`, `bullet-list`, `step-by-step`, `json`. |

### Success response — `200`

```json
{
  "taskType": "blog-content",
  "prompt": "Act as an experienced content writer...",
  "assumptions": ["Assumed a general consumer audience since none was specified."],
  "improvements": ["Added target audience and tone.", "Specified output length and structure."],
  "missingDetails": ["Preferred word count was not specified."]
}
```

Note: this endpoint does **not** return `score`/`scoreBreakdown` — scoring is computed client-side by `analyzePrompt`/`computeScore` in `src/lib/optimizer.ts` so it stays consistent between the raw and optimized prompt. See [02-architecture.md](02-architecture.md#design-decisions-worth-knowing).

### Error responses

| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "rawPrompt is required and cannot be empty." }` | Missing/empty `rawPrompt`. |
| `401` | `{ "error": "Invalid OpenAI API key. Check OPENAI_API_KEY in .env." }` | OpenAI rejected the key. |
| `429` | `{ "error": "Rate limit or quota reached. Check your OpenAI billing." }` | OpenAI rate limit or quota exceeded. |
| `500` | `{ "error": "Server configuration error: API key not configured." }` | `OPENAI_API_KEY` not set. |
| `500` | `{ "error": "Optimization failed. Please try again." }` | Any other OpenAI/network error. |
| `502` | `{ "error": "Model returned invalid JSON. Please try again." }` | Model output failed JSON parse/validation. |

## POST /api/optimize/stream

Streaming variant using Server-Sent Events. Same request body as `/api/optimize`. The connection stays open and emits a sequence of named events; the frontend reference implementation is `handleOptimize()` in `src/App.tsx`.

### Request body

Identical to [`/api/optimize`](#request-body) above.

### Response

`Content-Type: text/event-stream`. Events, in order:

| Event | Payload | Meaning |
|---|---|---|
| `start` | `{ "ok": true }` | Connection accepted, validation passed, about to call OpenAI. |
| `token` | `{ "text": "..." }` | Incremental chunk of the **optimized prompt text only** (not the full JSON — the server extracts the `"prompt"` field from the partial JSON stream as it grows). Zero or more of these. |
| `done` | Full parsed result — same shape as the `/api/optimize` 200 body (`taskType`, `prompt`, `assumptions`, `improvements`, `missingDetails`) | Terminal event on success. Connection closes after this. |
| `error` | `{ "error": "..." }` | Terminal event on failure (empty prompt, no API key, OpenAI error, or invalid JSON from the model). Connection closes after this. |

If the connection drops or errors before a `done` event arrives, the frontend fallback is to catch the failure and call `generateLocalOutput()` — see [02-architecture.md](02-architecture.md#fallback-path).

### Example client handling (simplified)

```ts
const res = await fetch('/api/optimize/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rawPrompt, useCase, tone, outputFormat }),
})
const reader = res.body.getReader()
// parse `event: <name>\ndata: <json>\n\n` frames, handle token/done/error
```

See `src/App.tsx` for the full SSE parsing loop, including buffering partial lines across chunk boundaries.

## Shared types

Request/response shapes reference these TypeScript types, defined in `src/lib/types.ts`:

- `UseCase`, `Tone`, `OutputFormat` — input enums.
- `OptimizedResult` — the frontend's full result object (backend response + client-computed `score`/`scoreBreakdown`/`afterScore`/`afterScoreBreakdown`).
