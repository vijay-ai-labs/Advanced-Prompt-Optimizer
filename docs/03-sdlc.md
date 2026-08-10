# Software Development Lifecycle (SDLC)

This doc has two parts: (1) a general procedure any software engineer follows when starting a project, and (2) how that procedure actually played out building this one — so you can see the theory applied, not just stated.

## Part 1 — General procedure

Most professional software work moves through these phases, whether the project is a solo side app or a team product. The names vary by methodology (Waterfall, Agile/Scrum, Kanban), but the underlying steps are the same:

### 1. Requirements / idea definition
Define the problem before the solution. What does the user need? What's in scope, what's explicitly out of scope? Write it down — even a few sentences — so scope doesn't silently drift later.

### 2. Design / planning
Choose the architecture and tech stack. Decide: frontend framework, backend needs (or none), data storage, third-party APIs, deployment target. Sketch the data flow. Identify the riskiest unknown and plan to resolve it early (e.g., "can we actually stream tokens from OpenAI through Express?").

### 3. Environment setup / scaffolding
Set up the repo, package manager, linter, build tool, and a "hello world" that runs. Get the dev loop fast before writing real features — a slow or broken dev loop compounds pain across the whole project.

### 4. Implementation (iterative)
Build in vertical slices — a thin, end-to-end version of one feature — rather than horizontal layers. Ship the ugliest version that proves the concept, then improve it. Commit in small, reviewable increments.

### 5. Testing
Verify behavior as you go, not just at the end: manual testing of the golden path and edge cases, and automated tests where the logic is non-trivial (scoring, parsing, business rules). Bugs found close to when they're introduced are far cheaper to fix.

### 6. Review / refinement
Revisit UX, error handling, and edge cases once the core works. This is where "make it correct" becomes "make it good" — polish, empty states, loading states, failure states.

### 7. Deployment (if applicable)
Ship it somewhere real users or reviewers can reach it. Even if deployment is out of scope, decide that deliberately (see [Constraints](06-handoff.md#constraints--non-goals)) rather than by default.

### 8. Maintenance / iteration
Real usage surfaces what the design missed. Treat this as a normal, expected phase — not a sign the first version was wrong.

## Part 2 — How this project followed that procedure

| SDLC phase | What happened in this repo |
|---|---|
| 1. Requirements | Idea: a tool that rewrites vague prompts into structured, model-ready prompts, with visible scoring so the improvement is provable, not just claimed. |
| 2. Design | Chose React + TypeScript + Vite for a fast frontend dev loop, Express as a thin backend whose only job is to hold the API key and proxy OpenAI calls, and a local rule-based optimizer as a zero-dependency fallback. Decided early: no login, no database — keep it a single-purpose tool, not a platform. |
| 3. Setup | **Step 1**: Vite scaffold, Tailwind, lucide-react, placeholder screen — proved the toolchain worked before any real logic existed. |
| 4. Implementation | Built iteratively, one vertical slice at a time: **Step 2** the split-panel optimizer UI (input/output), **Step 3** the deterministic local optimizer so the UI had something real to show without needing a backend yet, **Step 5** the Express backend wired to OpenAI, **Step 6** SSE streaming plus saved prompts, rating, and output stats. Each step was runnable end-to-end before the next began. |
| 5. Testing | Manual testing of the golden path (optimize a prompt, see score improve) and fallback path (AI unreachable → local optimizer silently takes over) at each step; `npm run lint` (ESLint + typescript-eslint) enforced type and style correctness continuously. |
| 6. Review/refinement | **Step 4**: UX polish pass — animated score bar, diff/changes tab, word counter, Ctrl+Enter shortcut, history drawer. **V2 upgrade**: task-aware backend system prompt (auto-detects task type, applies task-specific templates, returns labeled assumptions), a new slate/indigo visual design applied to `Header`, `InputPanel`, and `OutputPanel`, assumptions panel added to the UI (task type is computed but not currently surfaced visually). Note: `HistoryDrawer.tsx` was not part of this repaint and still carries the original fuchsia/sky glassmorphic theme — see [06-handoff.md](06-handoff.md#known-gotchas). |
| 7. Deployment | Deliberately out of scope for now — frontend is a static Vite build (deployable to Vercel/Netlify/GitHub Pages) and the backend is a standard Node/Express app (deployable to Railway/Render/Fly.io), but no hosting has been set up. See [04-setup.md](04-setup.md#build) for the build command when this becomes needed. |
| 8. Maintenance | Ongoing — this docs set itself is part of that phase: capturing decisions before they're forgotten, so the next iteration (or the next engineer) doesn't have to reverse-engineer them from code. |

## Why this matters when starting your own project

The pattern worth copying isn't the tech stack — it's the **sequencing**: prove the toolchain works (Step 1) before building features, get one thin end-to-end slice working (Step 2-3) before adding breadth, and treat polish (Step 4, V2) as its own deliberate pass rather than something bolted on mid-feature. Skipping straight to "build everything" without a runnable Step 1 is the most common way small projects stall.
