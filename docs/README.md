# Advanced Prompt Optimizer — Documentation

This folder is the single source of truth for anyone joining, reviewing, or reusing this project. Read them in order if you're new, or jump straight to what you need.

| Doc | Purpose | Best for |
|---|---|---|
| [01-overview.md](01-overview.md) | What the product does, who it's for, feature list | First-time readers, non-technical reviewers |
| [02-architecture.md](02-architecture.md) | System diagram, data flow, tech stack, key files | Understanding how it's built |
| [03-sdlc.md](03-sdlc.md) | Generic software development lifecycle + how it was applied here | Learning the process, or repeating it on a new project |
| [04-setup.md](04-setup.md) | Install, configure, run, build, troubleshoot | Getting the app running locally |
| [05-api-reference.md](05-api-reference.md) | Backend REST/SSE endpoints, request/response shapes | Integrating with or extending the backend |
| [06-handoff.md](06-handoff.md) | Repo tour, conventions, gotchas, roadmap | Anyone taking over or contributing to the code |

## Quick orientation

- **What it is**: a web app that turns a rough AI prompt into a structured, model-ready prompt, with before/after quality scoring.
- **Stack**: React 19 + TypeScript + Vite (frontend), Express + OpenAI API (backend), Tailwind CSS.
- **Status**: functional, actively developed, no auth/database/deployment (see [Constraints](06-handoff.md#constraints--non-goals)).

If you were handed this project and only have five minutes, read [01-overview.md](01-overview.md) and [04-setup.md](04-setup.md), then skim [06-handoff.md](06-handoff.md).
