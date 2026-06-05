import { useState } from 'react'
import { X, Clock, RotateCcw, Bookmark, Trash2, ThumbsUp, ThumbsDown, Flag } from 'lucide-react'
import type { HistoryItem, UseCase, SavedPrompt } from '../lib/types'

interface Props {
  open: boolean
  history: HistoryItem[]
  onRestore: (item: HistoryItem) => void
  onClose: () => void
  savedPrompts: SavedPrompt[]
  onRestoreSaved: (item: SavedPrompt) => void
  onRemoveSaved: (id: string) => void
}

const useCaseLabel: Record<UseCase, string> = {
  general: 'General',
  writing: 'Writing',
  coding: 'Coding',
  marketing: 'Marketing',
  research: 'Research',
  'image-generation': 'Image gen',
  business: 'Business',
  gtm: 'GTM Strategy',
}

function scoreLabel(score: number): { text: string; color: string } {
  if (score >= 90) return { text: 'Excellent', color: 'text-fuchsia-600' }
  if (score >= 70) return { text: 'Strong',    color: 'text-sky-600' }
  if (score >= 45) return { text: 'Fair',      color: 'text-amber-600' }
  return                 { text: 'Weak',       color: 'text-red-600' }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Recent tab ─────────────────────────────────────────────────────────────

function RecentTab({ history, onRestore }: { history: HistoryItem[]; onRestore: (i: HistoryItem) => void }) {
  const reversed = [...history].reverse()

  if (reversed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Clock size={28} className="text-fuchsia-300" />
        <p className="text-sm text-slate-600 font-medium">No history yet.</p>
        <p className="text-xs text-slate-500">Optimize a prompt to start building history.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {reversed.map((item, i) => {
          const { text: slabel, color: scolor } = scoreLabel(item.result.score)
          return (
            <div key={item.timestamp} className="rounded-xl border border-white/60 bg-white/60 backdrop-blur-md shadow-[0_4px_24px_-8px_rgba(217,70,239,0.15)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400">{formatTime(item.timestamp)}</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-fuchsia-50/80 border border-fuchsia-100 text-fuchsia-600">
                    {useCaseLabel[item.useCase]}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/60 border border-slate-200/60 text-slate-500">
                    {item.tone}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {item.rawPrompt || <span className="text-slate-400 italic">Empty prompt</span>}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Score:</span>
                  <span className={`text-xs font-bold ${scolor}`}>{item.result.score}</span>
                  <span className={`text-[10px] ${scolor}`}>· {slabel}</span>
                </div>
                {i > 0 || reversed.length === 1 ? (
                  <button
                    onClick={() => onRestore(item)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-white/60 bg-white/60 hover:bg-white hover:border-fuchsia-200 hover:text-fuchsia-600 text-slate-500 transition-colors shadow-sm"
                  >
                    <RotateCcw size={11} />
                    Restore
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Current</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-slate-400 text-center pt-2">
        Showing {reversed.length} of 5 max · Session only
      </p>
    </>
  )
}

// ── Saved tab ──────────────────────────────────────────────────────────────

function SavedTab({
  savedPrompts,
  onRestoreSaved,
  onRemoveSaved,
}: {
  savedPrompts: SavedPrompt[]
  onRestoreSaved: (i: SavedPrompt) => void
  onRemoveSaved: (id: string) => void
}) {
  if (savedPrompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Bookmark size={28} className="text-fuchsia-300" />
        <p className="text-sm text-slate-600 font-medium">No saved prompts yet.</p>
        <p className="text-xs text-slate-500">Click Save on any result to keep it here.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {savedPrompts.map((item) => {
          const { text: slabel, color: scolor } = scoreLabel(item.score)
          return (
            <div key={item.id} className="rounded-xl border border-white/60 bg-white/60 backdrop-blur-md shadow-[0_4px_24px_-8px_rgba(217,70,239,0.15)] p-4 space-y-3">
              {/* Top row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400">
                  {formatDate(item.timestamp)} {formatTime(item.timestamp)}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-fuchsia-50/80 border border-fuchsia-100 text-fuchsia-600">
                    {useCaseLabel[item.useCase]}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/60 border border-slate-200/60 text-slate-500">
                    {item.tone}
                  </span>
                </div>
              </div>

              {/* Raw prompt preview */}
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {item.rawPrompt || <span className="text-slate-400 italic">Empty prompt</span>}
              </p>

              {/* Score + feedback badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">Score:</span>
                <span className={`text-xs font-bold ${scolor}`}>{item.score}</span>
                <span className={`text-[10px] ${scolor}`}>· {slabel}</span>
                {item.rating === 'up' && <ThumbsUp size={11} className="text-emerald-600 ml-1" />}
                {item.rating === 'down' && <ThumbsDown size={11} className="text-red-500 ml-1" />}
                {item.flagged && <Flag size={11} className="text-amber-600 ml-1" />}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRestoreSaved(item)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-white/60 bg-white/60 hover:bg-white hover:border-fuchsia-200 hover:text-fuchsia-600 text-slate-500 transition-colors shadow-sm"
                >
                  <RotateCcw size={11} />
                  Restore
                </button>
                <button
                  onClick={() => onRemoveSaved(item.id)}
                  title="Remove saved prompt"
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-white/60 bg-white/60 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-500 transition-colors shadow-sm"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-slate-400 text-center pt-2">
        {savedPrompts.length} saved · Persists across refreshes
      </p>
    </>
  )
}

// ── Main drawer ────────────────────────────────────────────────────────────

export function HistoryDrawer({
  open, history, onRestore, onClose,
  savedPrompts, onRestoreSaved, onRemoveSaved,
}: Props) {
  const [tab, setTab] = useState<'recent' | 'saved'>('recent')

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Drawer panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-96 bg-white/80 backdrop-blur-2xl border-l border-white/50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/50 shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-fuchsia-500" />
            <h2 className="text-sm font-semibold bg-gradient-to-r from-fuchsia-600 to-sky-600 bg-clip-text text-transparent">Optimization History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-4 pt-3 pb-0 shrink-0">
          <div className="flex gap-0.5 p-0.5 bg-white/40 rounded-lg border border-slate-200/50 backdrop-blur-sm">
            <button
              onClick={() => setTab('recent')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === 'recent' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Clock size={11} />
              Recent
              {history.length > 0 && (
                <span className={`text-[10px] px-1 py-0 rounded ${
                  tab === 'recent' ? 'bg-fuchsia-100 text-fuchsia-600' : 'bg-slate-200/50 text-slate-500'
                }`}>
                  {history.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('saved')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === 'saved' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Bookmark size={11} />
              Saved
              {savedPrompts.length > 0 && (
                <span className={`text-[10px] px-1 py-0 rounded ${
                  tab === 'saved' ? 'bg-fuchsia-100 text-fuchsia-600' : 'bg-slate-200/50 text-slate-500'
                }`}>
                  {savedPrompts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-transparent">
          {tab === 'recent' ? (
            <RecentTab history={history} onRestore={onRestore} />
          ) : (
            <SavedTab
              savedPrompts={savedPrompts}
              onRestoreSaved={onRestoreSaved}
              onRemoveSaved={onRemoveSaved}
            />
          )}
        </div>
      </div>
    </div>
  )
}
