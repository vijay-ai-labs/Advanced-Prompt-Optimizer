# Project Overview

## What it is

Advanced Prompt Optimizer is a web app that transforms a rough, underspecified AI prompt into a structured, model-ready prompt. It scores the prompt before and after optimization, explains what it changed, and flags assumptions it made or details still missing.

## Why it exists

Most people write prompts as short, ambiguous requests ("write a blog post about coffee"). LLMs produce noticeably better output when the prompt specifies role, audience, format, tone, constraints, and success criteria. This tool automates that rewriting step, using task-aware templates so a coding prompt is optimized differently from a marketing prompt or an image-generation prompt.

## Who it's for

- Anyone who prompts LLMs regularly and wants consistently better output without memorizing prompt-engineering frameworks.
- Developers/teams standardizing prompt quality across a product that uses LLMs.

## Core features

- **AI-powered optimization** — GPT-4o-mini rewrites the prompt using a task-specific framework, selected automatically from prompt content or an explicit use-case dropdown.
- **Local fallback** — a deterministic, rule-based optimizer (`src/lib/optimizer.ts`) runs entirely client-side if there's no API key or the backend call fails, so the app degrades gracefully instead of breaking.
- **Streaming output** — the optimized prompt streams in token-by-token over Server-Sent Events (SSE), rather than waiting for the full response.
- **Before/after scoring** — a 5-dimension quality score (Clarity, Specificity, Structure, Constraints, Output Format — see `computeScoreBreakdown` in `src/lib/optimizer.ts`) computed for both the raw and optimized prompt.
- **Task-type detection** — auto-detects task type (blog-content, coding, research-analysis, business-strategy, gtm-strategy, image-generation, general), used internally to select the scoring rubric (`computeScore`/`computeScoreBreakdown` branch on it for `image-generation` and `research-analysis`); labeled assumptions the model made are shown to the user in an "Assumptions made" panel. Note: `taskType` itself is not currently displayed anywhere in the UI — see [06-handoff.md](06-handoff.md#known-gotchas).
- **8 use cases** — General (auto-detect), Blog/Content, Coding, Marketing, Research, Business, Image Generation, GTM Strategy.
- **History & saved prompts** — last 5 optimizations kept in session history with undo; favorites persist to `localStorage` across sessions.
- **Feedback controls** — thumbs up/down rating and a flag control per result, stored alongside saved prompts.

## What it is not

No login/auth, no database/server-side persistence, no hosted deployment. See [06-handoff.md](06-handoff.md#constraints--non-goals) for the full list and rationale.

## Where to go next

- New to the codebase → [02-architecture.md](02-architecture.md)
- Want to run it → [04-setup.md](04-setup.md)
- Taking over the project → [06-handoff.md](06-handoff.md)
