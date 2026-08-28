import type { ValidationCode, ValidationGroup, ValidationLevel } from './promptValidation'

/** Everything the rules read, computed once per validatePrompt call. */
export interface RuleContext {
  text: string
  lower: string
  charCount: number
  tokens: string[]
  alphaTokens: string[]
  wordCount: number
  content: string[]
  hasActionVerb: boolean
  hasNonLatin: boolean
  sectionLabelCount: number
  imperativeSentences: number
}

export interface CategoryRule {
  code: ValidationCode
  /** 'ok' entries are stops, not categories — they accept and end the walk. */
  level: ValidationLevel
  group: ValidationGroup
  phase: 'shape' | 'intent' | 'substance'
  title: string
  message: string
  example?: string
  /** Offer use-case clarifier chips alongside the message. */
  suggests?: boolean
  test: (ctx: RuleContext) => boolean
}

/** The taxonomy, in evaluation order. First match wins. */
export const ORDERED_RULES: CategoryRule[]

/** Codes where the model must not invent the missing subject. */
export const NO_SUBJECT_CODES: Set<string>

export const FILLER_INPUTS: Set<string>
export const STOPWORDS: Set<string>
export const ACTION_VERBS: Set<string>
export const GENERIC_TASK_NOUNS: Set<string>
export const ASCII_WORD_RE: RegExp
export const HAS_LETTER_RE: RegExp
export const TOKEN_RE: RegExp
export const SECTION_LABEL_RE: RegExp

export function looksUnwordish(token: string): boolean
export function contentWords(tokens: string[]): string[]
