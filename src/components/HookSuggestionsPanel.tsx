'use client'

import { useState } from 'react'
import { HookResponse, HookType } from '@/lib/types/suggestions'

interface HookSuggestionsPanelProps {
  /** Full transcript text */
  transcript: string
  /** Word-level segments with timestamps */
  segments: Array<{ text: string; start: number; end: number }>
  /** Callback when panel should close */
  onClose: () => void
}

const HOOK_TYPE_LABELS: Record<HookType, string> = {
  question: 'Question',
  shock: 'Shock Value',
  curiosity: 'Curiosity Gap',
  controversy: 'Controversial',
  relatable: 'Relatable',
}

const HOOK_TYPE_COLORS: Record<HookType, string> = {
  question: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  shock: 'bg-red-500/20 text-red-400 border-red-500/30',
  curiosity: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  controversy: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  relatable: 'bg-green-500/20 text-green-400 border-green-500/30',
}

export function HookSuggestionsPanel({
  transcript,
  segments,
  onClose,
}: HookSuggestionsPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<HookResponse | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const generateSuggestions = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Get first 30 seconds of transcript
      const openingSegments = segments.filter(seg => seg.start < 30)
      const openingTranscript = openingSegments.map(seg => seg.text).join(' ') || transcript.substring(0, 500)

      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingTranscript,
          fullTranscript: transcript,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate suggestions')
      }

      const data: HookResponse = await response.json()
      setSuggestions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
  }

  return (
    <div className="hidden md:block fixed left-[72px] top-0 bottom-0 w-[320px] bg-[#1C1C1E] border-r border-[var(--border-subtle)] z-40 animate-slide-right overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <SparkleIcon className="w-4 h-4 text-[#4A8FE7]" />
          <h3 className="text-sm font-semibold text-white">AI Hooks</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Panel Content */}
      <div className="p-4 overflow-y-auto h-[calc(100%-52px)]">
        {!suggestions && !isLoading && !error && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#4A8FE7]/20 to-[#7C3AED]/20 flex items-center justify-center">
                <SparkleIcon className="w-8 h-8 text-[#4A8FE7]" />
              </div>
              <h4 className="text-white font-medium mb-2">Improve Your Hook</h4>
              <p className="text-[#8E8E93] text-sm leading-relaxed">
                Get AI-powered suggestions for attention-grabbing opening lines that keep viewers watching.
              </p>
            </div>

            <button
              onClick={generateSuggestions}
              disabled={!transcript}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4A8FE7] to-[#7C3AED] text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <SparkleIcon className="w-4 h-4" />
              Generate Hook Ideas
            </button>

            {!transcript && (
              <p className="text-[#636366] text-xs text-center">
                Transcribe your video first to generate hook suggestions
              </p>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[#8E8E93] text-sm">Analyzing your opening...</p>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
            <button
              onClick={generateSuggestions}
              className="w-full py-2.5 rounded-lg bg-[#2C2C2E] text-white text-sm hover:bg-[#3C3C3E] transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {suggestions && (
          <div className="space-y-5">
            {/* Current Opening Analysis */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[#8E8E93] uppercase tracking-wide">Current Opening</h4>
              <div className="p-3 bg-[#2C2C2E] rounded-xl">
                <p className="text-white text-sm leading-relaxed mb-2">
                  &ldquo;{suggestions.currentHook}&rdquo;
                </p>
                <p className="text-[#8E8E93] text-xs leading-relaxed">
                  {suggestions.analysis}
                </p>
              </div>
            </div>

            {/* Suggestions */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-[#8E8E93] uppercase tracking-wide">
                Suggested Hooks ({suggestions.suggestions.length})
              </h4>

              {suggestions.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-3 bg-[#2C2C2E] rounded-xl space-y-2 hover:bg-[#333] transition-colors"
                >
                  {/* Hook Type Badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${HOOK_TYPE_COLORS[suggestion.hookType]}`}
                    >
                      {HOOK_TYPE_LABELS[suggestion.hookType]}
                    </span>
                    <button
                      onClick={() => copyToClipboard(suggestion.hook, index)}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors group"
                      title="Copy hook"
                    >
                      {copiedIndex === index ? (
                        <CheckIcon className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <CopyIcon className="w-3.5 h-3.5 text-[#8E8E93] group-hover:text-white" />
                      )}
                    </button>
                  </div>

                  {/* Hook Text */}
                  <p className="text-white text-sm leading-relaxed">
                    &ldquo;{suggestion.hook}&rdquo;
                  </p>

                  {/* Reason */}
                  <p className="text-[#8E8E93] text-xs leading-relaxed">
                    {suggestion.reason}
                  </p>
                </div>
              ))}
            </div>

            {/* Regenerate Button */}
            <button
              onClick={generateSuggestions}
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-[#2C2C2E] text-white text-sm hover:bg-[#3C3C3E] transition-colors flex items-center justify-center gap-2"
            >
              <RefreshIcon className="w-4 h-4" />
              Generate New Ideas
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
