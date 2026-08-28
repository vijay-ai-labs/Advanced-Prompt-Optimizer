import { useEffect, useState } from 'react'
import { AlertTriangle, Ban, ArrowRightLeft, Plus, CornerDownLeft, X } from 'lucide-react'
import type { ValidationCode, Verdict } from '../lib/promptValidation'

interface Props {
  verdict: Verdict
  /** Append a clarifier scaffold to the textarea. Subject-less prompts only. */
  onChip: (label: string) => void
  /** Replace the textarea with the category's worked example. */
  onExample: (prompt: string) => void
  /** Optimize anyway despite the warning. */
  onOverride: () => void
  /** Adopt the use case the prompt actually reads like. 'mode-mismatch' only. */
  onSwitch: () => void
  /** Label of the use case onSwitch would select, e.g. "Coding". */
  switchLabel: string
}

/**
 * Each level owns a full palette — red for block, amber for warn — so the card
 * itself carries the severity, not just the icon. The icon and the title say the
 * same thing in words, so nothing depends on colour alone.
 */
const TONE = {
  block: {
    Icon: Ban,
    card: 'bg-red-50 ring-red-200',
    caret: 'border-red-200 bg-red-50',
    chip: 'bg-white text-red-600 ring-red-200',
    title: 'text-red-800',
    message: 'text-red-700',
    label: 'text-red-700',
    close: 'text-red-400 hover:bg-red-100 hover:text-red-700',
    pill: 'border-red-200 bg-white text-red-800 hover:border-red-300 hover:bg-red-100/70',
    muted: 'text-red-400',
    divider: 'border-red-200',
    focus: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 focus-visible:ring-offset-red-50',
  },
  warn: {
    Icon: AlertTriangle,
    card: 'bg-amber-50 ring-amber-200',
    caret: 'border-amber-200 bg-amber-50',
    chip: 'bg-white text-amber-600 ring-amber-200',
    title: 'text-amber-900',
    message: 'text-amber-800',
    label: 'text-amber-700',
    close: 'text-amber-500 hover:bg-amber-100 hover:text-amber-800',
    pill: 'border-amber-300 bg-white text-amber-800 hover:border-amber-400 hover:bg-amber-100',
    muted: 'text-amber-400',
    divider: 'border-amber-200',
    focus: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50',
  },
} as const

const CARD =
  'relative rounded-xl ring-1 ' +
  'shadow-[0_12px_32px_-12px_rgb(15_23_42/0.28),0_2px_6px_-2px_rgb(15_23_42/0.08)]'

export function ValidationNotice({ verdict, onChip, onExample, onOverride, onSwitch, switchLabel }: Props) {
  // The dismissal is stored as the code it applied to, not a boolean, so a new
  // kind of problem is a new popover — it reopens even if the last one was waved
  // away. Re-typing the same kind of junk leaves it closed, on purpose. Keyed
  // state rather than an effect that resets a flag: no cascading render.
  const [dismissedCode, setDismissedCode] = useState<ValidationCode | null>(null)
  const dismissed = dismissedCode === verdict.code

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissedCode(verdict.code)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [verdict.code])

  if (verdict.level === 'ok' || dismissed) return null

  const isBlock = verdict.level === 'block'
  const tone = isBlock ? TONE.block : TONE.warn
  const { Icon, focus } = tone
  const showFooter = !isBlock

  return (
    <div className="relative mt-2">
      {/* Caret aimed at the textarea above — the cue that says "popover", not "banner". */}
      <span
        aria-hidden="true"
        className={
          'absolute -top-[5px] left-6 z-10 h-2.5 w-2.5 rotate-45 rounded-[2px] border-l border-t ' +
          tone.caret
        }
      />

      <div
        role={isBlock ? 'alert' : 'status'}
        aria-live="polite"
        className={
          CARD + ' ' + tone.card +
          ' origin-top animate-[popover-in_180ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none'
        }
      >
        <button
          type="button"
          onClick={() => setDismissedCode(verdict.code)}
          aria-label="Dismiss suggestion"
          className={
            'absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg ' +
            'transition-colors touch-manipulation ' + tone.close + ' ' + focus
          }
        >
          <X size={13} aria-hidden="true" />
        </button>

        <div className="flex gap-3 px-3.5 pb-3.5 pt-3">
          <span className={'grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ' + tone.chip}>
            <Icon size={14} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1 pr-6">
            <p className={'text-[13px] font-semibold leading-5 text-pretty ' + tone.title}>
              {verdict.title}
            </p>
            <p className={'mt-0.5 text-xs leading-relaxed text-pretty ' + tone.message}>
              {verdict.message}
            </p>

            {verdict.suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className={'text-[11px] font-medium ' + tone.label}>Add detail</span>
                {verdict.suggestions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onChip(label)}
                    className={
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ' +
                      'text-[11px] font-medium transition-colors touch-manipulation ' +
                      tone.pill + ' ' + focus
                    }
                  >
                    <Plus size={10} aria-hidden="true" />
                    {label.replace(/^\+\s*/, '')}
                  </button>
                ))}
              </div>
            )}

            {verdict.example && (
              <button
                type="button"
                onClick={() => onExample(verdict.example)}
                className={
                  'group mt-3 flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 ' +
                  'text-left transition-colors touch-manipulation ' + tone.pill + ' ' + focus
                }
              >
                <CornerDownLeft
                  size={12}
                  aria-hidden="true"
                  className={'mt-0.5 shrink-0 ' + tone.muted}
                />
                <span className="min-w-0 flex-1 break-words text-[11px] leading-relaxed">
                  {verdict.example}
                </span>
                <span className={'mt-px shrink-0 text-[10px] font-semibold uppercase tracking-wide ' + tone.muted}>
                  Use
                </span>
              </button>
            )}

            {verdict.code === 'mode-mismatch' && (
              <button
                type="button"
                onClick={onSwitch}
                className={
                  'mt-3 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ' +
                  'text-[11px] font-semibold transition-colors touch-manipulation ' +
                  tone.pill + ' ' + focus
                }
              >
                <ArrowRightLeft size={11} aria-hidden="true" />
                Switch to {switchLabel}
              </button>
            )}
          </div>
        </div>

        {showFooter && verdict.code !== 'mode-mismatch' && (
          <div className={'flex justify-end border-t px-3 py-2 ' + tone.divider}>
            <button
              type="button"
              onClick={onOverride}
              className={
                'rounded-md px-2 py-1 text-[11px] font-medium underline underline-offset-2 ' +
                'transition-colors touch-manipulation text-amber-700 hover:text-amber-900 ' + focus
              }
            >
              {verdict.suggestions.length > 0
                ? 'Optimize anyway with [USER INSERTS: …] placeholders'
                : 'Optimize anyway'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
