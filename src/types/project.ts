export interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  clipCount: number;
  latestRenderStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  data?: ProjectData;
}

import { TextOverlay, StickerOverlay, AudioSettings, ClipTransition } from './overlays';

export interface ProjectData {
  overlays?: {
    textOverlays: TextOverlay[];
    stickers: StickerOverlay[];
    filterId: string | null;
    captionPositionY: number;
    audioSettings?: AudioSettings;
    clipTransitions?: ClipTransition[];
    showCaptionPreview?: boolean;
  };
  deletedWordIds?: string[];
  deletedPauseIds?: string[];
  clipCount?: number;
}

export interface TranscriptWord {
  id: string;
  word: string;
  start: number;
  end: number;
}

export interface ProjectWithClips extends Project {
  clips: ProjectClip[];
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

export interface ProjectClip {
  id: string;
  projectId: string;
  storagePath: string;
  filename: string;
  duration: number;
  order: number;
  createdAt: string;
  transcript?: string;
  segments?: TranscriptSegment[];
  words?: TranscriptWord[];
}
