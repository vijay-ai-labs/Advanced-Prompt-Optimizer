// The validation engine. The rules themselves live in promptCategories.js —
// this file builds the context they read, walks them in order, and shapes the
// first match into a verdict.
//
// Plain ESM on purpose: the React client imports it through promptValidation.d.ts
// and server.js imports the same file at runtime. One rule set, so the client gate
// and the API can never disagree about what counts as junk. Every rule is a local
// heuristic, so all of it works with no API key and no network.
//
// Three levels:
//   block — nothing here can become a prompt
//   warn  — a real request, but optimizing it would be guesswork; needs an override
//   ok    — proceed

import {
  ORDERED_RULES,
  NO_SUBJECT_CODES,
  ACTION_VERBS,
  SECTION_LABEL_RE,
  TOKEN_RE,
  contentWords,
} from './promptCategories.js'

/** A letter belonging to a script other than Latin — Devanagari, CJK, Cyrillic. */
const NON_LATIN_SCRIPT_RE = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u

/**
 * Clarifier chips offered for a prompt with no subject, keyed by use case.
 * The label is what the user sees; `insert` is appended to the textarea so the
 * chip leaves the cursor in a sentence the user can finish.
 */
const CLARIFIERS = {
  writing: [
    { label: '+ topic', insert: ' about ' },
    { label: '+ audience', insert: ' for ' },
    { label: '+ length', insert: ', around 800 words' },
    { label: '+ angle', insert: ', focused on ' },
  ],
  coding: [
    { label: '+ language', insert: ' in ' },
    { label: '+ what it should do', insert: ' that ' },
    { label: '+ error message', insert: '. The error is: ' },
    { label: '+ stack', insert: '. Stack: ' },
  ],
  'image-generation': [
    { label: '+ subject', insert: ' of ' },
    { label: '+ style', insert: ', in the style of ' },
    { label: '+ mood', insert: ', mood: ' },
    { label: '+ setting', insert: ', set in ' },
  ],
  marketing: [
    { label: '+ product', insert: ' for ' },
    { label: '+ audience', insert: ', targeting ' },
    { label: '+ channel', insert: ', for the channel ' },
    { label: '+ goal', insert: '. Goal: ' },
  ],
  research: [
    { label: '+ subject', insert: ' on ' },
    { label: '+ scope', insert: ', limited to ' },
    { label: '+ time frame', insert: ', covering ' },
    { label: '+ deliverable', insert: '. Deliver as ' },
  ],
  business: [
    { label: '+ objective', insert: ' to ' },
    { label: '+ company or product', insert: ' for ' },
    { label: '+ constraints', insert: '. Constraints: ' },
    { label: '+ success metric', insert: '. Success looks like ' },
  ],
  gtm: [
    { label: '+ product', insert: ' for ' },
    { label: '+ target segment', insert: ', targeting ' },
    { label: '+ stage', insert: '. Stage: ' },
    { label: '+ goal', insert: '. Goal: ' },
  ],
  general: [
    { label: '+ topic', insert: ' about ' },
    { label: '+ audience', insert: ' for ' },
    { label: '+ goal', insert: '. The goal is ' },
    { label: '+ constraints', insert: '. Constraints: ' },
  ],
}

/**
 * Appended to the model's user message when a subject-less prompt is optimized
 * anyway. Overrides the "infer the most reasonable default" instruction in the
 * system prompt, which is what makes the model invent a topic out of nothing.
 */
export const NO_TOPIC_DIRECTIVE = [
  '## Missing Topic — Do Not Invent One',
  'The rough prompt names an action but no subject. You MUST NOT choose a topic,',
  'audience, product, or scenario on the user\'s behalf.',
  '- Put a [USER INSERTS: ...] token everywhere a specific is missing',
  '- Do not emit an "Assumed:" line that supplies the missing subject',
  '- List every missing specific in missingDetails',
].join('\n')

function tokenize(text) {
  return String(text).toLowerCase().match(TOKEN_RE) ?? []
}

/** Sentences that open with an action verb — one per distinct task asked for. */
function countImperativeSentences(text) {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => {
      const first = (s.toLowerCase().match(TOKEN_RE) ?? [])[0]
      return first !== undefined && ACTION_VERBS.has(first)
    }).length
}

/** Lines that look like "Role:" or "**Output Format:**" — the shape this tool emits. */
function countSectionLabels(text) {
  return text.split('\n').filter((line) => {
    const match = SECTION_LABEL_RE.exec(line)
    return match !== null && match[1].trim().split(/\s+/).length <= 5
  }).length
}

/**
 * Everything the rules read, computed once so no rule re-tokenizes.
 */
function buildContext(rawPrompt) {
  const text = String(rawPrompt ?? '').trim()
  const tokens = tokenize(text)
  const alphaTokens = tokens.filter((t) => !/^\d+$/.test(t))

  return {
    text,
    lower: text.toLowerCase(),
    charCount: text.length,
    tokens,
    alphaTokens,
    wordCount: tokens.length,
    content: contentWords(tokens),
    hasActionVerb: tokens.some((t) => ACTION_VERBS.has(t)),
    // Script-based, not "is this token plain a-z". Testing the token shape would
    // call "user's" and "gpt4" non-Latin and skip every rule below. Latin-with-
    // accents stays in scope — "Écris un article" is judged like any other prompt.
    hasNonLatin: NON_LATIN_SCRIPT_RE.test(text),
    sectionLabelCount: countSectionLabels(text),
    imperativeSentences: countImperativeSentences(text),
  }
}

const OK = { level: 'ok', code: 'ok', group: 'ok', title: '', message: '', suggestions: [], example: '' }

function clarifiersFor(useCase) {
  return CLARIFIERS[useCase] ?? CLARIFIERS.general
}

/**
 * Classify a raw prompt before any optimization happens. Walks the taxonomy in
 * order and returns the first rule that matches; see promptCategories.js for why
 * that order is what it is.
 *
 * @param {string} rawPrompt raw textarea contents, untrimmed
 * @param {string} [useCase] selected or auto-detected use case, only used to pick clarifier chips
 */
export function validatePrompt(rawPrompt, useCase = 'general') {
  const ctx = buildContext(rawPrompt)

  for (const rule of ORDERED_RULES) {
    if (!rule.test(ctx)) continue
    if (rule.level === 'ok') return OK

    return {
      level: rule.level,
      code: rule.code,
      group: rule.group,
      title: rule.title,
      message: rule.message,
      example: rule.example ?? '',
      suggestions: rule.suggests ? clarifiersFor(useCase).map((c) => c.label) : [],
    }
  }

  return OK
}

/** True when the model must use placeholders rather than invent the subject. */
export function requiresPlaceholders(code) {
  return NO_SUBJECT_CODES.has(code)
}

/** Chip label → the text appended to the textarea when it is clicked. */
export function clarifierInsert(useCase, label) {
  const found = clarifiersFor(useCase).find((c) => c.label === label)
  return found ? found.insert : ' '
}

/** Advisory verdict for a prompt whose content contradicts the selected mode. */
export function mismatchVerdict(selectedLabel, detectedLabel) {
  return {
    level: 'warn',
    code: 'mode-mismatch',
    group: 'wrong-shape',
    title: `This reads like a ${detectedLabel} task`,
    message: `You selected ${selectedLabel}, but nothing in the prompt matches it. Optimizing as ${selectedLabel} would produce a prompt for the wrong kind of output.`,
    suggestions: [],
    example: '',
  }
}
