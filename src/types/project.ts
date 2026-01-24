export interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  clipCount: number;
  latestRenderStatus?: 'pending' | 'processing' | 'completed' | 'failed';
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
