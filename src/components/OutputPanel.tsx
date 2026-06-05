import {
  Copy, Check, Sparkles, TrendingUp, AlertCircle, ListChecks, GitCompare,
  Loader2, Bookmark, BookmarkCheck, ThumbsUp, ThumbsDown, Flag, Lightbulb,
} from 'lucide-react'
import type { OptimizedResult, ScoreBreakdownItem, OutputFeedback } from '../lib/types'
import { computeStats } from '../lib/savedPrompts'

// ── Score helpers ──────────────────────────────────────────────────────────

interface ScoreStyle { label: string; textColor: string; barColor: string; badgeBg: string }

function getScoreStyle(score: number): ScoreStyle {
  if (score >= 90) return { label: 'Excellent', textColor: 'text-cyan-600',    barColor: 'bg-cyan-500',    badgeBg: 'bg-cyan-50 border-cyan-200' }
  if (score >= 70) return { label: 'Strong',    textColor: 'text-emerald-600', barColor: 'bg-emerald-500', badgeBg: 'bg-emerald-50 border-emerald-200' }
  if (score >= 45) return { label: 'Fair',      textColor: 'text-amber-600',   barColor: 'bg-amber-500',   badgeBg: 'bg-amber-50 border-amber-200' }
  return              { label: 'Weak',       textColor: 'text-red-600',     barColor: 'bg-red-500',     badgeBg: 'bg-red-50 border-red-200' }
}

function ScoreRow({ label, score, barColor, textColor, badgeBg, badgeLabel }: {
  label: string; score: number; barColor: string; textColor: string; badgeBg: string; badgeLabel: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-10 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${textColor} ${badgeBg}`}>
          {badgeLabel}
        </span>
        <span className={`text-xs font-bold w-12 text-right ${textColor}`}>{score}/100</span>
      </div>
    </div>
  )
}

function BeforeAfterScore({ before, after }: { before: number; after?: number }) {
  const beforeStyle = getScoreStyle(before)
  const afterStyle = after !== undefined ? getScoreStyle(after) : null
  const delta = after !== undefined ? after - before : null

  return (
    <div className="space-y-2">
      <ScoreRow
        label="Before"
        score={before}
        barColor={beforeStyle.barColor}
        textColor={beforeStyle.textColor}
        badgeBg={beforeStyle.badgeBg}
        badgeLabel={beforeStyle.label}
      />
      {afterStyle && after !== undefined && (
        <>
          <ScoreRow
            label="After"
            score={after}
            barColor={afterStyle.barColor}
            textColor={afterStyle.textColor}
            badgeBg={afterStyle.badgeBg}
            badgeLabel={afterStyle.label}
          />
          {delta !== null && delta > 0 && (
            <div className="flex justify-end">
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                +{delta} pts
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BreakdownItem({ item }: { item: ScoreBreakdownItem }) {
  const pct = Math.round((item.score / item.max) * 100)
  const barColor =
    item.status === 'strong'  ? 'bg-emerald-500' :
    item.status === 'partial' ? 'bg-amber-500'   : 'bg-slate-300'
  const dotColor =
    item.status === 'strong'  ? 'text-emerald-600' :
    item.status === 'partial' ? 'text-amber-600'   : 'text-slate-400'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-500 w-24 shrink-0 truncate">{item.label}</span>
      <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-medium w-8 text-right shrink-0 ${dotColor}`}>
        {item.status === 'strong' ? '✓' : item.status === 'partial' ? '~' : '○'}
      </span>
    </div>
  )
}

// ── Diff helpers ───────────────────────────────────────────────────────────

type DiffLineType = 'added' | 'original' | 'blank'
interface DiffLine { text: string; type: DiffLineType }

function buildDiff(optimizedPrompt: string): DiffLine[] {
  return optimizedPrompt.split('\n').map((line): DiffLine => {
    if (!line.trim()) return { text: '', type: 'blank' }
    if (/^(Task:|Subject:|Goal:)/.test(line)) return { text: line, type: 'original' }
    return { text: line, type: 'added' }
  })
}

function DiffView({ prompt }: { prompt: string }) {
  const lines = buildDiff(prompt)
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-0.5 overflow-x-auto">
      <div className="flex items-center gap-4 mb-3 pb-2 border-b border-slate-200">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-sm bg-emerald-400 shrink-0" />
          Added by optimizer
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-sm bg-slate-400 shrink-0" />
          Original input
        </span>
      </div>
      {lines.map((line, i) =>
        line.type === 'blank' ? (
          <div key={i} className="h-2" />
        ) : (
          <div
            key={i}
            className={`px-3 py-1 rounded text-xs leading-relaxed font-mono border-l-2 ${
              line.type === 'added'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-400'
                : 'text-slate-500 bg-slate-100 border-slate-400'
            }`}
          >
            {line.text}
          </div>
        )
      )}
    </div>
  )
}

// ── Stats row ──────────────────────────────────────────────────────────────

function StatsRow({ text }: { text: string }) {
  const { words, chars, estimatedTokens } = computeStats(text)
  return (
    <div className="flex items-center gap-3 px-1 text-[11px] text-slate-400">
      <span>{words}<span className="ml-0.5 text-slate-300">w</span></span>
      <span className="text-slate-300">·</span>
      <span>{chars}<span className="ml-0.5 text-slate-300">c</span></span>
      <span className="text-slate-300">·</span>
      <span>~{estimatedTokens}<span className="ml-0.5 text-slate-300">tok</span></span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export type OutputTab = 'optimized' | 'changes'

interface Props {
  result: OptimizedResult | null
  streamingText: string
  onCopy: () => void
  copied: boolean
  activeTab: OutputTab
  setActiveTab: (t: OutputTab) => void
  isOptimizing: boolean
  onSave: () => void
  isSaved: boolean
  feedback: OutputFeedback
  onRate: (r: 'up' | 'down') => void
  onFlag: () => void
}

export function OutputPanel({
  result, streamingText,
  onCopy, copied,
  activeTab, setActiveTab,
  isOptimizing,
  onSave, isSaved,
  feedback, onRate, onFlag,
}: Props) {

  // ── Initial spinner (no streaming text yet) ────────────────────────────
  if (isOptimizing && !streamingText) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-10 text-center h-full min-h-64">
        <div className="p-3 rounded-xl bg-white border border-indigo-100 shadow-sm">
          <Loader2 size={22} className="text-indigo-600 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-indigo-700">Detecting task type…</p>
          <p className="text-xs text-slate-400 mt-1">Analyzing and structuring your prompt</p>
        </div>
        <div className="w-full max-w-xs space-y-2 mt-2">
          <div className="h-2 rounded-full bg-indigo-100 animate-pulse" />
          <div className="h-2 rounded-full bg-indigo-100 animate-pulse w-4/5 mx-auto" />
          <div className="h-2 rounded-full bg-indigo-100 animate-pulse w-3/5 mx-auto" />
        </div>
      </div>
    )
  }

  // ── Streaming text display ─────────────────────────────────────────────
  if (isOptimizing && streamingText) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white shadow-sm">
              <Sparkles size={11} />
              Optimized
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse ml-0.5" />
            </button>
            <button disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 cursor-not-allowed">
              <GitCompare size={11} />
              Changes
            </button>
          </div>
          <span className="ml-auto text-[10px] text-indigo-500 flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" />
            Streaming
          </span>
        </div>

        <div className="rounded-xl bg-slate-50 border border-indigo-200 p-4 min-h-32">
          <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
            {streamingText}
            <span className="animate-pulse text-indigo-500">▌</span>
          </pre>
        </div>

        <StatsRow text={streamingText} />

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 animate-pulse">
          <div className="h-3 bg-slate-200 rounded w-24" />
          <div className="h-2 bg-slate-200 rounded-full" />
          <div className="pt-2 space-y-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <div className="h-2 bg-slate-200 rounded w-20" />
                <div className="flex-1 h-1 bg-slate-200 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center h-full min-h-64">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <Sparkles size={22} className="text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">No output yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Enter a prompt and click <span className="font-medium text-indigo-600">Optimize Prompt</span> to see results.
          </p>
        </div>
      </div>
    )
  }

  // ── Full result ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white shadow-sm p-5">


      {/* Tab bar + Copy + Save */}
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('optimized')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'optimized' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles size={11} />
            Optimized
          </button>
          <button
            onClick={() => setActiveTab('changes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'changes' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <GitCompare size={11} />
            Changes
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={onSave}
            disabled={isSaved}
            title={isSaved ? 'Saved' : 'Save this result'}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              isSaved
                ? 'border-indigo-300 bg-indigo-50 text-indigo-600 cursor-default'
                : 'border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-500 hover:text-indigo-600'
            }`}
          >
            {isSaved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
            {isSaved ? 'Saved' : 'Save'}
          </button>

          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors"
          >
            {copied ? (
              <><Check size={12} className="text-emerald-600" /><span className="text-emerald-600">Copied</span></>
            ) : (
              <><Copy size={12} />Copy</>
            )}
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'optimized' ? (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
            {result.prompt}
          </pre>
        </div>
      ) : (
        <DiffView prompt={result.prompt} />
      )}

      {/* Output stats */}
      <StatsRow text={result.prompt} />

      {/* Score + Breakdown */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp size={13} className="text-slate-500" />
          <span className="text-xs font-medium text-slate-600">Prompt Score</span>
        </div>
        <BeforeAfterScore before={result.score} after={result.afterScore} />
        {(result.afterScoreBreakdown ?? result.scoreBreakdown).length > 0 && (
          <div className="pt-2 border-t border-slate-200 space-y-2">
            {(result.afterScoreBreakdown ?? result.scoreBreakdown).map((item) => (
              <BreakdownItem key={item.label} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Improvements */}
      {result.improvements.length > 0 && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <ListChecks size={13} className="text-slate-500" />
            <span className="text-xs font-medium text-slate-600">Improvements made</span>
          </div>
          <ul className="space-y-1.5">
            {result.improvements.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-1 w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Assumptions made */}
      {result.assumptions && result.assumptions.length > 0 && (
        <div className="rounded-xl bg-sky-50 border border-sky-200 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Lightbulb size={13} className="text-sky-600" />
            <span className="text-xs font-medium text-sky-700">Assumptions made</span>
          </div>
          <ul className="space-y-1.5">
            {result.assumptions.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-sky-700">
                <span className="mt-1 w-1 h-1 rounded-full bg-sky-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing details */}
      {result.missingDetails.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <AlertCircle size={13} className="text-amber-600" />
            <span className="text-xs font-medium text-amber-700">Could still improve</span>
          </div>
          <ul className="space-y-1.5">
            {result.missingDetails.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Feedback row */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
        <span className="text-[10px] text-slate-400 mr-1">Rate:</span>
        <button
          onClick={() => onRate('up')}
          title="Good result"
          className={`p-1.5 rounded-lg transition-colors ${
            feedback.rating === 'up'
              ? 'bg-emerald-100 text-emerald-600'
              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
          }`}
        >
          <ThumbsUp size={13} />
        </button>
        <button
          onClick={() => onRate('down')}
          title="Poor result"
          className={`p-1.5 rounded-lg transition-colors ${
            feedback.rating === 'down'
              ? 'bg-red-100 text-red-600'
              : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
          }`}
        >
          <ThumbsDown size={13} />
        </button>
        <button
          onClick={onFlag}
          title="Flag this result"
          className={`p-1.5 rounded-lg transition-colors ${
            feedback.flagged
              ? 'bg-amber-100 text-amber-600'
              : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
          }`}
        >
          <Flag size={13} />
        </button>
      </div>
    </div>
  )
}
