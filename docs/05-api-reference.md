# API Reference

Backend base URL (dev): `http://localhost:8787`. Both endpoints require `OPENAI_API_KEY` to be set — without it, neither calls OpenAI: `/api/optimize` returns a `500`, and `/api/optimize/stream` reports the same failure as an `error` event (it flushes its SSE headers before validating, so its HTTP status is always `200`).

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
| `rawPrompt` | `string` | Yes | — | Validated by `validatePrompt` before anything else. Rejected with 400 if unusable — see [Input validation](#input-validation). |
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
| `400` | `{ "error": "...", "code": "...", "title": "..." }` | `rawPrompt` failed validation. See [Input validation](#input-validation) for the codes. |
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

`Content-Type: text/event-stream`, always with HTTP `200` — headers are flushed before validation runs, so every failure arrives as an `error` event rather than a status code. Events, in order:

| Event | Payload | Meaning |
|---|---|---|
| `start` | `{ "ok": true }` | Connection accepted, validation passed, about to call OpenAI. |
| `token` | `{ "text": "..." }` | Incremental chunk of the **optimized prompt text only** (not the full JSON — the server extracts the `"prompt"` field from the partial JSON stream as it grows). Zero or more of these. |
| `done` | Full parsed result — same shape as the `/api/optimize` 200 body (`taskType`, `prompt`, `assumptions`, `improvements`, `missingDetails`) | Terminal event on success. Connection closes after this. |
| `error` | `{ "error": "...", "code": "...", "title": "..." }` | Terminal event on failure. `code` and `title` are present for validation rejections only; other failures (no API key, OpenAI error, invalid model JSON) carry `error` alone. Connection closes after this. |

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

## Input validation

Both endpoints call `validatePrompt` from `src/lib/promptValidation.js` before anything else — before the `OPENAI_API_KEY` check, so a junk request never depends on server configuration to be rejected. The browser runs the same module on every keystroke, so in normal use the API never sees blocked input; these responses exist for direct callers and as a backstop.

Rejected with `400` (or a terminal SSE `error` event):

| `code` | Meaning |
|---|---|
| `empty` | Missing, empty, or whitespace only |
| `too-short` | Under three characters — `"A"` |
| `no-letters` | Only symbols or digits — `"#$%^&&&^%"` |
| `emoji-only` | Pictographs and nothing else — `"😀😀🎉"` |
| `math-expression` | Arithmetic only — `"45*3"` |
| `gibberish` | No token resembles a word — `"asdfghjkl"` |
| `repeated-spam` | One or two words repeated — `"test test test test"` |
| `greeting` | Entirely filler — `"HI"`, `"hello"`, `"thanks"` |
| `small-talk` | Conversation, not a task — `"hi, how are you"` |
| `identity-question` | Asks what the tool is — `"who are you"` |
| `capability-question` | Asks what the tool does — `"what can you do"`, `"help"` |
| `emotional-statement` | A feeling with no request — `"i'm bored"` |
| `app-command` | A UI action typed as text — `"clear"`, `"undo"` |
| `meta-request` | Asks to optimize, with nothing supplied — `"optimize this"` |
| `placeholder-echo` | The textarea placeholder submitted verbatim |
| `url-only` | The whole input is a link |
| `prompt-injection` | Instructions aimed at the optimizer itself, at the start of the input or of a sentence |

Accepted, but handled specially:

| `code` | Behaviour |
|---|---|
| `no-topic`, `bare-entity`, `dangling-reference` | Pass through. The user message gains `NO_TOPIC_DIRECTIVE`, which forbids the model from inventing a subject and requires `[USER INSERTS: ...]` tokens plus an entry in `missingDetails`. Reaching the API with one of these means the user explicitly chose *Optimize anyway*. |
| `declarative`, `trivial-question`, `multi-task`, `already-optimized`, `too-long` | Pass through unmodified. These warn in the UI because optimizing them adds little, not because the model would fabricate. |
| `mode-mismatch` | Never enforced server-side — it is a client-side suggestion, and arriving here means the user saw it and kept their selection. |

```bash
curl -X POST http://localhost:8787/api/optimize \
  -H "Content-Type: application/json" \
  -d '{"rawPrompt":"#$%^&"}'
# 400
# {"error":"This input is only symbols or numbers. Describe the task in words, ...",
#  "code":"no-letters","title":"No readable request found"}
```

## Shared types

Request/response shapes reference these TypeScript types, defined in `src/lib/types.ts`:

- `UseCase`, `Tone`, `OutputFormat` — input enums.
- `OptimizedResult` — the frontend's full result object (backend response + client-computed `score`/`scoreBreakdown`/`afterScore`/`afterScoreBreakdown`).
