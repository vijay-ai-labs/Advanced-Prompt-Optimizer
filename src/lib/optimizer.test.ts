import { describe, expect, it } from 'vitest'
import type { UseCase } from './types'
import { analyzePrompt, computeScore, computeScoreBreakdown, generateLocalOutput } from './optimizer'

// Regression cover for the Structure score. The scorer reads section labels out
// of prompt text, and the prompt text comes from two producers that decorate
// labels differently: the local templates in optimizer.ts and the model backend
// in server.js. When either producer's wording drifts away from what the scorer
// recognises, Structure silently reports 0 and the total lands ~15 points low.
// These tests pin both sides of that contract.

function structureScore(text: string, taskType?: string): number {
  const row = computeScoreBreakdown(analyzePrompt(text), taskType).find((c) => c.label === 'Structure')
  if (!row) throw new Error(`No Structure row for taskType "${taskType}"`)
  return row.score
}

describe('Structure score — locally built prompts', () => {
  // Every template routes through buildStrongPrompt, so every one of them must
  // emit labels the scorer recognises.
  const useCases: Array<[UseCase, string]> = [
    ['coding',    'Fix the memory leak in my React useEffect hook'],
    ['general',   'Explain how photosynthesis works'],
    ['writing',   'Write a blog post about remote work'],
    ['marketing', 'Create an ad campaign for a new coffee brand'],
    ['research',  'Analyze the EV market in Europe'],
    ['business',  'Build a plan to cut operating costs'],
    ['gtm',       'Launch our B2B analytics SaaS product'],
  ]

  it.each(useCases)('%s scores full Structure and a perfect total', (useCase, rawPrompt) => {
    const result = generateLocalOutput(rawPrompt, useCase, 'professional', 'paragraph')

    expect(structureScore(result.prompt, result.taskType)).toBe(15)
    expect(computeScore(analyzePrompt(result.prompt), result.taskType)).toBe(100)
  })

  it('separates sections with a blank line', () => {
    const { prompt } = generateLocalOutput('Explain recursion', 'coding', 'professional', 'paragraph')

    expect(prompt).toMatch(/^Role:\n/)
    expect(prompt).toContain('\n\nObjective:\n')
  })
})

describe('Structure score — model backend prompt shapes', () => {
  // server.js asks the model for labelled sections but does not constrain the
  // decoration, so bold, headings and bare labels all arrive in practice.
  it('reads bold labels with an open-ended vocabulary', () => {
    const prompt = [
      '**Expert Role:**', 'Act as a senior engineer.',
      '**Stack & Environment:**', 'TypeScript, React 19.',
      '**Functional Requirements:**', '- Handle retries',
      '**Quality Bar:**', 'Production ready',
    ].join('\n')

    expect(structureScore(prompt, 'coding')).toBe(15)
  })

  it('reads markdown headings', () => {
    const prompt = [
      '## Role', 'Analyst.',
      '## Research Question', 'What drives churn?',
      '## Deliverable Format', 'Table.',
    ].join('\n')

    expect(structureScore(prompt, 'research-analysis')).toBe(15)
  })

  it('reads bare labels written without a colon', () => {
    const prompt = [
      'Role', 'Analyst.',
      'Objective', 'Find churn drivers.',
      'Output Format', 'Table.',
    ].join('\n')

    expect(structureScore(prompt, 'general')).toBe(15)
  })

  it('counts a repeated label once', () => {
    const prompt = ['Role:', 'Analyst.', 'Role:', 'Also an editor.'].join('\n')

    expect(structureScore(prompt, 'general')).toBe(5)
  })
})

describe('Structure score — partial credit', () => {
  it.each([
    ['three or more sections', 'Role:\nAnalyst\n\nObjective:\nFind churn\n\nOutput Format:\nTable', 15],
    ['two sections',           'Role:\nAnalyst\n\nObjective:\nFind churn',                           10],
    ['one section',            'Role:\nAnalyst',                                                      5],
  ])('%s scores %i', (_name, prompt, expected) => {
    expect(structureScore(prompt, 'general')).toBe(expected)
  })
})

describe('Structure score — unstructured prompts earn nothing', () => {
  it.each([
    ['a plain request',            'Fix the login bug in my React app'],
    ['a label-like short phrase',  'Improve my resume format'],
    ['prose followed by bullets',  'Please write something about dogs.\n- Keep it friendly\n- Add some jokes'],
  ])('%s scores 0', (_name, prompt) => {
    expect(structureScore(prompt, 'general')).toBe(0)
  })

  it('treats a bare audience mention as weak evidence, not full structure', () => {
    expect(structureScore('Write a blog post for developers about caching', 'general')).toBe(5)
  })
})

describe('Score totals', () => {
  it('always equals the sum of its breakdown rows', () => {
    const { prompt, taskType } = generateLocalOutput('Analyze the EV market', 'research', 'professional', 'paragraph')
    const analysis = analyzePrompt(prompt)
    const sum = computeScoreBreakdown(analysis, taskType).reduce((total, row) => total + row.score, 0)

    expect(computeScore(analysis, taskType)).toBe(sum)
  })

  it('lets a structured research prompt reach 100', () => {
    // Research Depth used to be awarded only when no labelled sections were
    // found, which capped a well-structured research prompt at 90.
    const { prompt, taskType } = generateLocalOutput('Analyze the EV market in Europe', 'research', 'professional', 'paragraph')

    expect(taskType).toBe('research-analysis')
    expect(computeScore(analyzePrompt(prompt), taskType)).toBe(100)
  })
})
