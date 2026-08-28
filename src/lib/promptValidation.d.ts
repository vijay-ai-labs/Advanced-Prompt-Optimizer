import type { UseCase } from './types'

export type ValidationLevel = 'ok' | 'warn' | 'block'

export type ValidationGroup =
  | 'ok'
  | 'nothing-there'
  | 'social'
  | 'app-directed'
  | 'no-task'
  | 'wrong-shape'
  | 'integrity'

export type ValidationCode =
  | 'ok'
  // nothing there
  | 'empty'
  | 'too-short'
  | 'no-letters'
  | 'emoji-only'
  | 'gibberish'
  | 'repeated-spam'
  // social
  | 'greeting'
  | 'small-talk'
  | 'identity-question'
  | 'capability-question'
  | 'emotional-statement'
  // aimed at the app
  | 'app-command'
  | 'meta-request'
  | 'placeholder-echo'
  // words, but no task
  | 'no-topic'
  | 'bare-entity'
  | 'dangling-reference'
  | 'declarative'
  | 'trivial-question'
  | 'math-expression'
  // wrong shape
  | 'mode-mismatch'
  | 'multi-task'
  | 'already-optimized'
  | 'too-long'
  | 'url-only'
  // integrity
  | 'prompt-injection'

export interface Verdict {
  level: ValidationLevel
  code: ValidationCode
  group: ValidationGroup
  /** Panel heading. Empty when level is 'ok'. */
  title: string
  /** One or two sentences: what is wrong and what to do about it. */
  message: string
  /** A working prompt offered as a one-click fix. Empty when the rule has none. */
  example: string
  /** Clarifier chip labels. Populated for subject-less prompts only. */
  suggestions: string[]
}

/** Directive appended to the model's user message for subject-less prompts. */
export const NO_TOPIC_DIRECTIVE: string

/**
 * Classify a raw prompt before any optimization happens.
 * `useCase` only selects which clarifier chips are offered.
 */
export function validatePrompt(rawPrompt: string, useCase?: UseCase): Verdict

/** True when the model must use placeholders rather than invent the subject. */
export function requiresPlaceholders(code: ValidationCode | string): boolean

/** Chip label -> the text appended to the textarea when it is clicked. */
export function clarifierInsert(useCase: UseCase, label: string): string

/** Advisory verdict for a prompt whose content contradicts the selected mode. */
export function mismatchVerdict(selectedLabel: string, detectedLabel: string): Verdict
