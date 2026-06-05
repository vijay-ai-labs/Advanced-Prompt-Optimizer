import type { SavedPrompt } from './types'

const STORAGE_KEY = 'prompt-optimizer-saved'

export function loadSaved(): SavedPrompt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedPrompt[]) : []
  } catch {
    return []
  }
}

export function persistSaved(saved: SavedPrompt[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function computeStats(text: string) {
  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/).length : 0
  const chars = text.length
  const estimatedTokens = Math.ceil(chars / 4)
  return { words, chars, estimatedTokens }
}
