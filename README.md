# Advanced Prompt Optimizer

Transform rough AI prompts into structured, model-ready prompts with scoring, streaming output, and domain-aware optimization.

## Features

- **AI-powered optimization** — GPT-4o-mini rewrites prompts using task-specific frameworks
- **Local fallback** — works without an API key using the built-in rule-based optimizer
- **Streaming output** — token-by-token streaming via SSE
- **Prompt scoring** — before/after quality score with 5-dimension breakdown
- **8 use cases** — General, Writing, Coding, Marketing, Research, Business, Image Generation, GTM Strategy
- **History & saved prompts** — session history with undo; persist favorites to localStorage

## Tech Stack

- **Frontend** — React 19, TypeScript, Tailwind CSS, Vite
- **Backend** — Express (Node.js), OpenAI API (streaming)

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key (optional — app works without it via local optimizer)

### Setup

```bash
# Install dependencies
npm install

# Copy env template and add your key
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=your_key_here
```

### Run

```bash
# Frontend + backend together
npm run dev:all

# Or separately
npm run dev        # frontend at http://localhost:5173
npm run server     # backend at http://localhost:8787
```

### Build

```bash
npm run build
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | No | — | OpenAI API key for AI-powered optimization |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model to use |
| `PORT` | No | `8787` | Backend server port |

## Deployment

The frontend is a static Vite build and can be hosted on GitHub Pages, Vercel, or Netlify.

The backend (`server.js`) requires a Node.js host (Railway, Render, Fly.io, etc.) with `OPENAI_API_KEY` set as an environment variable.

For frontend-only deployment, the app falls back to the local rule-based optimizer automatically when the API is unreachable.
