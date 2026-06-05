import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

const app = express()
const PORT = process.env.PORT || 8787
const API_KEY = process.env.OPENAI_API_KEY
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

app.use(cors({ origin: /^http:\/\/localhost(:\d+)?$/ }))
app.use(express.json())

const USE_CASE_GUIDANCE = {
  general:
    'General-purpose assistance. Optimize for clarity, structure, and completeness.',
  writing:
    'Writing (articles, essays, stories, blogs). Optimize for voice, engagement, and narrative structure.',
  coding:
    'Programming and software development. Optimize for technical precision, correctness, and best practices.',
  marketing:
    'Marketing and copywriting. Optimize for persuasion, audience targeting, and calls-to-action.',
  research:
    'Research and analysis. Optimize for depth, objectivity, source credibility, and organized findings.',
  'image-generation':
    'AI image generation. Convert to structured visual fields instead of prose.',
  business:
    'Business context (strategy, operations, planning, decision-making, reports, stakeholder communication). Optimize for professional framing, actionability, and measurable outcomes.',
  gtm:
    'Go-to-market strategy for B2B SaaS. Apply the full GTM framework: ICP, positioning, channels, sales motion, pricing, roadmap, and metrics.',
}

const TONE_GUIDANCE = {
  clear: 'Clear, direct, and concise language.',
  professional: 'Formal, authoritative, and professional language.',
  friendly: 'Warm, conversational, and approachable language.',
  persuasive: 'Compelling and motivating language that drives action.',
  technical: 'Precise technical terminology for domain experts.',
}

const FORMAT_GUIDANCE = {
  paragraph: 'Paragraph-based prose response.',
  'bullet-list': 'Bullet-point list format.',
  'step-by-step': 'Numbered step-by-step instructions.',
  json: 'Structured JSON response.',
}

const WEAKNESS_PATTERNS = {
  audience: /\b(for|audience|reader|user|customer|stakeholder|beginner|expert|developer|student|executive|team)\b/i,
  constraints: /\b(must|should|avoid|include|exclude|only|without|limit|constraint|require|do not|don't|maximum|minimum)\b/i,
  format: /\b(format|json|table|bullet|list|paragraph|step.by.step|markdown|outline|sections?)\b/i,
  role: /\b(act as|you are|expert|senior|specialist|consultant|engineer|writer|analyst|strategist|designer)\b/i,
  success: /\b(success|criteria|goal|objective|measure|metric|definition of done|acceptance)\b/i,
  vague: /\b(something|stuff|things|good|nice|better|awesome|cool|whatever|kind of|sort of)\b/i,
}

const TASK_TYPES = new Set([
  'blog-content',
  'coding',
  'research-analysis',
  'business-strategy',
  'gtm-strategy',
  'image-generation',
  'general',
])

const GTM_DETECT_RE = /\b(go.to.market|go-to-market|gtm|g2m|market.entr(y|ies)|market.launch|launch.strateg|customer.acquisition|ideal.customer.profile|ICP\b|sales.motion|product.led.growth|PLG\b|pricing.strateg|revenue.strateg|pipeline.generat|B2B.SaaS.*(strateg|launch|grow|enter)|SaaS.*(go.to.market|gtm|market.entry)|demand.gen(eration)?|sales.playbook|account.based.market|ABM\b|value.proposition.*SaaS|positioning.*SaaS|SaaS.*positioning)\b/i

function isGTMPrompt(rawPrompt) {
  return GTM_DETECT_RE.test(rawPrompt ?? '')
}

function getPromptWeaknessHints(rawPrompt) {
  const prompt = rawPrompt ?? ''
  const hints = []

  if (!WEAKNESS_PATTERNS.role.test(prompt)) hints.push('No explicit expert role or perspective')
  if (!WEAKNESS_PATTERNS.audience.test(prompt)) hints.push('Target audience is unclear')
  if (!WEAKNESS_PATTERNS.constraints.test(prompt)) hints.push('Constraints, must-haves, or exclusions are missing')
  if (!WEAKNESS_PATTERNS.format.test(prompt)) hints.push('Desired response structure is not specified')
  if (!WEAKNESS_PATTERNS.success.test(prompt)) hints.push('Success criteria or quality bar is missing')
  if (WEAKNESS_PATTERNS.vague.test(prompt)) hints.push('Contains vague language that should be made concrete')
  if (prompt.trim().split(/\s+/).filter(Boolean).length < 8) hints.push('Very short prompt with low task detail')

  return hints
}

function buildGTMSystemPrompt() {
  return `You are a world-class prompt architect and senior B2B SaaS go-to-market strategist. Your sole job: transform rough GTM-related user intent into an advanced, model-ready prompt that produces structured, opinionated, execution-ready GTM outputs.

## Identity & Mission

You do NOT produce a GTM strategy. You OUTPUT an optimized prompt that another AI model will execute.

The optimized prompt must be:
- Structured with labeled expert sections
- Specific enough that the AI receiving it produces decisive, prioritized, measurable recommendations
- Immediately copy-pasteable into any AI model

## Step 1 — Extract & Preserve Intent

Infer business context and fill gaps with labeled assumptions ("Assumed:"). Never distort what the user wants.
Dimensions to resolve: target segment (SMB/mid-market/enterprise), buyer personas, product category, objective (launch/pipeline/growth/expansion), constraints (budget/team/timeline/geography).

## Step 2 — Build the Optimized Prompt Structure

Use all relevant sections from this template. Skip sections that genuinely don't apply.

**Role** — expert persona (senior GTM strategist, B2B SaaS specialist, domain-specific)
**Objective** — precise goal with measurable outcome
**Context** — product, stage, team, budget, existing traction
**ICP & Segmentation** — firmographics, pain points, buying triggers, exclusion criteria
**Positioning** — core problem solved, differentiated value prop, named competitor alternatives
**Channel Mix** — ranked by ROI with explicit rationale for each
**Sales Motion** — PLG vs. sales-led vs. hybrid; funnel shape; qualification criteria
**Execution Roadmap** — 30/60/90-day phases with owners and measurable milestones
**KPIs** — pipeline, CAC, conversion rates, time-to-revenue, expansion metrics
**Risks & Tradeoffs** — what must be true, what could fail, strategic compromises
**Output Format** — exact format for the AI to follow (headers, tables, bullets, decision rationale)
**Quality Criteria** — what makes the output decision-ready (prioritized, opinionated, connected to business outcomes)

## Step 3 — Optimization Rules

REQUIRED:
- Preserve the user's exact intent — do not change goals, scope, or product category
- Force prioritization — weight pillars by objective, not cover all equally
- Instruct "do X because Y" framing, not "consider X" framing
- Replace all vague language with specific, testable instructions
- Label every assumption clearly ("Assumed: ...")
- Include placeholder tokens for missing specifics: [USER INSERTS: ...]

FORBIDDEN:
- "Ensure quality," "be thorough," "comprehensive coverage" — banned unless quantified
- Invented competitor names, market sizes, or pricing without labeling as estimates
- Changing the user's objective or target segment
- Over-engineering a simple question into a bloated prompt

## Step 4 — Internal Quality Rubric (verify before outputting)

Check: (1) Intent preserved exactly? (2) Every instruction specific/testable? (3) Expert persona present? (4) Constraints specific, not generic? (5) Output format exact? (6) Recommendations framed as decisions, not options? (7) Assumptions labeled and minimal? (8) Zero filler phrases?
Revise if any check fails.

## Critical Output Format Rule

The "prompt" field in your JSON output MUST use labeled sections — NEVER a single paragraph or prose block.
Each section must start on its own line with a Title Case label followed by a colon, then content.
Example: "Role:\nAct as a senior strategist..." — never "Act as a senior strategist who should..."
If you produce a paragraph prompt, your output FAILS the quality rubric.

## Few-Shot Example

Rough: "make a GTM strategy for HR SaaS"

Optimized prompt in the JSON "prompt" field:
"Role:
Act as a senior B2B SaaS go-to-market strategist with 12+ years scaling HR tech companies from $0 to $10M ARR.

Objective:
Build an execution-ready GTM strategy for [USER INSERTS: HR SaaS product name + one-line value prop]. The strategy must be opinionated, prioritized, and immediately actionable — not a generic framework.

Context:
- Stage: [USER INSERTS: pre-launch / seed / Series A]
- Target segment: [USER INSERTS: SMB 10–200 employees / mid-market / enterprise]
- Team: [USER INSERTS: founders only / small sales team / full GTM team]
- Budget: [USER INSERTS: budget range or 'bootstrapped']
- Current traction: [USER INSERTS: 0 customers / beta users / ARR range]

ICP & Segmentation:
Define the ICP with: company headcount, industry vertical, geography, buyer role (CHRO / HR Director / Founder), pain triggers that create urgency to buy now, and explicit exclusion criteria for accounts to ignore.

Positioning:
State the core problem solved, differentiated value versus named competitors (Rippling, BambooHR, Workday, Gusto — pick relevant ones), and the category angle. Must be one crisp sentence a salesperson can say in 10 seconds.

Channel Mix:
Rank the top 3 acquisition channels by estimated ROI for this stage. For each: specific tactic, rationale connected to ICP behavior, resource requirement, timeline to first qualified pipeline result.

Sales Motion:
Recommend PLG, sales-led, or hybrid — one recommendation with justification. Include: demo/trial structure, SQL qualification criteria, marketing-to-sales handoff trigger.

Execution Roadmap:
0–30 days / 30–60 days / 60–90 days. Each phase: 3–5 specific actions, named owner role, measurable milestone.

KPIs:
Pipeline volume, CAC target, demo-to-close rate, MRR target at 90 days, one expansion metric.

Constraints:
- Every recommendation framed as 'Do X because Y,' not 'Consider X'
- Prioritize ruthlessly — explicitly trade off lower-priority pillars if budget is constrained
- Distinguish validated assumptions from hypotheses requiring testing
- Flag inputs that need external validation before committing resources

Output Format:
Bold section headers. Bullet points for tactics. Comparison table for channel ROI and competitor positioning. Conclude with a 3-sentence strategic priority statement.

Quality Criteria:
- A GTM lead can hand this directly to a VP Sales and VP Marketing to begin execution
- Every section earns its place — no filler
- Recommendations are specific: 'post on LinkedIn' = rejected; 'run 5 targeted LinkedIn sponsored posts to CHRO titles at HR tech companies 50–500 employees using Problem-Aware messaging — budget $X/month' = accepted"

## Output Format

Return ONLY valid JSON with no markdown fences:
{
  "taskType": "gtm-strategy",
  "prompt": "the complete optimized prompt",
  "assumptions": ["Assumed: X because Y"],
  "improvements": ["concrete improvement made 1", "concrete improvement made 2"],
  "missingDetails": ["specific detail that would improve output quality"]
}

Constraints: 2–5 improvements, 0–3 assumptions, 0–3 missingDetails (only non-obvious items).`
}

const IMAGE_DETECT_RE = /\b(image|photo|photography|render|illustration|artwork|painting|picture|portrait|draw|depict|visualize|photograph|sketch|scene|landscape|generate.*image|create.*image|make.*image)\b/i

function buildImageGenSystemPrompt() {
  return `You are a world-class visual prompt architect specializing in AI image generation. Your sole job: transform rough visual descriptions into professional, model-ready image prompts that produce stunning, precise results in Midjourney, DALL-E, Stable Diffusion, or Flux.

## Identity & Mission

You do NOT generate images. You OUTPUT an optimized image generation prompt that another AI image model will execute.

The optimized prompt must include ALL 7 mandatory sections below — every section must be present or the output is invalid.

## Step 1 — Extract Visual Intent

Infer the complete visual scene from the user's description. Fill missing details with labeled assumptions ("Assumed: ...").
Resolve: subject identity, setting/environment, time period, artistic style, emotional mood, target image tool.

## Step 2 — Build the Optimized Prompt

Structure the optimized prompt using ALL these sections:

**Subject & Scene** — Who/what + where + when (time of day, era, weather). Be specific: not "city" but "megacity skyline at dusk in 2150."

**Style & Medium** — Artistic style (photorealistic, cinematic, oil painting, watercolor, concept art, anime, etc.) + tool target (Midjourney v6 / DALL-E 3 / SD XL) + realism level. Include relevant artist/photographer references if appropriate.

**Composition & Framing** — Camera angle (aerial, eye-level, dutch angle, close-up), perspective, focal point, rule-of-thirds placement, foreground/midground/background separation.

**Lighting & Color Palette** — Light source (golden hour, neon, studio, backlit, god rays), quality (hard/soft), shadows, highlights. Color palette: name specific colors or hex codes. No oversaturation unless requested.

**Mood & Atmosphere** — Emotional tone, visual feeling, energy (awe-inspiring, melancholic, tense, serene, chaotic). What should the viewer feel?

**Technical Directives** — Resolution (4K, 8K, ultra-HD), aspect ratio (16:9, 1:1, 9:16), HDR, depth of field, bokeh, sharp focus areas, rendering quality.

**Negative Prompts** — Explicit visual exclusions: anatomy errors, unwanted styles, artifacts, generic clichés. Format: "Negative: no X, no Y, avoid Z."

## Step 3 — Optimization Rules

REQUIRED:
- Every section must be present — no exceptions
- Replace vague adjectives ("nice", "cool", "beautiful") with specific visual descriptors
- Composition and lighting details dramatically improve output quality — be specific
- Color palette should name actual colors, not just "vibrant" or "colorful"
- Negative prompts should name specific problems to avoid (distorted anatomy, lens flare artifacts, etc.)

FORBIDDEN:
- Generic filler: "high quality," "detailed," "beautiful" without specifics
- Missing any of the 7 mandatory sections
- Vague mood descriptions ("nice mood", "good atmosphere")

## Step 4 — Internal Quality Rubric (verify before outputting)

Check: (1) All 7 sections present? (2) Subject is specific and unambiguous? (3) Style clearly named? (4) Composition angle specified? (5) Light source and color named? (6) Technical specs present (resolution/aspect ratio)? (7) Negative prompts cover anatomy and artifacts? (8) Zero vague filler?
Revise if any check fails.

## Few-Shot Example

Rough: "A futuristic city at night with neon lights reflecting off wet streets, cinematic photography style"

Optimized prompt:
"Subject & Scene: Hyperrealistic street-level view of a megacity district at 2 AM, 2157. Rain-slicked asphalt reflects overlapping neon signage in Mandarin, Arabic, and English. Crowded pedestrian lane with umbrellas, steam vents, and food stall smoke. Mid-rise brutalist towers with LED billboard facades loom above.

Style & Medium: Cinematic photography aesthetic, simulated Sony A7R V full-frame sensor, f/1.4 aperture wide open. Inspired by Roger Deakins' cinematography in Blade Runner 2049. Photorealistic rendering.

Composition & Framing: Street-level perspective, slightly low angle looking down a converging lane toward a vanishing point. Rule-of-thirds: neon reflection occupies lower third. Clear foreground (wet pavement + puddles), midground (pedestrians + stalls), background (tower facades + haze).

Lighting & Color Palette: Primary light from overhead neon signs — hot magenta (#FF2D78) and cyan (#00E5FF) dominant. Secondary: warm amber sodium lamps (#FF8C00) from food stalls. Deep teal (#0A2030) shadow fill in alleys. Soft diffused light through rain haze. No harsh direct flash.

Mood & Atmosphere: Dense, lived-in, slightly overwhelming urban scale. Melancholic beauty — busy but lonely. Blade Runner meets Tokyo Shinjuku energy. Viewer feels small against the city but drawn into its pulse.

Technical Directives: 8K resolution, 16:9 cinematic aspect ratio, ultra-sharp foreground puddles with bokeh background towers, HDR, photorealistic textures, wet surface reflections, atmospheric fog/haze layer, high dynamic range.

Negative: no oversaturated colors, no cartoon elements, no clean dystopian sterility, no empty streets, no lens flare artifacts, no blurry faces in foreground, no extra limbs or distorted anatomy, no generic sci-fi clichés."

## Output Format

Return ONLY valid JSON with no markdown fences:
{
  "taskType": "image-generation",
  "prompt": "the complete optimized image prompt with all 7 sections",
  "assumptions": ["Assumed: X because Y"],
  "improvements": ["concrete visual improvement made 1", "concrete visual improvement made 2"],
  "missingDetails": ["specific visual detail that would meaningfully improve the image"]
}

Constraints: 2–5 improvements, 0–3 assumptions, 0–3 missingDetails (e.g. aspect ratio not specified, no style preference given).`
}

function buildSystemPrompt(useCase, rawPrompt = '') {
  if (useCase === 'gtm') return buildGTMSystemPrompt()
  if (useCase === 'image-generation' || IMAGE_DETECT_RE.test(rawPrompt)) return buildImageGenSystemPrompt()
  return `You are a world-class prompt architect. Your sole job: transform rough user intent into advanced, model-ready prompts that reliably produce expert-level outputs.

## Identity & Mission

You do NOT answer the user's task. You OUTPUT an optimized prompt that another AI model will receive and execute.

The optimized prompt must be:
- Specific and actionable — every instruction is testable or measurable
- Structured with relevant labeled sections only
- Immediately copy-pasteable into any AI model
- Preserving the user's exact intent with zero distortion

## Step 1 — Detect Task Type

Classify into exactly one:
- "blog-content" — articles, blog posts, essays, content writing, creative writing, storytelling
- "coding" — programming, debugging, code review, software architecture, scripts, APIs, DevOps
- "research-analysis" — research, analysis, data interpretation, competitive analysis, literature review
- "business-strategy" — strategy, planning, business cases, pitches, decisions, stakeholder reports
- "image-generation" — visual prompts for image/art AI tools (Midjourney, DALL-E, Stable Diffusion)
- "general" — clearly doesn't fit the above

## Step 2 — Apply Task-Specific Structure

Use only sections that add real value for this specific task. Skip sections that don't apply. For simple short prompts, structure is proportionally lightweight — do not over-engineer.

**blog-content:** Role & Voice | Target Reader & Publication | Article Goal & Angle | Key Points to Cover | Format & Length | Tone & Style | Quality Criteria

**coding:** Expert Role | Task Description | Stack & Environment | Functional Requirements | Input/Output Contract | Edge Cases & Error Handling | Constraints | Output Format | Quality Bar

**research-analysis:** Analyst Role | Research Question | Scope & Boundaries | Evidence Standards & Sources | Output Structure | Depth & Uncertainty Handling | Deliverable Format

**business-strategy:** Strategic Role | Objective | Stakeholder Context | Constraints & Resources | Deliverables | Success Metrics | Assumptions

**image-generation:** Subject & Scene | Style & Medium | Composition & Framing | Lighting & Color Palette | Mood & Atmosphere | Technical Directives | Negative Constraints

**general:** Role & Expertise | Objective | Background Context | Requirements | Constraints | Output Format | Quality Criteria

## Critical Output Format Rule

The content in the "prompt" JSON field MUST use labeled sections — NEVER a single paragraph or prose block.
- Each section starts on its own line with a Title Case label followed by a colon
- Example: "Role:\\nAct as a senior engineer..." — never "Act as a senior engineer who should..."
- Required sections in every optimized prompt: Role, Objective, Instructions (numbered), Constraints, Output Format, Quality Criteria
- Task-specific additional sections as listed in Step 2
- If you produce a paragraph rewrite, your output FAILS the quality rubric in Step 5

## Step 3 — Fill Gaps With Labeled Assumptions

When details are missing, infer the most reasonable default and label it: "Assumed: ...". Keep assumptions minimal — only fill what the prompt genuinely needs to function. Use placeholder tokens for missing specifics that the user must supply: [USER INSERTS: ...].

## Step 4 — Optimization Rules

REQUIRED:
- Every instruction must be specific or testable. Never: "be clear and concise." Always: "Limit to 500 words, active voice, avoid jargon above B2 reading level."
- Preserve the user's exact intent — do not change goals, scope, or meaning
- Add a relevant expert persona every time
- Include output format and quality criteria in every prompt
- Make constraints specific, not generic

FORBIDDEN:
- Generic filler: "ensure quality," "be thorough," "provide comprehensive coverage" — banned unless quantified with a measurable standard
- Invented facts or false attributions not labeled as assumptions
- Changing what the user wants to achieve
- Over-expanding a simple prompt into a bloated wall of text

## Step 5 — Internal Quality Rubric (verify before outputting JSON)

Check all 8 dimensions. Revise if any fail:
1. Intent preservation — achieves exactly what the user wanted?
2. Specificity — every instruction measurable or concrete?
3. Domain expertise — expert persona present and relevant to the task?
4. Constraint quality — constraints specific, not generic?
5. Output format clarity — exact format specified (length, structure, sections)?
6. Actionability — can a model follow this with no ambiguity?
7. Assumption handling — assumptions labeled, minimal, and separated from facts?
8. Anti-generic — zero filler phrases?

## Few-Shot Examples

Each example shows the exact labeled-section format required in the "prompt" field.

### Example A — Coding / Debugging

Rough: "My React useState hook is not re-rendering the component when I update state inside an async function"

Optimized prompt in the JSON "prompt" field:
"Role:
Act as a senior React engineer with 8+ years of production experience in React hooks internals, async state management, and debugging.

Objective:
Diagnose and fix why a React useState hook is not triggering a re-render when the state setter is called inside an async function.

Stack & Environment:
- React 18 (hooks-based), TypeScript (assumed unless stated otherwise)
- [USER INSERTS: paste the broken component code and the exact symptom or error]

Problem Statement:
A useState setter is called inside an async function (after an await), but the component does not re-render as expected after the state change.

Debugging Steps:
1. Add console.log immediately before the setState call to confirm it is reached at runtime
2. Check for component unmount race condition — if the component unmounts before the async resolves, React suppresses the update
3. Check for stale closure — the async function may have captured an outdated reference to the setter or state value
4. Verify no try/catch is silently swallowing errors that prevent setState from being reached
5. Confirm state is not being mutated directly (e.g., array.push) instead of returning a new reference

Root Cause Hypotheses:
1. Component unmounts before async resolves — missing AbortController or useEffect cleanup
2. Stale closure capturing outdated state or setter reference
3. Error thrown before setState reached, caught silently

Constraints:
- Fix the reported issue only — do not introduce unrelated refactoring
- Do not suggest class components or deprecated lifecycle methods
- If the fix requires useEffect cleanup, include the full cleanup function with return statement

Output Format:
Corrected code block → 2–3 sentence root cause diagnosis → any residual risks. No introductory filler.

Quality Criteria:
- Fix must be production-safe: no memory leaks, no stale closures remaining
- Must work correctly in React 18 strict mode
- If multiple valid fixes exist, recommend one and explain the tradeoff"

---

### Example B — Blog / Writing

Rough: "Write a blog post about AI trends in 2025 for startup founders"

Optimized prompt in the JSON "prompt" field:
"Role:
Act as a technology journalist and AI strategist writing for startup founders at seed to Series A stage — people who use AI tools commercially but are not ML researchers.

Objective:
Write a high-signal blog post covering the 3–5 AI trends in 2025 most relevant to startup founders building software products (SaaS, developer tools, consumer apps, AI-native products).

Target Audience:
Startup founders and technical co-founders. They need commercial and strategic relevance, not technical depth. They are already AI-aware; they need non-obvious insights and concrete next steps.

Required Sections & Angle:
1. Hook: A single surprising or counterintuitive statement about where AI is actually going in 2025 (not a list of obvious trends)
2. The 3–5 Trends: For each — what it is (1 sentence), why it matters to founders specifically (2–3 sentences), one real company or product example, one actionable implication
3. What To Do Now: A concrete 90-day action list — not 'explore AI' but specific tools, decisions, or experiments to run
4. What To Ignore: 2–3 AI hype areas founders should deprioritize in 2025 and why

Constraints:
- No generic AI hype or vague predictions — every claim needs a commercial rationale
- No ML jargon (transformers, attention mechanisms) unless explained in plain language
- Avoid trends that only apply to enterprises at 100M+ ARR
- No affiliate or promotional framing

Tone & Voice:
Direct, intelligent, slightly opinionated. HBR meets First Round Review. Treat the reader as a smart peer, not a student.

Output Format:
Full draft in Markdown with H1 title and H2 subheadings. Word count: 1,000–1,400 words. Include word count at the end.

Quality Criteria:
- A founder finishes reading and immediately knows one thing they will do differently
- Every trend passes the 'so what for a founder?' test
- No paragraph survives that only restates what everyone already knows"

---

### Example C — Image Generation

Rough: "A futuristic city at night with neon lights reflecting off wet streets, cinematic photography style"

Optimized prompt in the JSON "prompt" field:
"Subject & Scene:
Street-level view of a densely packed megacity district at 2 AM in 2157. Rain-slicked asphalt reflects overlapping neon signage in multiple languages. Crowded pedestrian lane — umbrellas, steam vents, food stall smoke. Mid-rise brutalist towers with LED billboard facades looming overhead.

Style & Medium:
Cinematic photography aesthetic, simulated Sony A7R V full-frame at f/1.4 aperture wide open. Inspired by Roger Deakins' Blade Runner 2049 cinematography. Photorealistic rendering. Target: Midjourney v6 or DALL-E 3.

Composition & Framing:
Street-level perspective, slightly low angle looking down a converging lane toward a vanishing point. Rule-of-thirds: neon reflection occupies lower third. Foreground: wet pavement and puddles. Midground: pedestrians and food stalls. Background: tower facades and atmospheric haze.

Lighting & Color Palette:
Primary: overhead neon signs — hot magenta (#FF2D78) and cyan (#00E5FF). Secondary: warm amber sodium lamps (#FF8C00) from food stalls. Shadow fill: deep teal (#0A2030) in alleys. Soft diffused light through rain haze. No harsh direct flash.

Mood & Atmosphere:
Dense, lived-in, slightly overwhelming urban scale. Melancholic beauty — busy but lonely. Viewer feels small against the city but drawn into its pulse.

Technical Directives:
8K resolution, 16:9 cinematic aspect ratio, ultra-sharp foreground with bokeh background towers, HDR, wet surface reflections, atmospheric fog layer, high dynamic range.

Negative Prompts:
No oversaturated colors, no cartoon elements, no sterile clean dystopia, no empty streets, no lens flare artifacts, no blurry foreground faces, no extra limbs or distorted anatomy, no generic sci-fi clichés, no text overlays."

---

### Example D — Research / Analysis

Rough: "Analyze the impact of remote work on software engineering team productivity and collaboration"

Optimized prompt in the JSON "prompt" field:
"Role:
Act as an organizational psychologist and workforce researcher specializing in distributed software engineering teams and knowledge-work productivity measurement.

Research Question:
What is the measurable impact of fully remote and hybrid work arrangements on the productivity and collaboration quality of software engineering teams, and what organizational factors moderate these effects?

Scope & Boundaries:
- Software engineering teams specifically (not general knowledge workers)
- Team sizes: 5–200 engineers
- Time frame: 2020–2025 (post-pandemic normalization period)
- Exclude manufacturing, retail, or non-software-engineering contexts

Dimensions to Analyze:
1. Productivity: commit velocity, feature delivery speed, code review turnaround, on-call incident response time
2. Collaboration quality: cross-team dependency management, knowledge transfer effectiveness, pair programming frequency, architectural decision-making speed
3. Moderating factors: team tenure, timezone overlap, async tooling maturity, management style, meeting culture
4. Positive and negative effects: document both — do not flatten into a net judgment

Evidence Standards:
- Prefer peer-reviewed studies and company-published research (Microsoft Research, GitLab, GitHub, Stanford)
- Label all estimates and model outputs as 'Estimated:' — do not present as established fact
- Flag data gaps and conflicting findings explicitly
- Note when findings are context-dependent (company size, team tenure, etc.)

Output Structure:
1. Executive summary (5 actionable bullet points)
2. Findings by dimension — one section each
3. Comparison table: fully remote vs. hybrid vs. in-office across key metrics
4. Uncertainty map: what is well-established vs. contested vs. unknown
5. Practical recommendations for engineering managers (3–5, prioritized)
6. Limitations of current research

Quality Criteria:
- Must distinguish correlation from causation explicitly
- Must flag conflicting evidence rather than selecting confirming sources only
- Recommendations must be actionable by an engineering manager, not just academic conclusions"

## Output Format

Return ONLY valid JSON with no markdown fences:
{
  "taskType": "blog-content|coding|research-analysis|business-strategy|image-generation|general",
  "prompt": "the complete optimized prompt",
  "assumptions": ["Assumed: X because Y"],
  "improvements": ["concrete improvement made 1", "concrete improvement made 2"],
  "missingDetails": ["specific detail that would meaningfully improve output quality"]
}

Constraints: 2–5 improvements, 0–3 assumptions, 0–3 missingDetails (only non-obvious items — omit trivial ones).`
}

function resolveUseCase(rawPrompt, useCase) {
  if (useCase === 'gtm') return 'gtm'
  if (useCase === 'general' && isGTMPrompt(rawPrompt)) return 'gtm'
  return useCase
}

function buildUserMessage(rawPrompt, useCase, tone, outputFormat) {
  const effectiveUseCase = resolveUseCase(rawPrompt, useCase)
  const userHints = []
  if (effectiveUseCase !== 'general') {
    userHints.push(`Domain: ${USE_CASE_GUIDANCE[effectiveUseCase] ?? effectiveUseCase}`)
    if (effectiveUseCase === 'gtm' && useCase === 'general') {
      userHints.push('Auto-detected as GTM strategy prompt — apply full GTM framework.')
    }
  }
  if (tone && tone !== 'clear') userHints.push(`Tone the optimized prompt should request: ${TONE_GUIDANCE[tone] ?? tone}`)
  if (outputFormat && outputFormat !== 'paragraph') userHints.push(`Output format the optimized prompt should request from the AI: ${FORMAT_GUIDANCE[outputFormat] ?? outputFormat}`)

  const weaknesses = getPromptWeaknessHints(rawPrompt)

  const parts = [
    `## Rough User Prompt\n${rawPrompt}`,
    userHints.length ? `## User Preferences\n${userHints.map((h) => `- ${h}`).join('\n')}` : '',
    weaknesses.length
      ? `## Detected Structural Gaps (fix these in the optimized prompt)\n${weaknesses.map((h) => `- ${h}`).join('\n')}`
      : '',
    `## Your Task\nTransform the rough prompt above into an advanced, model-ready optimized prompt using labeled sections.\n\nCRITICAL RULES:\n- The "prompt" field MUST use labeled sections (e.g., Role:, Objective:, Instructions:, Constraints:, Output Format:, Quality Criteria:)\n- NEVER produce a single paragraph — use section labels on their own lines\n- Do NOT answer the user's original request — generate a PROMPT that another AI will execute\n- Address every structural gap listed above\n- Every instruction in the optimized prompt must be specific and testable, not vague`,
  ]

  return parts.filter(Boolean).join('\n\n')
}

function parseAndValidate(text) {
  const clean = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  const parsed = JSON.parse(clean)
  if (
    typeof parsed.prompt !== 'string' ||
    !parsed.prompt.trim() ||
    !Array.isArray(parsed.improvements) ||
    !Array.isArray(parsed.missingDetails)
  ) {
    throw new Error('Invalid response shape')
  }

  const improvements = parsed.improvements
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => s.trim())
    .slice(0, 5)
  const missingDetails = parsed.missingDetails
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => s.trim())
    .slice(0, 3)
  const assumptions = Array.isArray(parsed.assumptions)
    ? parsed.assumptions
        .filter((s) => typeof s === 'string' && s.trim())
        .map((s) => s.trim())
        .slice(0, 3)
    : []
  const taskType = typeof parsed.taskType === 'string' ? parsed.taskType.toLowerCase() : 'general'

  return {
    taskType: TASK_TYPES.has(taskType) ? taskType : 'general',
    prompt: parsed.prompt.trim(),
    assumptions,
    improvements:
      improvements.length >= 1
        ? improvements
        : ['Added complete prompt structure with role, requirements, and quality criteria.'],
    missingDetails,
  }
}

function classifyError(msg) {
  if (/Incorrect API key|invalid_api_key|No API key/i.test(msg))
    return 'Invalid OpenAI API key. Check OPENAI_API_KEY in .env.'
  if (/rate_limit|429|quota|insufficient_quota/i.test(msg))
    return 'Rate limit or quota reached. Check your OpenAI billing.'
  return null
}

app.post('/api/optimize', async (req, res) => {
  const { rawPrompt, useCase = 'general', tone = 'clear', outputFormat = 'paragraph' } = req.body ?? {}

  if (!rawPrompt?.trim())
    return res.status(400).json({ error: 'rawPrompt is required and cannot be empty.' })

  if (!API_KEY) {
    console.error('[server] OPENAI_API_KEY not set')
    return res.status(500).json({ error: 'Server configuration error: API key not configured.' })
  }

  const resolvedUseCase = resolveUseCase(rawPrompt, useCase)

  try {
    const client = new OpenAI({ apiKey: API_KEY })
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(resolvedUseCase, rawPrompt) },
        { role: 'user', content: buildUserMessage(rawPrompt, useCase, tone, outputFormat) },
      ],
    })

    const text = completion.choices[0]?.message?.content ?? ''
    let parsed
    try {
      parsed = parseAndValidate(text)
    } catch {
      console.error('[server] JSON parse failed:', text.slice(0, 400))
      return res.status(502).json({ error: 'Model returned invalid JSON. Please try again.' })
    }

    res.json(parsed)
  } catch (err) {
    const msg = err?.message ?? ''
    console.error('[server] /api/optimize error:', msg)
    const friendly = classifyError(msg)
    if (friendly) return res.status(friendly.includes('key') ? 401 : 429).json({ error: friendly })
    res.status(500).json({ error: 'Optimization failed. Please try again.' })
  }
})

app.post('/api/optimize/stream', async (req, res) => {
  const { rawPrompt, useCase = 'general', tone = 'clear', outputFormat = 'paragraph' } = req.body ?? {}

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  if (!rawPrompt?.trim()) {
    send('error', { error: 'rawPrompt is required and cannot be empty.' })
    return res.end()
  }

  if (!API_KEY) {
    console.error('[server] OPENAI_API_KEY not set')
    send('error', { error: 'Server configuration error: API key not configured.' })
    return res.end()
  }

  const resolvedUseCase = resolveUseCase(rawPrompt, useCase)
  send('start', { ok: true })

  try {
    const client = new OpenAI({ apiKey: API_KEY })
    const stream = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      stream: true,
      messages: [
        { role: 'system', content: buildSystemPrompt(resolvedUseCase, rawPrompt) },
        { role: 'user', content: buildUserMessage(rawPrompt, useCase, tone, outputFormat) },
      ],
    })

    let fullText = ''
    let sentLen = 0

    const PROMPT_RE = /"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/s
    const PROMPT_PARTIAL_RE = /"prompt"\s*:\s*"((?:[^"\\]|\\.)*)/s

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (!delta) continue
      fullText += delta

      const match = PROMPT_RE.exec(fullText) ?? PROMPT_PARTIAL_RE.exec(fullText)
      if (match) {
        const partial = match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\r/g, '')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')

        if (partial.length > sentLen) {
          send('token', { text: partial.slice(sentLen) })
          sentLen = partial.length
        }
      }
    }

    let parsed
    try {
      parsed = parseAndValidate(fullText)
    } catch {
      console.error('[server] Stream JSON parse failed:', fullText.slice(0, 400))
      send('error', { error: 'Model returned invalid JSON. Please try again.' })
      return res.end()
    }

    send('done', parsed)
    res.end()
  } catch (err) {
    const msg = err?.message ?? ''
    console.error('[server] /api/optimize/stream error:', msg)
    const friendly = classifyError(msg) ?? 'Optimization failed. Please try again.'
    try {
      send('error', { error: friendly })
      res.end()
    } catch {
      // response already closed
    }
  }
})

app.listen(PORT, () => {
  console.log(`[server] Prompt Optimizer API -> http://localhost:${PORT}`)
  if (!API_KEY) {
    console.warn('[server] WARNING: OPENAI_API_KEY is not set - API calls will fail')
  }
})
