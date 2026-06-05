import { useState } from 'react'
import { Header } from './components/Header'
import { InputPanel } from './components/InputPanel'
import { OutputPanel, type OutputTab } from './components/OutputPanel'
import { HistoryDrawer } from './components/HistoryDrawer'
import { analyzePrompt, computeScore, computeScoreBreakdown, generateLocalOutput } from './lib/optimizer'
import { loadSaved, persistSaved } from './lib/savedPrompts'
import type {
  UseCase, Tone, OutputFormat,
  OptimizedResult, HistoryItem,
  SavedPrompt, OutputFeedback,
} from './lib/types'

const DEFAULT_FEEDBACK: OutputFeedback = { rating: null, flagged: false }

function App() {
  const [rawPrompt, setRawPrompt] = useState('')
  const [useCase, setUseCase] = useState<UseCase>('general')
  const [tone, setTone] = useState<Tone>('clear')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('paragraph')
  const [result, setResult] = useState<OptimizedResult | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<OutputTab>('optimized')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [feedback, setFeedback] = useState<OutputFeedback>(DEFAULT_FEEDBACK)
  const [isSaved, setIsSaved] = useState(false)
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() => loadSaved())

  const pushHistory = (prompt: string, res: OptimizedResult) => {
    setHistory((prev) => [
      ...prev.slice(-4),
      { rawPrompt: prompt, result: res, useCase, tone, outputFormat, timestamp: Date.now() },
    ])
  }

  // ── Streaming optimize ───────────────────────────────────────────────────

  const handleOptimize = async () => {
    if (!rawPrompt.trim()) {
      setError('Please enter a prompt before optimizing.')
      return
    }
    if (isOptimizing) return

    setError('')
    setIsOptimizing(true)
    setStreamingText('')
    setResult(null)
    setFeedback(DEFAULT_FEEDBACK)
    setIsSaved(false)

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
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

  // ── History / undo ───────────────────────────────────────────────────────

  const handleUndo = () => {
    if (history.length < 2) return
    const prev = history[history.length - 2]
    setHistory((h) => h.slice(0, -1))
    setRawPrompt(prev.rawPrompt)
    setResult(prev.result)
    setUseCase(prev.useCase)
    setTone(prev.tone)
    setOutputFormat(prev.outputFormat)
    setFeedback(DEFAULT_FEEDBACK)
    setIsSaved(false)
  }

  const handleClear = () => {
    setRawPrompt('')
    setResult(null)
    setStreamingText('')
    setError('')
    setCopied(false)
    setHistory([])
    setFeedback(DEFAULT_FEEDBACK)
    setIsSaved(false)
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result.prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleRestore = (item: HistoryItem) => {
    setRawPrompt(item.rawPrompt)
    setResult(item.result)
    setUseCase(item.useCase)
    setTone(item.tone)
    setOutputFormat(item.outputFormat)
    setActiveTab('optimized')
    setHistoryOpen(false)
    setFeedback(DEFAULT_FEEDBACK)
    setIsSaved(false)
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
    const savedTaskType = item.useCase === 'image-generation' ? 'image-generation' : item.useCase === 'research' ? 'research-analysis' : item.useCase
    const afterAnalysis = analyzePrompt(item.optimizedPrompt)
    setResult({
      prompt: item.optimizedPrompt,
      improvements: [],
      missingDetails: [],
      score: item.score,
      scoreBreakdown: [],
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
  }

  const handleRemoveSaved = (id: string) => {
    const updated = savedPrompts.filter((s) => s.id !== id)
    setSavedPrompts(updated)
    persistSaved(updated)
  }

  // ── Feedback ─────────────────────────────────────────────────────────────

  const handleRate = (rating: 'up' | 'down') => {
    setFeedback((prev) => ({
      ...prev,
      rating: prev.rating === rating ? null : rating,
    }))
  }

  const handleFlag = () => {
    setFeedback((prev) => ({ ...prev, flagged: !prev.flagged }))
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header onOpenHistory={() => setHistoryOpen(true)} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-start">
          <InputPanel
            rawPrompt={rawPrompt}
            setRawPrompt={setRawPrompt}
            useCase={useCase}
            setUseCase={setUseCase}
            tone={tone}
            setTone={setTone}
            outputFormat={outputFormat}
            setOutputFormat={setOutputFormat}
            onOptimize={handleOptimize}
            onClear={handleClear}
            onUndo={handleUndo}
            canUndo={history.length >= 2}
            isOptimizing={isOptimizing}
            error={error}
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
            feedback={feedback}
            onRate={handleRate}
            onFlag={handleFlag}
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
