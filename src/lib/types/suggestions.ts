/**
 * Types for AI-powered hook suggestions
 */

export type HookType = 'question' | 'shock' | 'curiosity' | 'controversy' | 'relatable';

export interface HookSuggestion {
  /** The suggested opening line */
  hook: string;
  /** Why this hook would grab attention */
  reason: string;
  /** The type/category of hook */
  hookType: HookType;
}

export interface HookResponse {
  /** What the video currently opens with */
  currentHook: string;
  /** Brief analysis of the current opening */
  analysis: string;
  /** Alternative hook suggestions */
  suggestions: HookSuggestion[];
}

export interface HookSuggestionsRequest {
  /** First 30 seconds of transcript */
  openingTranscript: string;
  /** Full transcript for context */
  fullTranscript: string;
}
