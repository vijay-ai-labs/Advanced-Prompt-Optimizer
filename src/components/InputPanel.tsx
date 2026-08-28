import { useMemo, useRef } from 'react'
import { Wand2, Trash2, Undo2, Redo2, Loader2, ChevronDown } from 'lucide-react'
import type { UseCase, Tone, OutputFormat } from '../lib/types'
import type { Verdict } from '../lib/promptValidation'
import { validatePrompt, clarifierInsert, mismatchVerdict } from '../lib/promptValidation.js'
import { countUseCaseSignals, detectUseCaseFromPrompt } from '../lib/optimizer'
import { ValidationNotice } from './ValidationNotice'

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
  onRedo: () => void
  canRedo: boolean
  isOptimizing: boolean
  error: string
  /** User chose to optimize a topic-less prompt anyway. */
  warnOverridden: boolean
  onOverrideWarn: () => void
}

const selectClass =
  'w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 ' +
  'focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer appearance-none'

function getWordHint(wordCount: number): { text: string; color: string } | null {
  if (wordCount === 0) return null
  if (wordCount < 30) return { text: 'Good start', color: 'text-amber-600' }
  return { text: 'Detailed', color: 'text-emerald-600' }
}

// Not named useCaseLabel: a `use` prefix makes lint treat it as a React hook.
const labelForUseCase = (v: UseCase) => useCaseOptions.find((o) => o.value === v)?.label ?? v

/**
 * Junk and topic-less input first, then the advisory mode check: a prompt is only
 * called mismatched when it contains no signal at all for the selected use case
 * while clearly signalling another. That guard keeps "write a blog post about
 * Python code" under Blog from being flagged just because it mentions code.
 */
function inspect(rawPrompt: string, useCase: UseCase): Verdict {
  const detected = detectUseCaseFromPrompt(rawPrompt)
  const base = validatePrompt(rawPrompt, useCase === 'general' ? detected : useCase)
  if (base.level !== 'ok') return base

  if (useCase === 'general' || detected === 'general' || detected === useCase) return base

  const signals = countUseCaseSignals(rawPrompt)
  if ((signals[useCase] ?? 0) > 0 || (signals[detected] ?? 0) === 0) return base

  return mismatchVerdict(labelForUseCase(useCase), labelForUseCase(detected))
}

export function InputPanel({
  rawPrompt, setRawPrompt,
  useCase, setUseCase,
  tone, setTone,
  outputFormat, setOutputFormat,
  onOptimize, onClear, onUndo, canUndo, onRedo, canRedo,
  isOptimizing,
  error,
  warnOverridden, onOverrideWarn,
}: Props) {
  const words = rawPrompt.trim() === '' ? 0 : rawPrompt.trim().split(/\s+/).filter(Boolean).length
  const chars = rawPrompt.length
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const verdict = useMemo(() => inspect(rawPrompt, useCase), [rawPrompt, useCase])
  const detectedUseCase = useMemo(() => detectUseCaseFromPrompt(rawPrompt), [rawPrompt])

  // Mode mismatch is advisory — the user may well mean it. Everything else that
  // warns has to be acknowledged before the optimize action opens up.
  const blocked =
    verdict.level === 'block' ||
    (verdict.level === 'warn' && verdict.code !== 'mode-mismatch' && !warnOverridden)

  // The idle word hint only earns its space when there is nothing more useful
  // to show; the notice panel below says everything a warning needs to say.
  const hint = verdict.level === 'ok' ? getWordHint(words) : null

  const handleExample = (prompt: string) => {
    setRawPrompt(prompt)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(prompt.length, prompt.length)
    })
  }

  const handleChip = (label: string) => {
    const insert = clarifierInsert(useCase === 'general' ? detectedUseCase : useCase, label)
    const next = rawPrompt.replace(/\s+$/, '') + insert
    setRawPrompt(next)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(next.length, next.length)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!isOptimizing && !blocked) onOptimize()
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      {/* Textarea */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Your prompt
        </label>
        {/* The counters sit inside the field so nothing separates the textarea
            from the validation popover that points back up at it. */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. write me a blog post about AI trends in 2025…"
            rows={7}
            disabled={isOptimizing}
            aria-invalid={verdict.level === 'block' || Boolean(error)}
            className={
              'w-full bg-slate-50 border rounded-xl px-4 pt-3 pb-8 text-sm text-slate-800 placeholder-slate-400 ' +
              'resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed disabled:opacity-60 ' +
              (error || verdict.level === 'block'
                ? 'border-red-400'
                : verdict.level === 'warn'
                  ? 'border-amber-300'
                  : 'border-slate-200 focus:border-indigo-500')
            }
          />

          <div className="pointer-events-none absolute bottom-2.5 right-3.5 flex items-center gap-2 text-[11px] tabular-nums text-slate-400">
            {hint && <span className={`font-medium ${hint.color}`}>{hint.text}</span>}
            <span>{words}w</span>
            <span className="text-slate-300">·</span>
            <span>{chars}c</span>
          </div>
        </div>

        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
            <span className="inline-block h-1 w-1 rounded-full bg-red-500" />
            {error}
          </p>
        )}

        {!isOptimizing && (
          <ValidationNotice
            verdict={verdict}
            onChip={handleChip}
            onExample={handleExample}
            onOverride={onOverrideWarn}
            onSwitch={() => setUseCase(detectedUseCase)}
            switchLabel={labelForUseCase(detectedUseCase)}
          />
        )}
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
          <div className="relative">
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
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tone</label>
          <div className="relative">
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
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Output format</label>
          <div className="relative">
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
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <button
            onClick={onOptimize}
            disabled={isOptimizing || blocked}
            title={blocked ? verdict.title : undefined}
            className={
              'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ' +
              (isOptimizing
                ? 'bg-indigo-300 text-white cursor-not-allowed'
                : blocked
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
            onClick={onRedo}
            disabled={!canRedo || isOptimizing}
            title="Redo undone change"
            className={
              'flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-sm transition-colors ' +
              (canRedo && !isOptimizing
                ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700'
                : 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed')
            }
          >
            <Redo2 size={14} />
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
