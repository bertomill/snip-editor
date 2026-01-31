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

// Entity (person or company)
export type EntityType = 'person' | 'company';

export interface Entity {
  id: string;
  userId: string;
  name: string;
  type: EntityType;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  socialAccounts?: SocialAccount[];
}

// Social media platforms
export type SocialPlatform = 'twitter' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'facebook' | 'threads' | 'substack';

export interface SocialAccount {
  id: string;
  entityId: string;
  userId: string;
  platform: SocialPlatform;
  handle?: string;
  profileUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityInput {
  name: string;
  type?: EntityType;
  avatarUrl?: string;
}

export interface UpdateEntityInput {
  name?: string;
  type?: EntityType;
  avatarUrl?: string;
}

export interface CreateSocialAccountInput {
  entityId: string;
  platform: SocialPlatform;
  handle?: string;
  profileUrl?: string;
}

export interface UpdateSocialAccountInput {
  handle?: string;
  profileUrl?: string;
}

export const SOCIAL_PLATFORMS: { id: SocialPlatform; name: string; icon: string; color: string }[] = [
  { id: 'twitter', name: 'X (Twitter)', icon: 'x', color: '#000000' },
  { id: 'instagram', name: 'Instagram', icon: 'instagram', color: '#E4405F' },
  { id: 'tiktok', name: 'TikTok', icon: 'tiktok', color: '#000000' },
  { id: 'youtube', name: 'YouTube', icon: 'youtube', color: '#FF0000' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'linkedin', color: '#0A66C2' },
  { id: 'facebook', name: 'Facebook', icon: 'facebook', color: '#1877F2' },
  { id: 'threads', name: 'Threads', icon: 'threads', color: '#000000' },
  { id: 'substack', name: 'Substack', icon: 'substack', color: '#FF6719' },
];

export type IdeaStatus = 'draft' | 'in_progress' | 'published' | 'archived';

export interface Idea {
  id: string;
  userId: string;
  channelId?: string;
  title: string;
  description?: string;
  draftContent?: string; // AI-generated post content
  platformDrafts?: Record<string, string>; // Platform-specific drafts
  publishedContent?: string; // Final content that was actually posted
  publishedAt?: string; // When it was published
  publishedPlatforms?: string[]; // Which platforms it was posted to
  tags: string[];
  imageUrl?: string;
  videoUrl?: string;
  status: IdeaStatus;
  targetPlatforms: string[]; // Social account IDs
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
  draftContent?: string;
  platformDrafts?: Record<string, string>;
  publishedContent?: string;
  publishedAt?: string;
  publishedPlatforms?: string[];
  channelId?: string;
  tags?: string[];
  imageUrl?: string;
  videoUrl?: string;
  status?: IdeaStatus;
  targetPlatforms?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateIdeaInput {
  title?: string;
  description?: string;
  draftContent?: string | null;
  platformDrafts?: Record<string, string> | null;
  publishedContent?: string | null;
  publishedAt?: string | null;
  publishedPlatforms?: string[] | null;
  channelId?: string | null;
  tags?: string[];
  imageUrl?: string | null;
  videoUrl?: string | null;
  status?: IdeaStatus;
  targetPlatforms?: string[];
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
