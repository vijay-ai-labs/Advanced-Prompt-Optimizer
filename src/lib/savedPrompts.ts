import type { SavedPrompt, HistoryItem } from './types'

const STORAGE_KEY = 'prompt-optimizer-saved'
const HISTORY_KEY = 'prompt-optimizer-history'

// Newest entries win when the cap is hit. Each item carries a full
// OptimizedResult, so this is also the ceiling on how much of the localStorage
// quota history can take before persistHistory starts silently dropping writes.
export const MAX_HISTORY = 50

// Anything but an array is treated as absent: the callers map and filter over
// what comes back, so a stale or hand-edited key would otherwise crash the app
// on load with no way for the user to recover short of clearing storage.
function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function loadSaved(): SavedPrompt[] {
  return loadArray<SavedPrompt>(STORAGE_KEY)
}

export function persistSaved(saved: SavedPrompt[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function loadHistory(): HistoryItem[] {
  return loadArray<HistoryItem>(HISTORY_KEY).slice(-MAX_HISTORY)
}

export function persistHistory(history: HistoryItem[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
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
