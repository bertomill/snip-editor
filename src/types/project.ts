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

export interface ProjectData {
  overlays?: {
    textOverlays: unknown[];
    stickers: unknown[];
    filterId: string | null;
    captionPositionY: number;
  };
  deletedWordIds?: string[];
  clipCount?: number;
}

export interface ProjectWithClips extends Project {
  clips: ProjectClip[];
}

export interface ProjectClip {
  id: string;
  projectId: string;
  storagePath: string;
  filename: string;
  duration: number;
  order: number;
  createdAt: string;
}
