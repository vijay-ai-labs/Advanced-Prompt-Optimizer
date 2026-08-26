import type { UseCase, Tone, OutputFormat, OptimizedResult, PromptAnalysis, ScoreBreakdownItem } from './types'

// ── Detection patterns ─────────────────────────────────────────────────────

const ACTION_VERBS = [
  'write', 'create', 'build', 'design', 'develop', 'analyze', 'analyse',
  'compare', 'summarize', 'summarise', 'explain', 'generate', 'list',
  'describe', 'evaluate', 'review', 'optimize', 'optimise', 'improve',
  'translate', 'convert', 'calculate', 'research', 'find', 'identify',
  'recommend', 'suggest', 'plan', 'draft', 'outline', 'code', 'implement',
  'fix', 'debug', 'refactor', 'make', 'compose', 'craft', 'prepare',
  'produce', 'define', 'teach', 'show', 'demonstrate', 'illustrate',
]

const VAGUE_QUALITY_WORDS = [
  'something', 'stuff', 'things', 'whatever', 'anything',
  'nice', 'good', 'great', 'awesome', 'cool',
  'better', 'some kind', 'kind of', 'sort of',
]

const WEAK_OPENER_RE =
  /^(can you |could you |please |help me |i need you to |i want you to |i'd like you to |i would like you to |would you |will you |i need |i want )/i

const AUDIENCE_RE =
  /\b(for (beginners?|developers?|engineers?|students?|professionals?|executives?|children|adults|experts?|novices?|seniors?|marketers?|designers?|managers?|non.?technical|business people|stakeholders?)|target(ed)? (at|to|for|audience)|audience|readers?)\b/i

const OUTPUT_FORMAT_RE =
  /\b(list|bullet|table|json|outline|numbered|step.by.step|format|structured|markdown|code block|diagram)\b/i

const TONE_RE =
  /\b(formal|informal|professional|casual|friendly|technical|simple|clear|persuasive|academic|conversational|authoritative|empathetic)\b/i

const LENGTH_RE =
  /\b(\d+\s*(words?|sentences?|paragraphs?|pages?|lines?|characters?)|(brief|short|concise|detailed|comprehensive|thorough|in.depth|extensive|long))\b/i

const CONSTRAINTS_RE =
  /\b(avoid|don't|do not|must|only|limit|without|exclude|include|require|constraint|restrict|no more than|at least|maximum|minimum|should not|shouldn't)\b/i

const LANG_RE =
  /\b(javascript|typescript|python|java|c\+\+|c#|go|golang|rust|ruby|php|swift|kotlin|dart|sql|bash|shell|html|css|react|vue|angular|next\.?js|node|express|django|flask|spring|rails|laravel)\b/i

// ── Analysis ───────────────────────────────────────────────────────────────

export function analyzePrompt(raw: string): PromptAnalysis {
  const lower = raw.toLowerCase()
  const words = raw.trim().split(/\s+/).filter(Boolean)

  return {
    hasAction: ACTION_VERBS.some((v) => lower.includes(v)),
    hasAudience: AUDIENCE_RE.test(raw),
    hasOutputFormat: OUTPUT_FORMAT_RE.test(raw),
    hasTone: TONE_RE.test(raw),
    hasLength: LENGTH_RE.test(raw),
    hasConstraints: CONSTRAINTS_RE.test(raw),
    hasVaguePhrases: VAGUE_QUALITY_WORDS.some((p) => lower.includes(p)),
    removedOpener: WEAK_OPENER_RE.test(raw),
    wordCount: words.length,
    isShort: words.length < 8,
    _raw: raw,
  }
}

// ── Scoring ────────────────────────────────────────────────────────────────
//
// Weights (total 100):
//   Task clarity    20  — has a specific action verb
//   Specificity     15  — word count proxies for detail
//   Audience        15  — mentions who the output is for
//   Output format   10  — states desired structure
//   Tone/style      10  — specifies voice
//   Constraints     15  — includes requirements/restrictions
//   Language quality 15 — absence of vague filler words

const IMAGE_STYLE_RE = /\b(photorealistic|cinematic|anime|oil.?paint|watercolor|digital.?art|illustration|hyperrealistic|8k|hdr|rendering|render|fantasy|surreal|impressionist|minimalist|noir|vintage|concept.?art|pixel.?art|low.?poly)\b/i
const IMAGE_COMPOSITION_RE = /\b(composition|framing|rule.of.thirds|foreground|midground|background|lighting|shadows|highlights|depth.of.field|bokeh|golden.hour|neon|backlit|aerial|eye.level|close.?up|wide.shot|dutch.?angle|isometric|overhead|bird.?s.eye|silhouette|perspective)\b/i
const IMAGE_NEGATIVE_RE = /\b(no |without |avoid |negative.constraint|negative.prompt|avoid:|exclude:)\b/i
const IMAGE_TECHNICAL_RE = /\b(4k|8k|resolution|aspect.ratio|hdr|portrait|landscape|square|[0-9]+:[0-9]+|ultra.?hd|high.?detail|sharp|crisp|texture|photorealistic rendering)\b/i
const ANALYSIS_STRUCTURE_RE = /\b(report|findings|recommendations|introduction|conclusion|section|methodology|framework|analysis|overview|summary|breakdown|deliverable|output|structure)\b/i

// ── Section header detection ───────────────────────────────────────────────
//
// Prompts reach the scorer from two producers that label their sections
// differently: the local templates below write plain "Role:" lines, while the
// model backend writes markdown ("**Role:**", "## Output Format") and picks
// labels from an open-ended vocabulary ("Expert Role", "Stack & Environment").
// Labels are therefore normalised before being matched, rather than compared
// against one fixed list.

// Shape of a section label once decoration is stripped: starts capitalised,
// no sentence punctuation, short enough to be a heading rather than prose.
const SECTION_LABEL_RE = /^[A-Z][A-Za-z0-9][A-Za-z0-9 &/'’-]{0,58}$/

// Words that mark a line as a section name when it was written without a
// trailing colon. Covers the labels used by both producers.
const SECTION_KEYWORD_RE =
  /\b(role|objective|goal|context|background|instructions?|constraints?|output|format|quality|criteria|bar|assumptions?|audience|readers?|problem|statement|steps?|stack|environment|requirements?|method|approach|subject|scene|composition|framing|lighting|colou?r|palette|mood|atmosphere|technical|directives?|negative|scope|boundaries|evidence|sources?|research|question|deliverables?|icp|segmentation|positioning|channel|mix|sales|motion|execution|roadmap|kpis?|metrics?|risks?|tradeoffs?|tone|style|voice|expertise|task|description|contract|edge|cases?|handling|depth|uncertainty|persona|examples?|success|length|article|publication|stakeholders?|resources?|camera|key|points?)\b/i

// Section labels are headings, not sentences. The longest label either
// producer uses ("Edge Cases & Error Handling") is five words.
const MAX_LABEL_WORDS = 5

function stripEmphasis(s: string): string {
  return s
    .trim()
    .replace(/^(?:\*\*|__|\*|_)+/, '')
    .replace(/(?:\*\*|__|\*|_)+$/, '')
    .trim()
}

// Number of distinct labeled sections in a prompt. Distinct, so a label that
// repeats does not inflate the count. Exported so the drift between what the
// builders emit and what the scorer recognises can be tested directly.
export function countSectionHeaders(raw: string): number {
  const lines = raw.split(/\r?\n/)
  const multiLine = lines.filter((l) => l.trim() !== '').length > 1
  const seen = new Set<string>()

  for (const rawLine of lines) {
    let line = rawLine.trim()
    if (line === '') continue

    line = line.replace(/^#{1,6}\s*/, '').replace(/^>\s*/, '')

    // A bulleted line carries content, never a section name, so it is out
    // whatever it holds - "- Cover ICP and segmentation: firmographics" is a
    // requirement, not a heading. Numbered lines can legitimately be either.
    if (/^[-*•]\s+/.test(line)) continue
    line = stripEmphasis(line.replace(/^\d+[.)]\s+/, ''))

    const colonAt = line.indexOf(':')
    const label = stripEmphasis(colonAt === -1 ? line : line.slice(0, colonAt))

    if (!SECTION_LABEL_RE.test(label)) continue
    if (label.split(/\s+/).length > MAX_LABEL_WORDS) continue

    // A label that ends its line is convincing on its own. Anything else - a
    // colon with content after it, or no colon at all - has to read like a
    // section name, otherwise prose such as "Meet me at 10:30" or
    // "Summarise https://example.com" would register as structure.
    const endsLine = colonAt === line.length - 1
    if (!endsLine && !SECTION_KEYWORD_RE.test(label)) continue

    // A bare label additionally needs company: a one-line prompt is a request,
    // not a section.
    if (colonAt === -1 && !multiLine) continue

    seen.add(label.toLowerCase())
  }

  return seen.size
}

interface ScoreComponent { label: string; score: number; max: number }

// Single source of truth for scoring: computeScore and computeScoreBreakdown
// both derive from this list, so the total score always equals the sum of
// the breakdown rows shown in the UI.
function computeScoreComponents(analysis: PromptAnalysis, taskType?: string): ScoreComponent[] {
  const raw = analysis._raw ?? ''
  const clarityScore = analysis.hasAction ? 20 : analysis.isShort ? 0 : 8

  if (taskType === 'image-generation') {
    const hasStyle = IMAGE_STYLE_RE.test(raw)
    const hasComposition = IMAGE_COMPOSITION_RE.test(raw)
    const hasNegative = IMAGE_NEGATIVE_RE.test(raw)
    const hasTechnical = IMAGE_TECHNICAL_RE.test(raw)
    const specScore = analysis.wordCount >= 20 ? 15 : analysis.wordCount >= 10 ? 10 : analysis.wordCount >= 5 ? 5 : 0

    return [
      { label: 'Clarity',              score: clarityScore,                          max: 20 },
      { label: 'Specificity',          score: specScore,                             max: 15 },
      { label: 'Style',                score: (hasStyle || hasComposition) ? 15 : 0, max: 15 },
      { label: 'Composition',          score: hasComposition ? 25 : 0,               max: 25 },
      { label: 'Negative Constraints', score: hasNegative ? 15 : 0,                  max: 15 },
      { label: 'Technical Detail',     score: hasTechnical ? 10 : 0,                 max: 10 },
    ]
  }

  const specScore =
    analysis.wordCount >= 30 ? 15 :
    analysis.wordCount >= 15 ? 10 :
    analysis.wordCount >= 8 ? 5 : 0
  // Partial credit, so a lightly structured prompt scores between "no
  // structure at all" and a fully sectioned one.
  const sectionCount = countSectionHeaders(raw)
  const structureScore =
    sectionCount >= 3 ? 15 :
    sectionCount === 2 ? 10 :
    sectionCount === 1 ? 5 :
    analysis.hasAudience ? 5 : 0

  const components: ScoreComponent[] = [
    { label: 'Clarity',     score: clarityScore, max: 20 },
    { label: 'Specificity', score: specScore,    max: 15 },
    { label: 'Structure',   score: structureScore, max: 15 },
  ]

  if (taskType === 'research-analysis') {
    const researchDepthScore = ANALYSIS_STRUCTURE_RE.test(raw) ? 10 : 0
    components.push({ label: 'Research Depth', score: researchDepthScore, max: 10 })
  } else {
    components.push({ label: 'Tone', score: analysis.hasTone ? 10 : 0, max: 10 })
  }

  components.push({ label: 'Output Format',    score: analysis.hasOutputFormat ? 10 : 0, max: 10 })
  components.push({ label: 'Constraints',      score: analysis.hasConstraints ? 15 : 0,  max: 15 })
  components.push({ label: 'Language Quality', score: analysis.hasVaguePhrases ? 0 : 15, max: 15 })

  return components
}

export function computeScore(analysis: PromptAnalysis, taskType?: string): number {
  const total = computeScoreComponents(analysis, taskType).reduce((sum, c) => sum + c.score, 0)
  return Math.min(total, 100)
}

// ── Score breakdown ────────────────────────────────────────────────────────
//
// Same components used by computeScore, itemized for the UI. Rows always
// sum to the value computeScore returns (for the same analysis/taskType).

export function computeScoreBreakdown(analysis: PromptAnalysis, taskType?: string): ScoreBreakdownItem[] {
  function status(s: number, m: number): 'missing' | 'partial' | 'strong' {
    const r = m === 0 ? 0 : s / m
    if (r >= 0.75) return 'strong'
    if (r > 0) return 'partial'
    return 'missing'
  }

  return computeScoreComponents(analysis, taskType).map((c) => ({
    label: c.label,
    score: c.score,
    max: c.max,
    status: status(c.score, c.max),
  }))
}

// ── Task cleaning ──────────────────────────────────────────────────────────

function cleanTask(raw: string): string {
  let s = raw.trim()
  s = s.replace(WEAK_OPENER_RE, '')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.charAt(0).toUpperCase() + s.slice(1)
  return s
}

// ── Tone / format instruction lines ───────────────────────────────────────

const TONE_LINES: Record<Tone, string> = {
  clear: 'Use clear, concise, and direct language.',
  professional: 'Maintain a professional, formal, and authoritative tone.',
  friendly: 'Use a warm, conversational, and approachable tone.',
  persuasive: 'Use compelling, persuasive language that motivates action.',
  technical: 'Use precise technical terminology appropriate for domain experts.',
}

const FORMAT_LINES: Record<OutputFormat, string> = {
  paragraph: 'Structure your response in clear, well-organised paragraphs.',
  'bullet-list': 'Format your response as a concise, scannable bullet-point list.',
  'step-by-step': 'Provide a numbered, step-by-step breakdown with clear progression.',
  json: 'Return your response as structured, valid JSON with descriptive keys.',
}

// ── Domain detection for general use-case ─────────────────────────────────

interface DomainProfile {
  role: string
  guidelineHeader: string
  guidelines: string[]
  successCriteria: string
  missingHints: string[]
}

const DOMAIN_PATTERNS: Array<{ pattern: RegExp; profile: DomainProfile }> = [
  {
    pattern: /\b(edit|editing|cut|trim|footage|video|film|clip|reel|render|transition|splice|montage|b.?roll|color.?grad)\b/i,
    profile: {
      role: 'Act as a professional video editor with expertise in storytelling through film.',
      guidelineHeader: 'Editing guidelines:',
      guidelines: [
        '- Recommend specific cuts, transitions, and pacing that suit the footage content',
        '- Suggest music style and tempo to complement the visual energy',
        '- Propose color grading approach (vibrant, cinematic, natural, moody)',
        '- Specify clip sequencing to build a compelling visual narrative',
        '- Note any text overlays, captions, or effects that would enhance the piece',
      ],
      successCriteria: 'The edit should be engaging, rhythmically cohesive, and tell a clear visual story.',
      missingHints: [
        'Video editing software not specified (Premiere Pro, DaVinci Resolve, CapCut, etc.)',
        'Target platform not mentioned (Instagram Reels, YouTube, TikTok) — affects aspect ratio and duration',
        'Desired mood or tone not described (energetic, artistic, documentary-style)',
      ],
    },
  },
  {
    pattern: /\b(cook|recipe|meal|dish|ingredient|bake|grill|cuisine|food|breakfast|lunch|dinner|snack)\b/i,
    profile: {
      role: 'Act as a professional chef and culinary expert.',
      guidelineHeader: 'Culinary guidelines:',
      guidelines: [
        '- List all ingredients with precise measurements',
        '- Provide clear, ordered preparation and cooking steps',
        '- Include timing, temperatures, and visual doneness cues',
        '- Note common mistakes and how to avoid them',
        '- Suggest plating, garnish, and serving recommendations',
      ],
      successCriteria: 'The recipe should be reproducible by a home cook with clear, step-by-step guidance.',
      missingHints: [
        'Dietary restrictions or preferences not specified',
        'Serving size or number of portions not mentioned',
        'Skill level or available equipment not described',
      ],
    },
  },
  {
    pattern: /\b(travel|trip|vacation|itinerary|destination|tour|visit|hotel|flight|holiday|journey|explore)\b/i,
    profile: {
      role: 'Act as an experienced travel planner and destination expert.',
      guidelineHeader: 'Travel planning guidelines:',
      guidelines: [
        '- Provide a day-by-day itinerary with realistic timing',
        '- Include must-see attractions alongside hidden local gems',
        '- Recommend accommodation options across budget tiers',
        '- Note transportation logistics between locations',
        '- Flag seasonal considerations, visa requirements, or cultural tips',
      ],
      successCriteria: 'The plan should be practical, detailed, and tailored to the traveller\'s context.',
      missingHints: [
        'Travel duration not specified',
        'Budget range not mentioned',
        'Number of travellers and any special needs not described',
      ],
    },
  },
  {
    pattern: /\b(fitness|workout|exercise|training|gym|muscle|cardio|weight|run|yoga|diet|nutrition|health)\b/i,
    profile: {
      role: 'Act as a certified fitness coach and nutrition expert.',
      guidelineHeader: 'Fitness guidelines:',
      guidelines: [
        '- Structure sessions with warm-up, main work, and cool-down phases',
        '- Specify sets, reps, rest periods, and intensity cues',
        '- Provide modification options for different fitness levels',
        '- Include safety notes for injury-prone movements',
        '- Align recommendations with stated goals (strength, endurance, weight loss)',
      ],
      successCriteria: 'The plan should be safe, progressive, and immediately actionable.',
      missingHints: [
        'Current fitness level not specified',
        'Available equipment or gym access not mentioned',
        'Specific goal (weight loss, muscle gain, endurance) not defined',
      ],
    },
  },
  {
    pattern: /\b(teach|explain|lesson|learn|study|understand|tutorial|course|education|concept|guide|how does)\b/i,
    profile: {
      role: 'Act as an expert educator skilled at making complex ideas accessible.',
      guidelineHeader: 'Teaching guidelines:',
      guidelines: [
        '- Start with the core concept before adding complexity',
        '- Use analogies and real-world examples to ground abstract ideas',
        '- Break the explanation into logical, sequential steps',
        '- Anticipate common misconceptions and address them directly',
        '- End with a quick summary or check-for-understanding question',
      ],
      successCriteria: 'The explanation should leave the learner with a clear, accurate mental model they can apply.',
      missingHints: [
        'Learner\'s background knowledge or level not specified',
        'Preferred learning style (visual, step-by-step, conceptual) not mentioned',
      ],
    },
  },
  {
    pattern: /\b(data|dataset|analy|statistic|chart|graph|excel|spreadsheet|sql|pandas|insight|dashboard|metric|KPI)\b/i,
    profile: {
      role: 'Act as a senior data analyst with expertise in extracting actionable insights.',
      guidelineHeader: 'Analysis guidelines:',
      guidelines: [
        '- Define the analytical approach and key metrics upfront',
        '- Describe data cleaning or preparation steps required',
        '- Identify patterns, anomalies, and statistically significant findings',
        '- Translate numbers into plain-language business insights',
        '- Recommend visualisation types appropriate to the data and audience',
      ],
      successCriteria: 'The analysis should be rigorous, clearly interpreted, and directly actionable.',
      missingHints: [
        'Data source format and size not specified',
        'Key business question or decision the analysis should inform not defined',
        'Tools available (Excel, Python, SQL, Tableau) not mentioned',
      ],
    },
  },
  {
    pattern: /\b(design|UI|UX|wireframe|prototype|layout|interface|user experience|figma|mockup|visual|brand|logo)\b/i,
    profile: {
      role: 'Act as a senior UX/UI designer with a user-centred design approach.',
      guidelineHeader: 'Design guidelines:',
      guidelines: [
        '- Ground recommendations in established design principles (hierarchy, contrast, alignment)',
        '- Prioritise usability and accessibility alongside aesthetics',
        '- Reference relevant design patterns or component conventions',
        '- Consider mobile-first and responsive behaviour',
        '- Specify interaction states, feedback, and micro-animations where relevant',
      ],
      successCriteria: 'The design should be intuitive, visually coherent, and meet user needs effectively.',
      missingHints: [
        'Target device or platform not specified',
        'Brand guidelines or existing design system not mentioned',
        'Target user persona or accessibility requirements not defined',
      ],
    },
  },
]

function detectDomain(task: string): DomainProfile | null {
  for (const { pattern, profile } of DOMAIN_PATTERNS) {
    if (pattern.test(task)) return profile
  }
  return null
}

type LocalTaskType =
  | 'blog-content'
  | 'coding'
  | 'research-analysis'
  | 'business-strategy'
  | 'gtm-strategy'
  | 'image-generation'
  | 'marketing'
  | 'general'

const GTM_DETECT_RE = /\b(go.to.market|go-to-market|gtm|g2m|market.entr(y|ies)|market.launch|launch.strateg|customer.acquisition|ideal.customer.profile|ICP\b|sales.motion|product.led.growth|PLG\b|pricing.strateg|revenue.strateg|pipeline.generat|B2B.SaaS.*(strateg|launch|grow|enter)|SaaS.*(go.to.market|gtm|market.entry)|demand.gen|sales.playbook|account.based.market|ABM\b|value.proposition.*SaaS|positioning.*SaaS|SaaS.*positioning)\b/i

function detectTaskType(rawPrompt: string, useCase: UseCase): LocalTaskType {
  if (useCase === 'gtm') return 'gtm-strategy'
  if (useCase === 'writing') return 'blog-content'
  if (useCase === 'coding') return 'coding'
  if (useCase === 'research') return 'research-analysis'
  if (useCase === 'business') return 'business-strategy'
  if (useCase === 'image-generation') return 'image-generation'
  if (useCase === 'marketing') return 'marketing'

  if (GTM_DETECT_RE.test(rawPrompt)) return 'gtm-strategy'

  const text = rawPrompt.toLowerCase()
  if (/\b(code|debug|fix|bug|api|script|function|component|react|typescript|javascript|python|sql|server|database|deploy|architecture)\b/.test(text)) {
    return 'coding'
  }
  if (/\b(blog|article|essay|story|write|newsletter|caption|content|post|draft|copy edit|rewrite)\b/.test(text)) {
    return 'blog-content'
  }
  if (/\b(marketing|ad|campaign|landing page|sales copy|cta|brand|positioning|conversion|email sequence)\b/.test(text)) {
    return 'marketing'
  }
  if (/\b(research|analy[sz]e|compare|study|report|data|trend|market research|literature|sources?)\b/.test(text)) {
    return 'research-analysis'
  }
  if (/\b(strategy|business|plan|stakeholder|roadmap|proposal|pitch|revenue|operations|kpi|budget)\b/.test(text)) {
    return 'business-strategy'
  }
  if (/\b(image|photo|picture|illustration|art|render|poster|logo|visual|scene|draw)\b/.test(text)) {
    return 'image-generation'
  }

  return 'general'
}

function mapTaskTypeToUseCase(taskType: LocalTaskType): UseCase {
  switch (taskType) {
    case 'blog-content': return 'writing'
    case 'coding': return 'coding'
    case 'research-analysis': return 'research'
    case 'business-strategy': return 'business'
    case 'gtm-strategy': return 'gtm'
    case 'image-generation': return 'image-generation'
    case 'marketing': return 'marketing'
    default: return 'general'
  }
}

function detectAssumptions(analysis: PromptAnalysis, useCase: UseCase, rawPrompt: string): string[] {
  const assumptions: string[] = []

  if (!analysis.hasAudience && useCase !== 'image-generation') {
    assumptions.push('Assumed: a general educated audience because no target audience was specified.')
  }
  if (!analysis.hasConstraints && useCase !== 'image-generation') {
    assumptions.push('Assumed: standard quality, scope, and practical constraints because no constraints were provided.')
  }
  if (useCase === 'coding' && !LANG_RE.test(rawPrompt)) {
    assumptions.push('Assumed: the implementation should state a reasonable language or framework assumption because none was specified.')
  }
  if (useCase === 'image-generation' && !/\b(style|realistic|anime|photo|cinematic|illustration|oil painting|3d|watercolor)\b/i.test(rawPrompt)) {
    assumptions.push('Assumed: photorealistic professional style because no visual style was specified.')
  }

  return assumptions.slice(0, 3)
}

// ── Use-case prompt builders ───────────────────────────────────────────────

// Keeps the single blank line between sections; only collapses accidental runs.
function join(lines: string[]): string {
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

interface StrongPromptParts {
  role: string
  objective: string
  context: string[]
  requirements: string[]
  method: string[]
  outputFormat: string[]
  qualityCriteria: string[]
}

function bullets(lines: string[]): string[] {
  return lines
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const cleaned = line.trim().replace(/^-\s*/, '')
      return `- ${cleaned}`
    })
}

function buildStrongPrompt(parts: StrongPromptParts): string {
  return join([
    'Role:',
    parts.role,
    '',
    'Objective:',
    parts.objective,
    '',
    'Context:',
    ...bullets(parts.context),
    '',
    'Requirements:',
    ...bullets(parts.requirements),
    '',
    'Method:',
    ...bullets(parts.method),
    '',
    'Output Format:',
    ...bullets(parts.outputFormat),
    '',
    'Quality Criteria:',
    ...bullets(parts.qualityCriteria),
  ])
}

function defaultMethod(): string[] {
  return [
    'Clarify the intent, audience, constraints, and expected deliverable before drafting the answer.',
    'Use concise reasoning checks internally, then present only the final answer and any useful brief rationale.',
    'If important details are missing, proceed with clearly labeled assumptions instead of stopping.',
    'Review the answer against the quality criteria before finalizing.',
  ]
}

function buildGeneral(task: string, tone: Tone, fmt: OutputFormat, a: PromptAnalysis, rawPrompt?: string): string {
  const domain = detectDomain(rawPrompt ?? task)

  if (domain) {
    return buildStrongPrompt({
      role: domain.role,
      objective: task,
      context: [
        a.hasAudience ? 'Use the audience context provided in the original prompt.' : 'Assume a general, educated audience unless a narrower audience is implied.',
        'Preserve the user\'s original topic, goal, and constraints.',
      ],
      requirements: [
        ...domain.guidelines,
        a.hasConstraints ? 'Respect all constraints stated in the original prompt.' : 'Add practical constraints that make the answer specific, useful, and realistic.',
      ],
      method: defaultMethod(),
      outputFormat: [TONE_LINES[tone], FORMAT_LINES[fmt]],
      qualityCriteria: [
        domain.successCriteria,
        'The response should be concrete, well-structured, and immediately actionable.',
      ],
    })
  }

  return buildStrongPrompt({
    role: 'Act as a knowledgeable senior expert in the most relevant domain for this task.',
    objective: task,
    context: [
      a.hasAudience ? 'Use the audience context provided in the original prompt.' : 'Assume a general, educated audience.',
      'Preserve the user\'s original intent and avoid adding unrelated goals.',
      a.hasLength ? 'Follow the length or depth preference stated by the user.' : 'Use enough detail to be useful without padding.',
    ],
    requirements: [
      'Be accurate, specific, and practical.',
      'Use concrete examples when they help clarify the answer.',
      a.hasConstraints ? 'Respect every stated requirement and restriction.' : 'State reasonable assumptions for missing constraints.',
      'Call out uncertainty, dependencies, or tradeoffs when relevant.',
    ],
    method: defaultMethod(),
    outputFormat: [TONE_LINES[tone], FORMAT_LINES[fmt]],
    qualityCriteria: [
      'The response should directly address the task.',
      'The response should be easy to understand, complete enough to act on, and free of vague filler.',
    ],
  })
}

function buildWriting(task: string, tone: Tone, fmt: OutputFormat, a: PromptAnalysis): string {
  return buildStrongPrompt({
    role: 'Act as an expert writer, editor, and storyteller.',
    objective: task,
    context: [
      a.hasAudience ? 'Write for the audience described in the original prompt.' : 'Assume a general, curious audience.',
      a.hasLength ? 'Follow the requested length or depth.' : 'Choose a length that covers the topic fully without padding.',
      'Preserve the user\'s intended topic, angle, and deliverable.',
    ],
    requirements: [
      'Hook the reader from the opening line.',
      'Maintain a consistent voice and style throughout.',
      'Use clear transitions between sections.',
      'Support claims with specific examples, anecdotes, or data where appropriate.',
      a.hasConstraints ? 'Respect all stated style, genre, and content constraints.' : 'State assumptions for missing genre, audience, or style constraints.',
    ],
    method: [
      'Identify the core message and reader takeaway before drafting.',
      'Create a logical structure, then write the final piece in that structure.',
      'Revise for clarity, flow, specificity, and voice consistency.',
    ],
    outputFormat: [TONE_LINES[tone], FORMAT_LINES[fmt]],
    qualityCriteria: [
      'The piece should be polished, engaging, and publication-ready.',
      'The writing should feel intentional rather than generic.',
    ],
  })

}

function buildCoding(task: string, tone: Tone, fmt: OutputFormat, rawPrompt: string, a: PromptAnalysis): string {
  const hasLang = LANG_RE.test(rawPrompt)
  return buildStrongPrompt({
    role: 'Act as a senior software engineer with expertise in clean, correct, maintainable systems.',
    objective: task,
    context: [
      hasLang ? 'Use the programming language, framework, and environment stated in the prompt.' : 'If the language or framework is missing, state a reasonable assumption before solving.',
      'Preserve the requested scope; do not invent unrelated features.',
      a.hasConstraints ? 'Follow all stated compatibility, performance, and style constraints.' : 'Consider performance, scalability, maintainability, and compatibility constraints.',
    ],
    requirements: [
      'Write clean, readable, well-structured code or implementation guidance.',
      'Handle edge cases, errors, and failure modes appropriately.',
      'Follow language-specific best practices and conventions.',
      'Add short comments only for non-obvious logic.',
      'Include usage examples, tests, or verification steps where applicable.',
    ],
    method: [
      'Restate the technical goal and assumptions briefly.',
      'Identify likely edge cases and dependencies before proposing the solution.',
      'Provide the implementation or debugging steps in a practical order.',
      'Verify the result against the original request and note any residual risks.',
    ],
    outputFormat: [TONE_LINES[tone], FORMAT_LINES[fmt]],
    qualityCriteria: [
      'The solution should be production-quality, correct, and easy to maintain.',
      'The answer should be specific enough for an engineer to implement or validate immediately.',
    ],
  })

}

function buildMarketing(task: string, tone: Tone, fmt: OutputFormat, a: PromptAnalysis): string {
  return buildStrongPrompt({
    role: 'Act as an experienced marketing strategist and conversion-focused copywriter.',
    objective: task,
    context: [
      a.hasAudience ? 'Use the target audience described in the original prompt.' : 'Infer a specific target audience and label that assumption.',
      'Preserve the requested offer, product, campaign, or message.',
      'Adapt the strategy to the likely channel or state a channel assumption if one is missing.',
    ],
    requirements: [
      'Lead with a compelling hook or headline.',
      'Clearly communicate the core value proposition.',
      'Address the target audience\'s key pain points, desires, and objections.',
      'Include a strong, clear call-to-action.',
      a.hasConstraints ? 'Respect stated brand, length, and platform constraints.' : 'Keep the message concise, platform-aware, and brand-safe.',
    ],
    method: [
      'Identify the audience, promise, proof, and desired action.',
      'Draft the message using a persuasive framework such as AIDA, PAS, or before-after-bridge.',
      'Check that the final copy is specific, credible, and conversion-oriented.',
    ],
    outputFormat: [TONE_LINES[tone], FORMAT_LINES[fmt]],
    qualityCriteria: [
      'The copy should drive engagement, communicate value clearly, and motivate the desired action.',
      'The result should avoid generic marketing fluff.',
    ],
  })

}

function buildResearch(task: string, tone: Tone, fmt: OutputFormat, a: PromptAnalysis): string {
  return buildStrongPrompt({
    role: 'Act as a thorough research analyst with strong judgment about evidence quality.',
    objective: task,
    context: [
      'Preserve the user\'s research topic and intended angle.',
      a.hasLength ? 'Follow the requested scope or depth.' : 'Use enough depth to cover the topic without overextending beyond available evidence.',
      'Prefer credible, authoritative, and current sources when sources are required.',
    ],
    requirements: [
      'Separate established facts from assumptions, opinions, and emerging claims.',
      'Present multiple perspectives and counterarguments where relevant.',
      'Explain uncertainty and evidence limits.',
      'Organize findings with clear headings.',
      a.hasConstraints ? 'Respect all stated source, citation, and scope constraints.' : 'State source or scope assumptions when they are missing.',
    ],
    method: [
      'Define the research question and key sub-questions.',
      'Gather and compare evidence by credibility and relevance.',
      'Synthesize findings into clear takeaways and practical implications.',
      'Flag gaps that would require further research.',
    ],
    outputFormat: [TONE_LINES[tone], FORMAT_LINES[fmt]],
    qualityCriteria: [
      'The research should be comprehensive, balanced, and clearly referenced when citations are requested.',
      'The answer should be useful for decision-making, not just a summary.',
    ],
  })

}

function buildBusiness(task: string, tone: Tone, fmt: OutputFormat, a: PromptAnalysis): string {
  return buildStrongPrompt({
    role: 'Act as an experienced business strategist and management consultant.',
    objective: task,
    context: [
      a.hasAudience ? 'Use the stakeholder audience described in the original prompt.' : 'Assume the audience includes decision-makers and key stakeholders.',
      'Preserve the business objective and any stated company, market, or operational context.',
      a.hasConstraints ? 'Use the stated budget, timeline, resource, or market constraints.' : 'State assumptions for missing budget, timeline, resource, and market constraints.',
    ],
    requirements: [
      'Frame the response around clear objectives and measurable outcomes.',
      'Consider stakeholder perspectives and organizational impact.',
      'Provide actionable recommendations with concrete implementation steps.',
      'Address risks, dependencies, tradeoffs, and success metrics.',
      'Include resource, timeline, and budget considerations where relevant.',
    ],
    method: [
      'Diagnose the goal, constraints, stakeholders, and decision context.',
      'Generate options, compare tradeoffs, and recommend a practical path.',
      'Translate recommendations into next steps, owners, metrics, and risks.',
    ],
    outputFormat: [TONE_LINES[tone], FORMAT_LINES[fmt]],
    qualityCriteria: [
      'The output should be professional, decision-ready, and clearly actionable.',
      'The answer should connect recommendations to measurable business outcomes.',
    ],
  })

}

function buildGTM(task: string, tone: Tone, fmt: OutputFormat, a: PromptAnalysis): string {
  return buildStrongPrompt({
    role: 'Act as a senior B2B SaaS go-to-market strategist with experience launching products to mid-market and enterprise buyers.',
    objective: task,
    context: [
      a.hasAudience ? 'Use the target segment and buyer personas described in the original prompt.' : 'Assume the primary buyer is a mid-market B2B company (100–1000 employees). State this assumption explicitly.',
      'Preserve the stated product category, market, and business objective.',
      a.hasConstraints ? 'Apply the stated budget, timeline, or market constraints.' : 'State assumptions for missing budget, timeline, and market maturity.',
    ],
    requirements: [
      'Cover ICP and segmentation: firmographics, pain points, buying triggers, and exclusion criteria.',
      'Define buyer personas: decision-makers, influencers, blockers, and objections.',
      'Articulate positioning and value proposition: core problem, differentiation, and messaging angle.',
      'Recommend and justify prioritized channels (outbound, content, paid, partnerships, communities) by expected ROI.',
      'Specify the sales motion: PLG, sales-led, or hybrid — with funnel shape and marketing-to-sales handoff.',
      'Recommend pricing model and packaging logic with monetization tradeoffs.',
      'Provide a 30/60/90-day execution roadmap with key actions, owners, and expected outcomes.',
      'Define success metrics: pipeline, conversion, revenue, and retention KPIs.',
      'Identify top risks, what must be true, and strategic compromises.',
    ],
    method: [
      'Prioritize pillars by what matters most for this specific objective — do not weight all sections equally.',
      'Make opinionated recommendations: say "do X because Y", not "consider X".',
      'Connect every recommendation to a measurable business outcome.',
    ],
    outputFormat: [TONE_LINES[tone], FORMAT_LINES[fmt], 'Use clear section headers, bullet points, and tables where they aid comparison or prioritization.'],
    qualityCriteria: [
      'Output must be decision-ready: a GTM lead could act on it immediately.',
      'Recommendations must be specific, prioritized, and commercially grounded.',
      'Avoid generic filler — every section must earn its place.',
    ],
  })
}

function buildImage(task: string): string {
  const subject =
    task
      .replace(
        /^(create|generate|make|draw|design|render|show|depict|illustrate)\s+(an?\s+)?(image|photo|picture|illustration|artwork|painting|render|scene|drawing)\s+(of\s+)?/i,
        '',
      )
      .trim() || task

  return [
    `Subject: ${subject}`,
    'Style: photorealistic, high-detail, professional visual direction unless the original prompt implies another style',
    'Composition: well-framed focal subject, balanced negative space, rule-of-thirds, clear foreground/midground/background separation',
    'Lighting: cinematic natural lighting with atmospheric depth, controlled highlights, and readable shadows',
    'Camera: eye-level perspective, sharp focus on the primary subject, shallow depth of field where appropriate',
    'Mood: visually compelling, cohesive, and aligned with the subject',
    'Negative Constraints: avoid blurry details, distorted anatomy, extra limbs, unreadable text, artifacts, overexposure, and cluttered composition',
    'Quality: 4K resolution, crisp textures, realistic materials, clean edges, high dynamic range, polished final render',
  ].join('\n')
}

// ── Improvements ───────────────────────────────────────────────────────────

function detectImprovements(analysis: PromptAnalysis, useCase: UseCase, tone: Tone, fmt: OutputFormat, rawPrompt: string): string[] {
  const items: string[] = []

  if (analysis.removedOpener) items.push('Removed weak opener and clarified the main task')

  if (useCase === 'image-generation') {
    items.push('Converted to structured image-generation prompt with technical fields')
    items.push('Added composition, lighting, mood, and quality directives')
  } else if (useCase === 'gtm') {
    items.push('Applied GTM Strategy Optimizer framework with 10-pillar structure')
    items.push('Added B2B SaaS strategist role with ICP, positioning, and sales motion requirements')
    if (!analysis.hasAudience) items.push('Added default mid-market B2B segment assumption')
    if (!analysis.hasConstraints) items.push('Added GTM constraints covering budget, timeline, and market maturity')
    items.push('Appended decision-ready success metrics and execution roadmap requirements')
  } else if (useCase === 'business') {
    items.push('Added business strategist role context for professional framing')
    items.push(`Applied "${tone}" tone instruction for stakeholder communication`)
    items.push(`Specified "${fmt.replace(/-/g, ' ')}" output format`)
    if (!analysis.hasAudience) items.push('Added default stakeholder audience assumption')
    if (!analysis.hasConstraints) items.push('Added business guidelines covering objectives, risks, and success metrics')
    items.push('Appended decision-ready success criteria')
  } else {
    if (useCase === 'general') {
      const domain = detectDomain(rawPrompt)
      if (domain) {
        items.push('Detected task domain and assigned specialist expert role')
        items.push('Replaced generic guidelines with domain-specific editing criteria')
      } else {
        items.push('Added role context for general use case')
      }
    } else {
      items.push(`Added role context for ${useCase} use case`)
    }
    items.push(`Applied "${tone}" tone instruction for consistent voice`)
    items.push(`Specified "${fmt.replace(/-/g, ' ')}" output format`)
    if (!analysis.hasAudience && useCase !== 'coding') items.push('Added default audience assumption to guide response depth')
    if (!analysis.hasConstraints) items.push('Added domain-specific requirements and quality constraints')
    items.push('Appended explicit success criteria for evaluating the response')
  }

  if (analysis.hasVaguePhrases) items.push('Replaced vague language with a specific, actionable task description')

  return items
}

// ── Missing details ────────────────────────────────────────────────────────

function detectMissing(rawPrompt: string, analysis: PromptAnalysis, useCase: UseCase): string[] {
  const items: string[] = []

  switch (useCase) {
    case 'general': {
      const domain = detectDomain(rawPrompt)
      if (domain) {
        items.push(...domain.missingHints)
      } else {
        if (!analysis.hasAudience) items.push('Target audience not specified')
        if (!analysis.hasLength) items.push('Desired response length or depth not mentioned')
        if (!analysis.hasConstraints) items.push('Output constraints or preferences not defined')
      }
      break
    }
    case 'writing':
      if (!analysis.hasAudience) items.push('Target audience not specified')
      if (!analysis.hasLength) items.push('Word count or desired length not defined')
      if (!analysis.hasConstraints) items.push('Genre, structure, or style constraints missing')
      break
    case 'coding':
      if (!LANG_RE.test(rawPrompt)) items.push('Programming language or framework not specified')
      if (!analysis.hasConstraints) items.push('Performance or compatibility requirements not defined')
      if (!analysis.hasLength) items.push('Expected scope (function, module, full app) not specified')
      break
    case 'marketing':
      if (!analysis.hasAudience) items.push('Target demographic not defined')
      items.push('Marketing channel or platform not specified')
      if (!analysis.hasConstraints) items.push('Brand voice or style guidelines missing')
      break
    case 'research':
      items.push('Preferred sources or citation format not specified')
      if (!analysis.hasLength) items.push('Scope or depth of analysis not defined')
      if (!analysis.hasConstraints) items.push('Specific research angle or focus area not clarified')
      break
    case 'image-generation':
      items.push('Art style not specified (realistic, anime, oil painting…)')
      items.push('Aspect ratio or dimensions not mentioned')
      items.push('Lighting, mood, or atmosphere not described')
      break
    case 'business':
      if (!analysis.hasAudience) items.push('Target stakeholders or decision-makers not specified')
      if (!analysis.hasConstraints) items.push('Budget, timeline, or resource constraints not defined')
      items.push('Industry or company context not provided')
      if (!analysis.hasLength) items.push('Scope or depth of analysis not specified')
      break
    case 'gtm':
      if (!analysis.hasAudience) items.push('Target segment (SMB/mid-market/enterprise) not specified')
      items.push('Product category and core differentiator not defined')
      if (!analysis.hasConstraints) items.push('Budget, team size, or go-live timeline not provided')
      items.push('Competitive landscape and current traction not mentioned')
      break
  }

  return items
}

// ── Main export ────────────────────────────────────────────────────────────

export function generateLocalOutput(
  rawPrompt: string,
  useCase: UseCase,
  tone: Tone,
  outputFormat: OutputFormat,
): OptimizedResult {
  const analysis = analyzePrompt(rawPrompt)
  const cleanedTask = cleanTask(rawPrompt)
  const taskType = detectTaskType(rawPrompt, useCase)
  const effectiveUseCase = mapTaskTypeToUseCase(taskType)
  const score = computeScore(analysis, taskType)
  const scoreBreakdown = computeScoreBreakdown(analysis, taskType)

  let prompt: string
  switch (effectiveUseCase) {
    case 'writing':           prompt = buildWriting(cleanedTask, tone, outputFormat, analysis); break
    case 'coding':            prompt = buildCoding(cleanedTask, tone, outputFormat, rawPrompt, analysis); break
    case 'marketing':         prompt = buildMarketing(cleanedTask, tone, outputFormat, analysis); break
    case 'research':          prompt = buildResearch(cleanedTask, tone, outputFormat, analysis); break
    case 'image-generation':  prompt = buildImage(cleanedTask); break
    case 'business':          prompt = buildBusiness(cleanedTask, tone, outputFormat, analysis); break
    case 'gtm':               prompt = buildGTM(cleanedTask, tone, outputFormat, analysis); break
    default:                  prompt = buildGeneral(cleanedTask, tone, outputFormat, analysis, rawPrompt)
  }

  const afterAnalysis = analyzePrompt(prompt)
  const afterScore = computeScore(afterAnalysis, taskType)
  const afterScoreBreakdown = computeScoreBreakdown(afterAnalysis, taskType)

  return {
    prompt,
    taskType,
    assumptions: detectAssumptions(analysis, effectiveUseCase, rawPrompt),
    improvements: detectImprovements(analysis, effectiveUseCase, tone, outputFormat, rawPrompt),
    score,
    scoreBreakdown,
    afterScore,
    afterScoreBreakdown,
    missingDetails: detectMissing(rawPrompt, analysis, effectiveUseCase).slice(0, 3),
    rawPromptSnapshot: rawPrompt,
  }
}
