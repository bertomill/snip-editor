'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { MediaFile, MediaType } from '@/types/media';
import { useUser } from '@/lib/supabase/hooks';
import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';

interface MediaLibraryContextValue {
  mediaFiles: MediaFile[];
  isLoading: boolean;
  error: string | null;
  refreshMedia: () => Promise<void>;
  uploadMedia: (file: File) => Promise<MediaFile | null>;
  deleteMedia: (fileId: string) => Promise<boolean>;
  getFilteredMedia: (type: MediaType | 'all') => MediaFile[];
}

const MediaLibraryContext = createContext<MediaLibraryContextValue | null>(null);

export function MediaLibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch media files from Supabase
  const refreshMedia = useCallback(async () => {
    if (!user?.id) {
      setMediaFiles([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/media/list');
      const data = await response.json();

      if (response.ok) {
        setMediaFiles(data.files || []);
      } else {
        setError(data.error || 'Failed to fetch media');
      }
    } catch (err) {
      setError('Failed to fetch media');
      console.error('Error fetching media:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Upload a new media file directly to Supabase (bypasses Vercel's 4.5MB API limit)
  const uploadMedia = useCallback(async (file: File): Promise<MediaFile | null> => {
    if (!user?.id) {
      setError('You must be logged in to upload files');
      return null;
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 100MB.');
      return null;
    }

    try {
      const supabase = createClient();

      // Determine media type
      const getMediaType = (mimeType: string): MediaType => {
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'video';
      };

      const mediaType = getMediaType(file.type);
      const fileId = uuidv4();
      const fileExtension = file.name.split('.').pop() || '';
      const storagePath = `${user.id}/${fileId}.${fileExtension}`;

      // Upload directly to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError('Failed to upload file: ' + uploadError.message);
        return null;
      }

      // Get signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

      if (signedUrlError) {
        console.error('Signed URL error:', signedUrlError);
      }

      // Create media file record
      const mediaFile: MediaFile = {
        id: fileId,
        name: file.name,
        type: mediaType,
        url: signedUrlData?.signedUrl || '',
        size: file.size,
        userId: user.id,
        createdAt: new Date().toISOString(),
        storagePath: storagePath,
      };

      setMediaFiles(prev => [mediaFile, ...prev]);
      return mediaFile;
    } catch (err) {
      setError('Failed to upload file');
      console.error('Error uploading file:', err);
      return null;
    }
  }, [user?.id]);

  // Delete a media file
  const deleteMedia = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/media/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });

      if (response.ok) {
        setMediaFiles(prev => prev.filter(f => f.id !== fileId));
        return true;
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete file');
        return false;
      }
    } catch (err) {
      setError('Failed to delete file');
      console.error('Error deleting file:', err);
      return false;
    }
  }, []);

  // Get filtered media by type
  const getFilteredMedia = useCallback((type: MediaType | 'all'): MediaFile[] => {
    if (type === 'all') return mediaFiles;
    return mediaFiles.filter(file => file.type === type);
  }, [mediaFiles]);

  // Load media on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      refreshMedia();
    }
  }, [user?.id, refreshMedia]);

  return (
    <MediaLibraryContext.Provider
      value={{
        mediaFiles,
        isLoading,
        error,
        refreshMedia,
        uploadMedia,
        deleteMedia,
        getFilteredMedia,
      }}
    >
      {children}
    </MediaLibraryContext.Provider>
  );
}

export function useMediaLibrary() {
  const context = useContext(MediaLibraryContext);
  if (!context) {
    throw new Error('useMediaLibrary must be used within a MediaLibraryProvider');
  }
  return context;
}
