// Timeline type definitions - simplified for Snip

export enum TrackItemType {
  TEXT = "text",
  VIDEO = "video",
  STICKER = "sticker",
  SCRIPT = "script",   // Individual word from transcript
  PAUSE = "pause",     // Gap/pause between words
}

// A single timeline item (e.g., a clip, text overlay, etc.)
export interface TimelineItem {
  id: string;
  trackId: string;
  start: number; // in seconds - timeline position start
  end: number;   // in seconds - timeline position end
  label?: string;
  type?: TrackItemType | string;
  color?: string;
  data?: any;     // extra metadata for custom rendering
}

// A track (row) in the timeline
export interface TimelineTrack {
  id: string;
  name?: string;
  items: TimelineItem[];
  magnetic?: boolean;
  visible?: boolean;
  muted?: boolean;
}

// Timeline component props
export interface TimelineProps {
  tracks: TimelineTrack[];
  totalDuration: number; // total timeline length in seconds
  currentFrame?: number; // current frame position
  fps?: number; // frames per second for frame to time conversion
  onFrameChange?: (frame: number) => void; // callback when frame changes
  onItemMove?: (itemId: string, newStart: number, newEnd: number, newTrackId: string) => void;
  onItemResize?: (itemId: string, newStart: number, newEnd: number) => void;
  onItemSelect?: (itemId: string) => void;
  onDeleteItems?: (itemIds: string[]) => void;
  selectedItemIds?: string[];
  onSelectedItemsChange?: (itemIds: string[]) => void;
  onTracksChange?: (tracks: TimelineTrack[]) => void;
  showZoomControls?: boolean;
  // Playback controls
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  showPlaybackControls?: boolean;
}

// Timeline content area props
export interface TimelineContentProps {
  tracks: TimelineTrack[];
  totalDuration: number;
  viewportDuration: number;
  currentFrame: number;
  fps: number;
  zoomScale: number;
  onFrameChange?: (frame: number) => void;
  onItemSelect?: (itemId: string) => void;
  onDeleteItems?: (itemIds: string[]) => void;
  selectedItemIds?: string[];
  onSelectedItemsChange?: (itemIds: string[]) => void;
  onItemMove?: (itemId: string, newStart: number, newEnd: number, newTrackId: string) => void;
  onItemResize?: (itemId: string, newStart: number, newEnd: number) => void;
  timelineRef: React.RefObject<HTMLDivElement>;
  ghostMarkerPosition: number | null;
  isDragging: boolean;
}
