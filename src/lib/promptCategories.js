// The taxonomy of input that should never be optimized, as data.
//
// Every category is one object in ORDERED_RULES below. The engine in
// promptValidation.js builds a context once, walks this list, and returns the
// first rule whose `test` passes — so adding a category means adding one object
// here and nothing else. Plain ESM with no dependencies: server.js loads this
// file directly at runtime, and every rule is a local heuristic, so the whole
// taxonomy works with no API key and no network.
//
// Rule shape:
//   code    stable identifier, surfaced in the API 400 body
//   level   'block' (unusable) | 'warn' (usable with an override) | 'ok' (stop, accept)
//   group   which family it belongs to, for grouping in the UI
//   title   panel heading
//   message one or two sentences: what is wrong and what to do
//   example a prompt that fixes it, offered as a one-click button
//   suggests set on rules that should also offer use-case clarifier chips
//   test    (ctx) => boolean

// ── Lexicon ────────────────────────────────────────────────────────────────

/** Inputs that are complete in themselves but are not a task. */
export const FILLER_INPUTS = new Set([
  'hi', 'hii', 'hiii', 'hello', 'helo', 'hey', 'heya', 'yo', 'sup', 'hola',
  'test', 'testing', 'tests', 'ok', 'okay', 'okey', 'k', 'yes', 'no', 'yep', 'nope',
  'thanks', 'thank', 'thankyou', 'thx', 'ty', 'pls', 'please',
  'asdf', 'asdfg', 'abc', 'abcd', 'blah', 'foo', 'bar', 'baz', 'lorem', 'ipsum',
  'idk', 'hmm', 'hmmm', 'huh', 'wow', 'lol',
])

/** Grammar glue — carries no topic. */
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'so', 'as', 'of', 'to',
  'in', 'on', 'at', 'by', 'for', 'from', 'with', 'without', 'into', 'onto', 'about',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does', 'did', 'done',
  'have', 'has', 'had', 'can', 'could', 'will', 'would', 'shall', 'should', 'may',
  'might', 'must', 'me', 'my', 'mine', 'i', 'you', 'your', 'yours', 'we', 'our', 'ours',
  'us', 'it', 'its', 'this', 'that', 'these', 'those', 'there', 'here', 'some', 'any',
  'all', 'more', 'most', 'very', 'just', 'now', 'new', 'good', 'nice', 'best', 'better',
  'up', 'out', 'down', 'over', 'again', 'also', 'too', 'not', 'only', 'one', 'like',
])

/** What to do — an action alone still leaves "about what?" unanswered. */
export const ACTION_VERBS = new Set([
  'write', 'writing', 'create', 'creating', 'make', 'making', 'build', 'building',
  'generate', 'generating', 'draft', 'drafting', 'compose', 'produce', 'prepare',
  'fix', 'fixing', 'debug', 'debugging', 'solve', 'solving', 'improve', 'improving',
  'optimize', 'optimise', 'refactor', 'rewrite', 'rewriting', 'edit', 'editing',
  'explain', 'explaining', 'describe', 'summarize', 'summarise', 'analyze', 'analyse',
  'help', 'give', 'show', 'tell', 'need', 'want', 'get', 'find', 'add', 'design',
  'plan', 'planning', 'suggest', 'recommend', 'review', 'check', 'update', 'change',
])

/** The output artifact — "a blog" names the container, never the subject. */
export const GENERIC_TASK_NOUNS = new Set([
  'blog', 'blogs', 'post', 'posts', 'article', 'articles', 'essay', 'essays',
  'content', 'copy', 'text', 'story', 'stories', 'newsletter', 'caption',
  'code', 'script', 'scripts', 'program', 'app', 'apps', 'website', 'site', 'page',
  'function', 'bug', 'bugs', 'error', 'errors', 'issue', 'issues', 'project',
  'image', 'images', 'picture', 'pictures', 'photo', 'photos', 'art', 'drawing',
  'email', 'emails', 'message', 'letter', 'report', 'reports', 'doc', 'document',
  'prompt', 'prompts', 'thing', 'things', 'something', 'stuff', 'anything',
  'idea', 'ideas', 'stuffs', 'work', 'task', 'tasks',
])

/** Adjacent keys — the signature of a hand resting on the keyboard. */
const KEYBOARD_RUNS = [
  'asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl',
  'qwer', 'wert', 'erty', 'rtyu', 'tyui', 'yuio', 'uiop',
  'zxcv', 'xcvb', 'cvbn', 'vbnm',
  'lkjh', 'kjhg', 'poiu', 'oiuy', 'mnbv', 'trew', 'ewq',
  '1234', '2345', '3456', '4567',
]

/** Words that stand in for a subject the optimizer cannot see. */
const PRONOUNS = new Set(['it', 'this', 'that', 'them', 'these', 'those', 'they'])

const COPULAS = new Set(['is', 'are', 'was', 'were', 'has', 'have', 'had'])

/** UI actions typed into the prompt box instead of clicked. */
const APP_COMMANDS = new Set([
  'clear', 'reset', 'undo', 'redo', 'stop', 'cancel', 'close', 'exit', 'quit',
  'back', 'next', 'save', 'copy', 'paste', 'delete', 'remove', 'refresh', 'restart',
  'history', 'settings', 'login', 'logout', 'signin', 'home', 'menu', 'run', 'start',
])

// Two different vowel sets on purpose. "Does this token have a vowel at all?"
// must exclude y, or xyz reads as a word. The consonant-run test must include y,
// or rhythms reads as a seven-consonant mash.
const HAS_VOWEL_RE = /[aeiou]/
const CONSONANT_RUN_RE = /[^aeiouy]{5,}/
export const ASCII_WORD_RE = /^[a-z]+$/
export const HAS_LETTER_RE = /\p{L}/u
export const TOKEN_RE = /[\p{L}\p{N}']+/gu

// ── Anchored patterns ──────────────────────────────────────────────────────
//
// Every social/meta pattern below is anchored to the whole input. That is the
// entire false-positive defence: "how are you" is small talk, but "How are you
// going to fix this memory leak?" is a real question and must pass untouched.

const SMALL_TALK_RES = [
  /^(hi|hey|hello|yo)?[\s,!.]*how\s+(are|r)\s+(you|u|things|ya)\b[\s?!.]*$/i,
  /^(hi|hey|hello)?[\s,!.]*(how('?s|\s+is)\s+(it\s+going|your\s+day|life)|what'?s\s+up|whats\s+up|how\s+do\s+you\s+do)[\s?!.]*$/i,
  /^good\s+(morning|afternoon|evening|night)[\s,!.]*(everyone|there|sir|mam)?[\s?!.]*$/i,
  /^(nice|good)\s+to\s+(meet|see)\s+you[\s?!.]*$/i,
  /^are\s+you\s+(there|ok|okay|alive|awake|busy|free)[\s?!.]*$/i,
  /^how\s+(are\s+you\s+)?(doing|going)[\s?!.]*$/i,
]

const IDENTITY_RES = [
  /^(who|what)\s+(are|r)\s+(you|u)\b[\s?!.]*$/i,
  /^are\s+(you|u)\s+(an?\s+)?(ai|bot|robot|human|real|chatgpt|gpt|claude|gemini|llm|machine|model)\b[\s?!.]*$/i,
  /^what'?s?\s+(is\s+)?your\s+name\b[\s?!.]*$/i,
  /^(which|what)\s+(ai\s+|llm\s+|language\s+)?model\s+(are\s+you|do\s+you\s+use)\b[\s?!.]*$/i,
  /^introduce\s+yourself[\s?!.]*$/i,
]

const CAPABILITY_RES = [
  /^what\s+(can|do)\s+(you|u)\s+do\b[\s?!.]*$/i,
  /^how\s+(do|does)\s+(you|this|it)\s+work\b[\s?!.]*$/i,
  /^what\s+(is|does)\s+this\s*(app|site|tool|thing|do)?\b[\s?!.]*$/i,
  /^how\s+(do\s+i|to)\s+use\s+(this|it|the\s+app)\b[\s?!.]*$/i,
  /^what\s+are\s+your\s+(features|capabilities|limits)\b[\s?!.]*$/i,
  /^(help|help\s+me|explain\s+yourself|guide\s+me)[\s?!.]*$/i,
]

const EMOTION_RES = [
  /^(i'?m|i\s+am|im)\s+(bored|sad|happy|tired|confused|lost|angry|hungry|lonely|excited|fine|good|ok|okay)\b[\s?!.]*$/i,
  /^i\s+(love|hate|like|miss)\s+(you|this|it|that)[\s?!.]*$/i,
  /^(good|great|awesome|cool|amazing|wow|haha|hehe|nice\s+one)[\s?!.]*$/i,
  /^how\s+(are\s+)?(u|you)\s+feel(ing)?\b[\s?!.]*$/i,
]

const META_RES = [
  // "fix" is deliberately absent: "fix it" is a dangling reference to real work,
  // not a request to run the optimizer, and it needs that rule's message instead.
  /^(please\s+)?(optimi[sz]e|improve|enhance|refine|rewrite)\s+(this|it|that|my|the)\s*(prompt|input|text|one)?[\s?!.]*$/i,
  /^(make|do)\s+(it|this|that)\s+(better|good|nice|great)[\s?!.]*$/i,
  /^(optimi[sz]e|improve|enhance)[\s?!.]*$/i,
  /^give\s+me\s+(a\s+)?(good\s+)?prompt[\s?!.]*$/i,
]

// Anchored to the start of the input or of a sentence. A real attempt leads with
// the instruction; a legitimate prompt that merely mentions the phrase —
// "draft release notes telling users to ignore previous instructions" — does not.
// This tool only rewrites text rather than executing it, so a false positive
// costs the user more than a false negative costs anyone.
const INJECTION_RES = [
  /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier|the\s+above)\s+(instructions?|prompts?|rules?|directions?)/i,
  /disregard\s+(the\s+)?(above|previous|prior|earlier|all)\b/i,
  /(reveal|show|print|repeat|output|display)\s+(me\s+)?(your|the)\s+(system|initial|original|hidden)\s+(prompt|instructions?|message)/i,
  /forget\s+(everything|all)\s+(you|your|above)/i,
  /you\s+are\s+now\s+(dan|jailbroken|unrestricted|free\s+of)/i,
  /act\s+as\s+(if\s+)?you\s+have\s+no\s+(restrictions?|rules?|filters?|guidelines?)/i,
].map((re) => new RegExp(`(^|[.!?\\n]\\s*)\\s*${re.source}`, 'i'))

/** The textarea placeholder and example chips, submitted verbatim. */
const PLACEHOLDER_ECHOES = new Set([
  'e.g. write me a blog post about ai trends in 2025...',
  'write me a blog post about ai trends in 2025...',
  'write me a blog post about ai trends in 2025',
  'your prompt',
])

const URL_ONLY_RE = /^(https?:\/\/|www\.)\S+$/i
const MATH_ONLY_RE = /^[\s\d+\-*/^%().,=]+$/
const CODE_LINE_RE = /[{};]|=>|^\s*(def|class|function|import|export|const|let|var|public|private|return|if|for|while|from|package)\b|^\s{2,}\S/
export const SECTION_LABEL_RE = /^\s*\*{0,2}([A-Z][A-Za-z0-9 &/'-]{1,40})\*{0,2}\s*:\s*/

const MAX_PROMPT_CHARS = 6000

// ── Example prompts offered as the one-click fix ───────────────────────────

const EX_BLOG = 'Write a blog post about remote work for engineering managers'
const EX_CODE = 'Fix the memory leak in my React useEffect hook'
const EX_RESEARCH = 'Analyze how remote work affects engineering team productivity'

// ── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Keyboard mashing rather than a word. Only ever judges plain ASCII tokens;
 * Devanagari, Tamil, CJK, Cyrillic and friends return false unconditionally so a
 * non-English prompt can never be called gibberish.
 */
export function looksUnwordish(token) {
  if (!ASCII_WORD_RE.test(token)) return false
  if (!HAS_VOWEL_RE.test(token)) return true
  if (token.length < 4) return false
  if (/(.)\1{3,}/.test(token)) return true
  if (CONSONANT_RUN_RE.test(token)) return true
  return KEYBOARD_RUNS.some((run) => token.includes(run))
}

/**
 * Tokens that carry actual subject matter: not glue, not the verb, not the
 * artifact name. Non-Latin tokens always count — they can't be checked against
 * these English lists, and must never be penalised for it.
 */
export function contentWords(tokens) {
  return tokens.filter((t) => {
    if (/^\d+$/.test(t)) return false
    if (!ASCII_WORD_RE.test(t)) return true
    if (t.length < 2) return false
    return !STOPWORDS.has(t) && !ACTION_VERBS.has(t) && !GENERIC_TASK_NOUNS.has(t) && !FILLER_INPUTS.has(t)
  })
}

const matchesAny = (patterns, text) => patterns.some((re) => re.test(text))

function maxTokenRepeat(tokens) {
  const counts = new Map()
  let max = 0
  for (const t of tokens) {
    const n = (counts.get(t) ?? 0) + 1
    counts.set(t, n)
    if (n > max) max = n
  }
  return max
}

// ── The registry ───────────────────────────────────────────────────────────
//
// Order matters more than any individual rule. Three phases:
//   shape     — judges the raw string, before it is read as language
//   intent    — judges what the input *is*
//   substance — judges something that already looks like a task
//
// The 'ok' entries are stops, not categories: once input proves it is real
// language with real substance, the vagueness heuristics below them are skipped.

export const ORDERED_RULES = [
  // ── Phase 1: shape ───────────────────────────────────────────────────────
  {
    code: 'empty', level: 'block', group: 'nothing-there', phase: 'shape',
    title: 'Enter a prompt first',
    message: 'There is nothing to optimize. Describe the task you want the AI to carry out.',
    example: EX_BLOG,
    test: (c) => c.text.length === 0,
  },
  {
    code: 'too-long', level: 'warn', group: 'wrong-shape', phase: 'shape',
    title: 'This is a document, not a prompt',
    message: `Over ${MAX_PROMPT_CHARS.toLocaleString('en-US')} characters. Optimizing works on the instruction, not the source material — paste the task and reference the material separately.`,
    test: (c) => c.charCount > MAX_PROMPT_CHARS,
  },
  {
    code: 'emoji-only', level: 'block', group: 'nothing-there', phase: 'shape',
    title: 'Emoji are not a task',
    message: 'There are no words here to work from. Describe what you want the AI to do.',
    example: EX_BLOG,
    test: (c) => !HAS_LETTER_RE.test(c.text) && /\p{Extended_Pictographic}/u.test(c.text),
  },
  {
    code: 'math-expression', level: 'block', group: 'no-task', phase: 'shape',
    title: 'That is a calculation, not a prompt',
    message: 'An optimized prompt cannot improve arithmetic — put the sum straight into a calculator or the AI itself.',
    example: EX_RESEARCH,
    test: (c) => MATH_ONLY_RE.test(c.text) && /\d/.test(c.text),
  },
  {
    code: 'no-letters', level: 'block', group: 'nothing-there', phase: 'shape',
    title: 'No readable request found',
    message: 'This input is only symbols or numbers. Describe the task in words, e.g. "Write a launch email for a new pricing tier".',
    example: EX_BLOG,
    test: (c) => !HAS_LETTER_RE.test(c.text),
  },
  {
    code: 'url-only', level: 'block', group: 'wrong-shape', phase: 'shape',
    title: 'A link on its own is not a task',
    message: 'The optimizer cannot open pages. Say what you want done with the page — summarize it, critique it, extract data from it.',
    example: 'Summarize this article and list its three strongest claims: https://example.com',
    test: (c) => URL_ONLY_RE.test(c.text),
  },
  {
    code: 'prompt-injection', level: 'block', group: 'integrity', phase: 'shape',
    title: 'That targets the optimizer, not a task',
    message: 'Instructions like this are aimed at the tool itself rather than describing work to be done. Describe the task you want a prompt for.',
    example: EX_BLOG,
    test: (c) => matchesAny(INJECTION_RES, c.text),
  },
  // ── Phase 2: intent ──────────────────────────────────────────────────────
  {
    code: 'placeholder-echo', level: 'block', group: 'app-directed', phase: 'intent',
    title: 'That is the example text',
    message: 'This is the placeholder shown in the box, not your own request. Replace it with the task you actually want done.',
    example: EX_BLOG,
    test: (c) => PLACEHOLDER_ECHOES.has(c.lower),
  },
  {
    code: 'greeting', level: 'block', group: 'social', phase: 'intent',
    title: 'That is a greeting, not a task',
    message: 'Tell the optimizer what you want done — it turns a task description into a better prompt.',
    example: EX_BLOG,
    test: (c) => c.alphaTokens.length > 0 && c.alphaTokens.every((t) => FILLER_INPUTS.has(t)),
  },
  // After greeting, not before: "HI" is two characters, and being told it is a
  // greeting is more useful than being told it is short.
  {
    code: 'too-short', level: 'block', group: 'nothing-there', phase: 'intent',
    title: 'Too short to optimize',
    message: 'A prompt needs at least a few words describing the task and its subject.',
    example: EX_BLOG,
    test: (c) => c.text.length < 3,
  },
  {
    code: 'small-talk', level: 'block', group: 'social', phase: 'intent',
    title: 'That is small talk, not a task',
    message: 'This is a prompt optimizer, not a chat partner. Describe the work you want an AI to do and it will build the prompt for it.',
    example: EX_BLOG,
    test: (c) => matchesAny(SMALL_TALK_RES, c.text),
  },
  {
    code: 'identity-question', level: 'block', group: 'social', phase: 'intent',
    title: 'Nothing to optimize in a question about the tool',
    message: 'This tool rewrites your task into a stronger prompt — it does not answer questions about itself. Describe the task instead.',
    example: EX_CODE,
    test: (c) => matchesAny(IDENTITY_RES, c.text),
  },
  {
    code: 'capability-question', level: 'block', group: 'social', phase: 'intent',
    title: 'Here is what to type instead',
    message: 'Paste any rough request — a blog idea, a bug, a strategy question — and this turns it into a structured, model-ready prompt. Try the example below.',
    example: EX_BLOG,
    test: (c) => matchesAny(CAPABILITY_RES, c.text),
  },
  {
    code: 'emotional-statement', level: 'block', group: 'social', phase: 'intent',
    title: 'No task found in that',
    message: 'That is a statement about you rather than work to be done. Describe a task and the optimizer will build a prompt for it.',
    example: EX_BLOG,
    test: (c) => matchesAny(EMOTION_RES, c.text),
  },
  {
    code: 'app-command', level: 'block', group: 'app-directed', phase: 'intent',
    title: 'That is a button, not a prompt',
    message: 'Actions like this are the controls beside the box, not text to optimize. Type the task you want a prompt for.',
    example: EX_CODE,
    test: (c) =>
      c.alphaTokens.length > 0 && c.alphaTokens.length <= 2 &&
      c.alphaTokens.every((t) => APP_COMMANDS.has(t)),
  },
  {
    code: 'meta-request', level: 'block', group: 'app-directed', phase: 'intent',
    title: 'Nothing supplied to optimize',
    message: 'Optimizing is what the button does. Paste the rough prompt you want improved and it will be rewritten.',
    example: EX_BLOG,
    test: (c) => matchesAny(META_RES, c.text),
  },
  {
    code: 'repeated-spam', level: 'block', group: 'nothing-there', phase: 'intent',
    title: 'That is the same word repeated',
    message: 'Repetition carries no task. Describe what you want the AI to do.',
    example: EX_BLOG,
    test: (c) =>
      c.alphaTokens.length >= 4 &&
      new Set(c.alphaTokens).size <= 2 &&
      maxTokenRepeat(c.alphaTokens) >= 4,
  },
  {
    code: 'gibberish', level: 'block', group: 'nothing-there', phase: 'intent',
    title: 'This does not look like a real request',
    message: 'No recognisable words found. Describe what you want the AI to do in plain language.',
    example: EX_BLOG,
    test: (c) => c.alphaTokens.length > 0 && c.alphaTokens.every(looksUnwordish),
  },

  // Past this point every rule reads English word lists and word boundaries.
  // Chinese and Japanese have neither — the whole sentence tokenizes as one
  // "word" — so judging their topic here would only produce false warnings.
  {
    code: 'ok', level: 'ok', group: 'ok', phase: 'intent',
    title: '', message: '',
    test: (c) => c.hasNonLatin,
  },

  // ── Phase 3: substance ───────────────────────────────────────────────────
  //
  // These two run before the escape valve: a pasted document is long and full of
  // content words, so an escape valve above them would hide both forever.
  {
    code: 'already-optimized', level: 'warn', group: 'wrong-shape', phase: 'substance',
    title: 'This prompt is already structured',
    message: 'It already carries labelled sections, so re-optimizing mostly reshuffles it. Optimize anyway if you want a second pass.',
    test: (c) => c.sectionLabelCount >= 4,
  },
  {
    code: 'multi-task', level: 'warn', group: 'wrong-shape', phase: 'substance',
    title: 'Several unrelated tasks in one prompt',
    message: 'One prompt per task produces far better output than one prompt covering three. Split them, or optimize anyway to get a combined prompt.',
    test: (c) => c.imperativeSentences >= 3,
  },

  // The escape valve. Anything with real length and real substance has proved it
  // is a task, and must not be second-guessed by the vagueness rules below.
  {
    code: 'ok', level: 'ok', group: 'ok', phase: 'substance',
    title: '', message: '',
    test: (c) => c.tokens.length >= 6 && c.content.length >= 2,
  },

  {
    code: 'trivial-question', level: 'warn', group: 'no-task', phase: 'substance',
    title: 'Nothing here to optimize',
    message: 'A short factual question does not get better answers from a longer prompt — ask the AI directly. Optimizing helps when the task has scope, audience, or format to pin down.',
    example: EX_RESEARCH,
    test: (c) => c.wordCount <= 6 && /^(what|who|when|where)\s+(is|are|was|were)\b/i.test(c.text),
  },
  {
    code: 'declarative', level: 'warn', group: 'no-task', phase: 'substance',
    title: 'That is a statement, not a request',
    message: 'Nothing here asks for anything. Add what you want done with it — explained, fixed, analysed, written about.',
    example: EX_RESEARCH,
    test: (c) =>
      !c.hasActionVerb && !c.text.includes('?') &&
      c.wordCount >= 3 && c.wordCount <= 8 &&
      c.tokens.some((t) => COPULAS.has(t)),
  },
  {
    code: 'dangling-reference', level: 'warn', group: 'no-task', phase: 'substance',
    title: 'Refers to something the optimizer cannot see',
    message: '"it", "this" and "that" point at context this tool does not have. Name the thing you want worked on.',
    suggests: true,
    test: (c) =>
      c.hasActionVerb && c.content.length === 0 && c.wordCount <= 5 &&
      c.tokens.some((t) => PRONOUNS.has(t)),
  },
  {
    code: 'no-topic', level: 'warn', group: 'no-task', phase: 'substance',
    title: 'Needs a topic before optimizing',
    message: 'This says what to do but not what it is about. Without a subject the optimizer would have to invent one.',
    suggests: true,
    test: (c) => c.content.length === 0,
  },
  {
    code: 'bare-entity', level: 'warn', group: 'no-task', phase: 'substance',
    title: 'Names a subject but not a task',
    message: 'This is a topic with nothing to do to it. Add the action you want taken — explain it, compare it, write about it.',
    suggests: true,
    test: (c) => c.wordCount <= 3 && !c.hasActionVerb && !c.text.includes('?'),
  },
]

/** Codes where the model must not invent the missing subject. */
export const NO_SUBJECT_CODES = new Set(['no-topic', 'bare-entity', 'dangling-reference'])
