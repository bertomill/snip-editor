// Timeline dimension constants - adjusted for snip's compact vertical video UI

export const TIMELINE_CONSTANTS = {
  // Header height
  HEADER_HEIGHT: 48,

  // Track height - smaller for compact UI
  TRACK_HEIGHT: 40,

  TRACK_ITEM_HEIGHT: 32,

  // Row handles width
  HANDLE_WIDTH: 80,

  // Timeline markers
  MARKERS_HEIGHT: 32,
};

export const ZOOM_CONSTRAINTS = {
  min: 0.5,
  max: 10,
  step: 0.15,
  default: 1,
  zoomStep: 0.15,
  wheelStep: 0.1,
  transitionDuration: 100,
  easing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
};

export const SNAPPING_CONFIG = {
  gridSize: 0.1, // Snap to 0.1 second intervals
  edgeSnapTolerance: 0.05,
  prioritizeEdgeSnap: true,
};
