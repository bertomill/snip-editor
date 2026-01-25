// Timeline dimension constants - adjusted for snip's compact vertical video UI

export const TIMELINE_CONSTANTS = {
  // Header height
  HEADER_HEIGHT: 48,

  // Track height - taller for easier interaction
  TRACK_HEIGHT: 52,
  TRACK_ITEM_HEIGHT: 44,

  // Script track - thinner for secondary content
  SCRIPT_TRACK_HEIGHT: 36,
  SCRIPT_TRACK_ITEM_HEIGHT: 28,

  // Row handles width
  HANDLE_WIDTH: 80,

  // Timeline markers
  MARKERS_HEIGHT: 32,
};

export const ZOOM_CONSTRAINTS = {
  min: 0.5,
  max: 50,        // Increased for Descript-level zoom (frame-by-frame editing)
  step: 0.3,      // Increased for more responsive button clicks
  default: 0.8,   // Start at 80% zoom
  zoomStep: 0.3,  // Increased for more responsive zoom
  wheelStep: 0.2, // Increased for more responsive Ctrl+scroll
  transitionDuration: 100,
  easing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
};

export const SNAPPING_CONFIG = {
  gridSize: 0.1, // Snap to 0.1 second intervals
  edgeSnapTolerance: 0.05,
  prioritizeEdgeSnap: true,
};

export const SCRIPT_TRACK_CONSTANTS = {
  PAUSE_THRESHOLD_SECONDS: 0.3,  // Minimum gap to show as pause
  MIN_WORD_WIDTH_PX: 12,         // Minimum visual width for a word
};
