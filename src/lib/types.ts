export type UseCase =
  | 'general'
  | 'writing'
  | 'coding'
  | 'marketing'
  | 'research'
  | 'image-generation'
  | 'business'
  | 'gtm'

export type Tone = 'clear' | 'professional' | 'friendly' | 'persuasive' | 'technical'

export type OutputFormat = 'paragraph' | 'bullet-list' | 'step-by-step' | 'json'

export interface ScoreBreakdownItem {
  label: string
  score: number
  max: number
  status: 'missing' | 'partial' | 'strong'
}

export interface OptimizedResult {
  prompt: string
  taskType?: string
  assumptions?: string[]
  improvements: string[]
  score: number
  scoreBreakdown: ScoreBreakdownItem[]
  afterScore?: number
  afterScoreBreakdown?: ScoreBreakdownItem[]
  missingDetails: string[]
  rawPromptSnapshot: string
}

export interface ResultStats {
  words: number
  chars: number
  estimatedTokens: number
}

export interface OutputFeedback {
  rating: 'up' | 'down' | null
  flagged: boolean
}

export interface SavedPrompt {
  id: string
  rawPrompt: string
  optimizedPrompt: string
  useCase: UseCase
  tone: Tone
  outputFormat: OutputFormat
  score: number
  timestamp: number
  rating?: 'up' | 'down'
  flagged?: boolean
}

export interface PromptAnalysis {
  hasAction: boolean
  hasAudience: boolean
  hasOutputFormat: boolean
  hasTone: boolean
  hasLength: boolean
  hasConstraints: boolean
  hasVaguePhrases: boolean
  removedOpener: boolean
  wordCount: number
  isShort: boolean
  _raw?: string
}

export interface HistoryItem {
  rawPrompt: string
  result: OptimizedResult
  useCase: UseCase
  tone: Tone
  outputFormat: OutputFormat
  timestamp: number
}
