import { Wand2, Trash2, Undo2, Loader2 } from 'lucide-react'
import type { UseCase, Tone, OutputFormat } from '../lib/types'

const useCaseOptions: { value: UseCase; label: string }[] = [
  { value: 'general', label: 'Auto-detect' },
  { value: 'writing', label: 'Blog / Content' },
  { value: 'coding', label: 'Coding' },
  { value: 'research', label: 'Research' },
  { value: 'business', label: 'Business' },
  { value: 'gtm', label: 'GTM Strategy' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'image-generation', label: 'Image gen' },
]

const toneOptions: { value: Tone; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'persuasive', label: 'Persuasive' },
  { value: 'technical', label: 'Technical' },
]

const formatOptions: { value: OutputFormat; label: string }[] = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'bullet-list', label: 'Bullet list' },
  { value: 'step-by-step', label: 'Step-by-step' },
  { value: 'json', label: 'JSON' },
]

const EXAMPLE_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'Blog post', prompt: 'Write a blog post about AI trends in 2025 for startup founders' },
  { label: 'Fix bug', prompt: 'My React useState hook is not re-rendering the component when I update state inside an async function' },
  { label: 'Go-to-market', prompt: 'Create a go-to-market strategy for a B2B SaaS product targeting mid-market HR teams' },
  { label: 'Research', prompt: 'Analyze the impact of remote work on software engineering team productivity and collaboration' },
  { label: 'Image', prompt: 'A futuristic city at night with neon lights reflecting off wet streets, cinematic photography style' },
]

interface Props {
  rawPrompt: string
  setRawPrompt: (v: string) => void
  useCase: UseCase
  setUseCase: (v: UseCase) => void
  tone: Tone
  setTone: (v: Tone) => void
  outputFormat: OutputFormat
  setOutputFormat: (v: OutputFormat) => void
  onOptimize: () => void
  onClear: () => void
  onUndo: () => void
  canUndo: boolean
  isOptimizing: boolean
  error: string
}

const selectClass =
  'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 ' +
  'focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer ' +
  'appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2394a3b8\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_10px_center]'

function getWordHint(wordCount: number): { text: string; color: string } | null {
  if (wordCount === 0) return null
  if (wordCount < 8) return { text: 'Too vague', color: 'text-red-500' }
  if (wordCount < 30) return { text: 'Good start', color: 'text-amber-600' }
  return { text: 'Detailed', color: 'text-emerald-600' }
}

export function InputPanel({
  rawPrompt, setRawPrompt,
  useCase, setUseCase,
  tone, setTone,
  outputFormat, setOutputFormat,
  onOptimize, onClear, onUndo, canUndo,
  isOptimizing,
  error,
}: Props) {
  const words = rawPrompt.trim() === '' ? 0 : rawPrompt.trim().split(/\s+/).filter(Boolean).length
  const chars = rawPrompt.length
  const hint = getWordHint(words)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!isOptimizing) onOptimize()
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      {/* Textarea */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Your prompt
        </label>
        <textarea
          value={rawPrompt}
          onChange={(e) => setRawPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. write me a blog post about AI trends in 2025..."
          rows={7}
          disabled={isOptimizing}
          className={
            'w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 ' +
            'resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed disabled:opacity-60 ' +
            (error ? 'border-red-400' : 'border-slate-200 focus:border-indigo-500')
          }
        />

        {/* Counter row */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {error ? (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                {error}
              </p>
            ) : (
              hint && (
                <span className={`text-[11px] font-medium ${hint.color}`}>{hint.text}</span>
              )
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
            <span>{words}w</span>
            <span className="text-slate-300">·</span>
            <span>{chars}c</span>
          </div>
        </div>
      </div>

      {/* Example prompts */}
      {rawPrompt === '' && !isOptimizing && (
        <div>
          <p className="text-[11px] text-slate-400 mb-2">Try an example:</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex.label}
                onClick={() => setRawPrompt(ex.prompt)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Use case</label>
          <select
            value={useCase}
            onChange={(e) => setUseCase(e.target.value as UseCase)}
            disabled={isOptimizing}
            className={selectClass + ' disabled:opacity-60'}
          >
            {useCaseOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            disabled={isOptimizing}
            className={selectClass + ' disabled:opacity-60'}
          >
            {toneOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Output format</label>
          <select
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
            disabled={isOptimizing}
            className={selectClass + ' disabled:opacity-60'}
          >
            {formatOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <button
            onClick={onOptimize}
            disabled={isOptimizing}
            className={
              'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ' +
              (isOptimizing
                ? 'bg-indigo-300 text-white cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white shadow-sm hover:shadow-md')
            }
          >
            {isOptimizing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Optimizing…
              </>
            ) : (
              <>
                <Wand2 size={16} />
                Optimize Prompt
              </>
            )}
          </button>

          <button
            onClick={onUndo}
            disabled={!canUndo || isOptimizing}
            title="Restore previous optimization"
            className={
              'flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-sm transition-colors ' +
              (canUndo && !isOptimizing
                ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700'
                : 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed')
            }
          >
            <Undo2 size={14} />
          </button>

          <button
            onClick={onClear}
            disabled={isOptimizing}
            title="Clear all"
            className={
              'flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-sm transition-colors ' +
              (isOptimizing
                ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
                : 'border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-500')
            }
          >
            <Trash2 size={14} />
          </button>
        </div>

        <p className="text-[10px] text-slate-400 text-center">
          <kbd className="font-mono">Ctrl+Enter</kbd>
          {' '}to optimize · <kbd className="font-mono">⌘+Enter</kbd> on Mac
        </p>
      </div>
    </div>
  )
}
