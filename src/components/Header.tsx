import { Sparkles, Clock } from 'lucide-react'

interface Props {
  onOpenHistory: () => void
}

export function Header({ onOpenHistory }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-indigo-600 shrink-0">
            <Sparkles size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none tracking-tight">
              Prompt Optimizer
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
              Task-aware · Structured · Production-ready
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Clock size={13} />
            <span className="hidden sm:inline">History</span>
          </button>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium shrink-0">
            GPT-4o mini
          </span>
        </div>
      </div>
    </header>
  )
}
