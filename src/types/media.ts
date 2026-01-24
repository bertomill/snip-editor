/**
 * Types for Media Library
 */

export type MediaType = 'video' | 'image' | 'audio';

export interface MediaFile {
  id: string;
  name: string;
  type: MediaType;
  url: string;           // Supabase storage URL
  thumbnailUrl?: string; // For videos/images
  size: number;          // File size in bytes
  duration?: number;     // Duration in seconds (for video/audio)
  userId: string;
  createdAt: string;
  storagePath: string;   // Path in Supabase storage bucket
}

export interface MediaUploadResult {
  success: boolean;
  file?: MediaFile;
  error?: string;
}
