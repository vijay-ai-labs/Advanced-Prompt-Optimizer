import { useState } from 'react'
import { Header } from './components/Header'
import { InputPanel } from './components/InputPanel'
import { OutputPanel, type OutputTab } from './components/OutputPanel'
import { HistoryDrawer } from './components/HistoryDrawer'
import { analyzePrompt, computeScore, computeScoreBreakdown, generateLocalOutput } from './lib/optimizer'
import { validatePrompt } from './lib/promptValidation.js'
import { loadSaved, persistSaved, loadHistory, persistHistory, MAX_HISTORY } from './lib/savedPrompts'
import type {
  UseCase, Tone, OutputFormat,
  OptimizedResult, HistoryItem,
  SavedPrompt, OutputFeedback,
} from './lib/types'

const DEFAULT_FEEDBACK: OutputFeedback = { rating: null, flagged: false }

interface Snapshot {
  rawPrompt: string
  result: OptimizedResult | null
  useCase: UseCase
  tone: Tone
  outputFormat: OutputFormat
}

type RedoEntry =
  | { onApply: 'clear'; target: Snapshot; clearBackfill: Snapshot | null }
  | { onApply: 'history'; target: Snapshot; historyItem: HistoryItem }

function App() {
  const [rawPrompt, setRawPrompt] = useState('')
  const [useCase, setUseCase] = useState<UseCase>('general')
  const [tone, setTone] = useState<Tone>('clear')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('paragraph')
  const [result, setResult] = useState<OptimizedResult | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<OutputTab>('optimized')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [feedback, setFeedback] = useState<OutputFeedback>(DEFAULT_FEEDBACK)
  const [isSaved, setIsSaved] = useState(false)
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() => loadSaved())
  const [warnOverridden, setWarnOverridden] = useState(false)
  const [preClearSnapshot, setPreClearSnapshot] = useState<Snapshot | null>(null)
  const [redoStack, setRedoStack] = useState<RedoEntry[]>([])

  // Any edit to the prompt invalidates a previous "optimize anyway" — the new
  // text has to earn its own pass through validation. It also breaks the redo
  // chain: redoing after a fresh edit would silently discard what was just typed.
  const updateRawPrompt = (v: string) => {
    setRawPrompt(v)
    setWarnOverridden(false)
    if (error) setError('')
    if (redoStack.length) setRedoStack([])
  }

  const pushHistory =(prompt: string, res: OptimizedResult) => {
    setHistory((prev) => {
      const next = [
        ...prev.slice(-(MAX_HISTORY - 1)),
        { rawPrompt: prompt, result: res, useCase, tone, outputFormat, timestamp: Date.now() },
      ]
      persistHistory(next)
      return next
    })
  }

  // ── Streaming optimize ───────────────────────────────────────────────────

  const handleOptimize = async () => {
    if (isOptimizing) return

    // Gate before the network. The catch below turns every failure into a local
    // fallback result, so a rejection that reached it would be shown to the user
    // as a successful optimization — junk has to be stopped here instead.
    const verdict = validatePrompt(rawPrompt, useCase)
    if (verdict.level === 'block') {
      setError(verdict.message)
      return
    }
    // Every warn tier needs an explicit override. Mode mismatch is the exception:
    // it is advisory, and reaching here means the user kept their selection.
    if (verdict.level === 'warn' && verdict.code !== 'mode-mismatch' && !warnOverridden) {
      setError('')
      return
    }

    setError('')
    setIsOptimizing(true)
    setStreamingText('')
    setResult(null)
    setFeedback(DEFAULT_FEEDBACK)
    setIsSaved(false)
    setPreClearSnapshot(null)
    setRedoStack([])

    try {
      const res = await fetch('/api/optimize/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawPrompt, useCase, tone, outputFormat }),
      })

      if (!res.ok || !res.body) {
        // Non-SSE error (e.g. 404 before headers are flushed)
        let errMsg = `Server error ${res.status}`
        try {
          const data = await res.json()
          errMsg = data.error ?? errMsg
        } catch { /* ignore */ }
        throw new Error(errMsg)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventType = ''
      let accumulated = '' // growing display text (mirrors what server sends as tokens)
      let completed = false

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ') && eventType) {
            let payload: Record<string, unknown>
            try {
              payload = JSON.parse(line.slice(6)) as Record<string, unknown>
            } catch {
              eventType = ''
              continue
            }

            if (eventType === 'token' && typeof payload.text === 'string') {
              accumulated += payload.text
              setStreamingText(accumulated)
            } else if (eventType === 'error') {
              throw new Error(typeof payload.error === 'string' ? payload.error : 'Streaming failed')
            } else if (eventType === 'done') {
              if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) {
                throw new Error('Optimizer returned an empty prompt')
              }
              const detectedTaskType = typeof payload.taskType === 'string' ? payload.taskType : 'general'
              const optimizedText = payload.prompt
              const analysis = analyzePrompt(rawPrompt)
              const score = computeScore(analysis, detectedTaskType)
              const scoreBreakdown = computeScoreBreakdown(analysis, detectedTaskType)
              const afterAnalysis = analyzePrompt(optimizedText)
              const afterScore = computeScore(afterAnalysis, detectedTaskType)
              const afterScoreBreakdown = computeScoreBreakdown(afterAnalysis, detectedTaskType)

              const newResult: OptimizedResult = {
                prompt: optimizedText,
                taskType: detectedTaskType,
                assumptions: Array.isArray(payload.assumptions) ? payload.assumptions as string[] : [],
                improvements: Array.isArray(payload.improvements) ? payload.improvements as string[] : [],
                missingDetails: Array.isArray(payload.missingDetails) ? payload.missingDetails as string[] : [],
                score,
                scoreBreakdown,
                afterScore,
                afterScoreBreakdown,
                rawPromptSnapshot: rawPrompt,
              }

              setResult(newResult)
              setActiveTab('optimized')
              pushHistory(rawPrompt, newResult)
              completed = true
              // Nothing follows the done event; releasing the body here stops
              // the connection being held open until the server times out.
              reader.cancel().catch(() => { /* already closed */ })
              break outer
            }

            eventType = ''
          } else if (line === '') {
            eventType = ''
          }
        }
      }

      if (!completed) {
        throw new Error('Optimization stream ended before completion')
      }
    } catch {
      const fallback = generateLocalOutput(rawPrompt, useCase, tone, outputFormat)
      setResult(fallback)
      setActiveTab('optimized')
      pushHistory(rawPrompt, fallback)
      // suppress AI fallback error toast
    } finally {
      setIsOptimizing(false)
      setStreamingText('')
    }
  }

  // ── History / undo / redo ───────────────────────────────────────────────

  const applySnapshot = (snap: Snapshot) => {
    setRawPrompt(snap.rawPrompt)
    setWarnOverridden(false)
    setResult(snap.result)
    setUseCase(snap.useCase)
    setTone(snap.tone)
    setOutputFormat(snap.outputFormat)
    setFeedback(DEFAULT_FEEDBACK)
    setIsSaved(false)
  }

  const handleUndo = () => {
    if (preClearSnapshot) {
      const snap = preClearSnapshot
      const current: Snapshot = { rawPrompt, result, useCase, tone, outputFormat }
      setRedoStack((r) => [...r, { onApply: 'clear', target: current, clearBackfill: snap }])
      setPreClearSnapshot(null)
      applySnapshot(snap)
      return
    }
    if (history.length < 2) return
    const poppedItem = history[history.length - 1]
    const prev = history[history.length - 2]
    const current: Snapshot = {
      rawPrompt: poppedItem.rawPrompt, result: poppedItem.result,
      useCase: poppedItem.useCase, tone: poppedItem.tone, outputFormat: poppedItem.outputFormat,
    }
    setRedoStack((r) => [...r, { onApply: 'history', target: current, historyItem: poppedItem }])
    setHistory((h) => {
      const next = h.slice(0, -1)
      persistHistory(next)
      return next
    })
    applySnapshot(prev)
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return
    const entry = redoStack[redoStack.length - 1]
    setRedoStack((r) => r.slice(0, -1))
    if (entry.onApply === 'clear') {
      setPreClearSnapshot(entry.clearBackfill)
    } else {
      setHistory((h) => {
        const next = [...h, entry.historyItem]
        persistHistory(next)
        return next
      })
    }
    applySnapshot(entry.target)
  }

  const handleClear = () => {
    if (rawPrompt.trim() || result) {
      setPreClearSnapshot({ rawPrompt, result, useCase, tone, outputFormat })
    }
    setRawPrompt('')
    setWarnOverridden(false)
    setResult(null)
    setStreamingText('')
    setError('')
    setCopied(false)
    setHistory([])
    persistHistory([])
    setFeedback(DEFAULT_FEEDBACK)
    setIsSaved(false)
    setRedoStack([])
  }

  // navigator.clipboard is undefined outside a secure context, and writeText
  // rejects when permission is refused. Either one used to surface as an
  // uncaught error with no feedback in the UI.
  const handleCopy = async () => {
    if (!result) return
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(result.prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed — select the text and copy it manually.')
    }
  }

  const handleRestore = (item: HistoryItem) => {
    setRawPrompt(item.rawPrompt)
    setWarnOverridden(true)
    setResult(item.result)
    setUseCase(item.useCase)
    setTone(item.tone)
    setOutputFormat(item.outputFormat)
    setActiveTab('optimized')
    setHistoryOpen(false)
    setFeedback(DEFAULT_FEEDBACK)
    setIsSaved(false)
    setPreClearSnapshot(null)
    setRedoStack([])
  }

  // ── Saved prompts ────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!result || isSaved) return
    const saved: SavedPrompt = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      rawPrompt,
      optimizedPrompt: result.prompt,
      useCase,
      tone,
      outputFormat,
      score: result.score,
      timestamp: Date.now(),
      rating: feedback.rating ?? undefined,
      flagged: feedback.flagged || undefined,
    }
    const updated = [saved, ...savedPrompts]
    setSavedPrompts(updated)
    persistSaved(updated)
    setIsSaved(true)
  }

  const handleRestoreSaved = (item: SavedPrompt) => {
    setRawPrompt(item.rawPrompt)
    setWarnOverridden(true)
    const savedTaskType = item.useCase === 'image-generation' ? 'image-generation' : item.useCase === 'research' ? 'research-analysis' : item.useCase
    const beforeAnalysis = analyzePrompt(item.rawPrompt)
    const afterAnalysis = analyzePrompt(item.optimizedPrompt)
    setResult({
      prompt: item.optimizedPrompt,
      improvements: [],
      missingDetails: [],
      score: item.score,
      scoreBreakdown: computeScoreBreakdown(beforeAnalysis, savedTaskType),
      afterScore: computeScore(afterAnalysis, savedTaskType),
      afterScoreBreakdown: computeScoreBreakdown(afterAnalysis, savedTaskType),
      rawPromptSnapshot: item.rawPrompt,
    })
    setUseCase(item.useCase)
    setTone(item.tone)
    setOutputFormat(item.outputFormat)
    setActiveTab('optimized')
    setHistoryOpen(false)
    setFeedback({
      rating: item.rating ?? null,
      flagged: item.flagged ?? false,
    })
    setIsSaved(true)
    setPreClearSnapshot(null)
    setRedoStack([])
  }

  const handleRemoveSaved = (id: string) => {
    const updated = savedPrompts.filter((s) => s.id !== id)
    setSavedPrompts(updated)
    persistSaved(updated)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header onOpenHistory={() => setHistoryOpen(true)} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-2 sm:pt-2.5 pb-6 sm:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-start">
          <InputPanel
            rawPrompt={rawPrompt}
            setRawPrompt={updateRawPrompt}
            useCase={useCase}
            setUseCase={setUseCase}
            tone={tone}
            setTone={setTone}
            outputFormat={outputFormat}
            setOutputFormat={setOutputFormat}
            onOptimize={handleOptimize}
            onClear={handleClear}
            onUndo={handleUndo}
            canUndo={history.length >= 2 || preClearSnapshot !== null}
            onRedo={handleRedo}
            canRedo={redoStack.length > 0}
            isOptimizing={isOptimizing}
            error={error}
            warnOverridden={warnOverridden}
            onOverrideWarn={() => setWarnOverridden(true)}
          />
          <OutputPanel
            result={result}
            streamingText={streamingText}
            onCopy={handleCopy}
            copied={copied}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isOptimizing={isOptimizing}
            onSave={handleSave}
            isSaved={isSaved}
          />
        </div>
      </main>

      <HistoryDrawer
        open={historyOpen}
        history={history}
        onRestore={handleRestore}
        onClose={() => setHistoryOpen(false)}
        savedPrompts={savedPrompts}
        onRestoreSaved={handleRestoreSaved}
        onRemoveSaved={handleRemoveSaved}
      />
    </div>
  )
}

export default App
