export interface Channel {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export type IdeaStatus = 'draft' | 'in_progress' | 'published' | 'archived';

export interface Idea {
  id: string;
  userId: string;
  channelId?: string;
  title: string;
  description?: string;
  tags: string[];
  imageUrl?: string;
  videoUrl?: string;
  status: IdeaStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateChannelInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface CreateIdeaInput {
  title: string;
  description?: string;
  channelId?: string;
  tags?: string[];
  imageUrl?: string;
  videoUrl?: string;
  status?: IdeaStatus;
  metadata?: Record<string, unknown>;
}

export interface UpdateIdeaInput {
  title?: string;
  description?: string;
  channelId?: string | null;
  tags?: string[];
  imageUrl?: string | null;
  videoUrl?: string | null;
  status?: IdeaStatus;
  metadata?: Record<string, unknown>;
}

export const CHANNEL_COLORS = [
  '#4A8FE7', // Blue (default)
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
] as const;

export const CHANNEL_ICONS = [
  'folder',
  'lightbulb',
  'star',
  'heart',
  'bookmark',
  'flag',
  'tag',
  'zap',
] as const;

export const IDEA_STATUS_CONFIG: Record<IdeaStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: '#8E8E93', bgColor: '#8E8E93/20' },
  in_progress: { label: 'In Progress', color: '#F59E0B', bgColor: '#F59E0B/20' },
  published: { label: 'Published', color: '#10B981', bgColor: '#10B981/20' },
  archived: { label: 'Archived', color: '#EF4444', bgColor: '#EF4444/20' },
};
