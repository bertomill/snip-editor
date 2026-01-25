/**
 * Types for Snip video overlays: Text, Stickers, and Filters
 */

// Text Overlay
export interface TextOverlay {
  id: string;
  content: string;
  templateId: string;      // References text-templates
  enterAnimation: string;  // References animation-templates (enter phase)
  exitAnimation: string;   // References animation-templates (exit phase)
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

// Music Track
export interface MusicTrack {
  id: string;
  pixabayId: number;        // Pixabay track ID
  url: string;              // MP3 URL for playback/render
  name: string;             // Track title
  artist: string;           // Artist name
  startMs: number;          // When music starts in timeline
  durationMs: number;       // How long music plays
  trimStartMs: number;      // Offset into audio file
  volume: number;           // 0-1 volume level
}

// Filter Preset
export interface FilterPreset {
  id: string;
  name: string;
  filter: string;          // CSS filter value
  thumbnail?: string;      // Preview color/gradient
}

// Animation Style returned by animation functions
export interface AnimationStyle {
  opacity?: number;
  transform?: string;
  filter?: string;
}

// Animation Template with function-based enter/exit
export interface AnimationTemplate {
  id: string;
  name: string;
  description: string;
  enter: (progress: number) => AnimationStyle;
  exit: (progress: number) => AnimationStyle;
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
export type TransitionType =
  | 'none'
  | 'zoom-punch'
  | 'flash'
  | 'shake'
  | 'glitch'
  | 'whip-pan'
  | 'speed-ramp'
  // New dramatic transitions
  | 'zoom-blur'      // Heavy zoom with motion blur
  | 'rgb-split'      // Color channel separation
  | 'spin-zoom'      // Rotation + zoom combo
  | 'bounce-pop'     // Bouncy scale with overshoot
  | 'slide-push'     // Push old content out
  | 'lens-distort'   // Barrel/pincushion distortion
  | 'strobe'         // Rapid flash strobe effect
  | 'color-flash';   // Colored flash (pink/cyan)

export interface ClipTransition {
  id: string;
  type: TransitionType;
  clipIndex: number;      // Applied after this clip ends
  durationFrames: number;
  intensity: number;      // 0.5-2.0 multiplier
  // Internal cut support: when set, this is a cut within a clip (silence removal)
  // The cutTimeMs is the timestamp in the OUTPUT video where the cut occurs
  cutTimeMs?: number;
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
  musicTracks: MusicTrack[];
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
  | { type: 'ADD_MUSIC_TRACK'; payload: MusicTrack }
  | { type: 'UPDATE_MUSIC_TRACK'; payload: { id: string; updates: Partial<MusicTrack> } }
  | { type: 'REMOVE_MUSIC_TRACK'; payload: string }
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
  musicTracks?: MusicTrack[];
}
