/**
 * Types for Snip video overlays: Text, Stickers, and Filters
 */

// Text Overlay
export interface TextOverlay {
  id: string;
  content: string;
  templateId: string;      // References text-templates
  animationId: string;     // References animation-templates
  position: 'top' | 'center' | 'bottom';
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

// Overlay State for context
export interface OverlayState {
  textOverlays: TextOverlay[];
  stickers: StickerOverlay[];
  filterId: string | null;
  showCaptionPreview: boolean;
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
  | { type: 'RESET_OVERLAYS' };

// Render API extended types
export interface RenderOverlayParams {
  filterId?: string;
  textOverlays?: TextOverlay[];
  stickers?: StickerOverlay[];
}
