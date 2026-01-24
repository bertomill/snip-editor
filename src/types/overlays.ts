/**
 * Types for Snip video overlays: Text, Stickers, and Filters
 */

// Text Overlay
export interface TextOverlay {
  id: string;
  content: string;
  templateId: string;      // References text-templates
  animationId: string;     // References animation-templates
  position: { x: number; y: number }; // Percentage (0-100), draggable
  startMs: number;
  durationMs: number;
}

// Sticker Overlay
export interface StickerOverlay {
  id: string;
  stickerId: string;       // Emoji or shape ID
  position: { x: number; y: number }; // Percentage (0-100)
  startMs: number;
  durationMs: number;
  scale: number;           // 0.5 - 2.0
}

// Filter Preset
export interface FilterPreset {
  id: string;
  name: string;
  filter: string;          // CSS filter value
  thumbnail?: string;      // Preview color/gradient
}

// Animation Template
export interface AnimationTemplate {
  id: string;
  name: string;
  description: string;
}

// Text Style Template
export interface TextStyleTemplate {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  color: string;
  backgroundColor?: string;
  textShadow?: string;
  borderRadius?: string;
  padding?: string;
  letterSpacing?: string;
}

// Sticker Template
export interface StickerTemplate {
  id: string;
  emoji: string;
  name: string;
  category: 'reactions' | 'emotions' | 'objects' | 'shapes';
}

// Transition Types for clip boundaries
export type TransitionType = 'none' | 'zoom-punch' | 'flash' | 'shake' | 'glitch' | 'whip-pan' | 'speed-ramp';

export interface ClipTransition {
  id: string;
  type: TransitionType;
  clipIndex: number;      // Applied after this clip ends
  durationFrames: number;
  intensity: number;      // 0.5-2.0 multiplier
}

// Audio Settings for voice cleanup
export interface AudioSettings {
  enhanceAudio: boolean;
  noiseReduction: boolean;
  noiseReductionStrength: 'light' | 'medium' | 'strong';
  loudnessNormalization: boolean;
}

// Default audio settings (client-safe)
export const defaultAudioSettings: AudioSettings = {
  enhanceAudio: false,
  noiseReduction: true,
  noiseReductionStrength: 'medium',
  loudnessNormalization: true,
};

// Overlay State for context
export interface OverlayState {
  textOverlays: TextOverlay[];
  stickers: StickerOverlay[];
  filterId: string | null;
  showCaptionPreview: boolean;
  captionPositionY: number; // Percentage from top (0-100), default ~75 (bottom area)
  captionTemplateId: string; // References caption-templates
  audioSettings: AudioSettings;
  clipTransitions: ClipTransition[];
}

// Overlay Actions
export type OverlayAction =
  | { type: 'ADD_TEXT_OVERLAY'; payload: TextOverlay }
  | { type: 'UPDATE_TEXT_OVERLAY'; payload: { id: string; updates: Partial<TextOverlay> } }
  | { type: 'REMOVE_TEXT_OVERLAY'; payload: string }
  | { type: 'ADD_STICKER'; payload: StickerOverlay }
  | { type: 'UPDATE_STICKER'; payload: { id: string; updates: Partial<StickerOverlay> } }
  | { type: 'REMOVE_STICKER'; payload: string }
  | { type: 'SET_FILTER'; payload: string | null }
  | { type: 'TOGGLE_CAPTION_PREVIEW' }
  | { type: 'SET_CAPTION_POSITION'; payload: number }
  | { type: 'SET_CAPTION_TEMPLATE'; payload: string }
  | { type: 'SET_AUDIO_SETTINGS'; payload: Partial<AudioSettings> }
  | { type: 'ADD_TRANSITION'; payload: ClipTransition }
  | { type: 'UPDATE_TRANSITION'; payload: { id: string; updates: Partial<ClipTransition> } }
  | { type: 'REMOVE_TRANSITION'; payload: string }
  | { type: 'SET_TRANSITIONS'; payload: ClipTransition[] }
  | { type: 'SET_STATE'; payload: Partial<OverlayState> }
  | { type: 'RESET_OVERLAYS' };

// Render API extended types
export interface RenderOverlayParams {
  filterId?: string;
  textOverlays?: TextOverlay[];
  stickers?: StickerOverlay[];
  clipTransitions?: ClipTransition[];
}
