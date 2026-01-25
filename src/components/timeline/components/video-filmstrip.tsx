'use client';

import React, { useEffect, useState, useRef } from 'react';
import { extractVideoThumbnails, VideoThumbnail } from '@/lib/utils/video-thumbnails';

interface VideoFilmstripProps {
  videoSrc: string;
  cacheKey: string;
  className?: string;
}

// Global cache to persist thumbnails across re-renders
const globalThumbnailCache = new Map<string, VideoThumbnail[]>();

export const VideoFilmstrip: React.FC<VideoFilmstripProps> = ({
  videoSrc,
  cacheKey,
  className = '',
}) => {
  const [thumbnails, setThumbnails] = useState<VideoThumbnail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadThumbnails = async () => {
      // Check cache first
      if (globalThumbnailCache.has(cacheKey)) {
        const cached = globalThumbnailCache.get(cacheKey)!;
        setThumbnails(cached);
        // Estimate duration from cached thumbnails
        if (cached.length > 1) {
          const interval = cached[1].time - cached[0].time;
          setVideoDuration(interval * cached.length);
        }
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Extract thumbnails every 0.5 seconds for smooth filmstrip when zoomed
        const extracted = await extractVideoThumbnails(videoSrc, 0.5, 80, 200);

        if (!cancelled && extracted.length > 0) {
          globalThumbnailCache.set(cacheKey, extracted);
          setThumbnails(extracted);
          // Calculate duration from last thumbnail time
          const lastThumb = extracted[extracted.length - 1];
          const interval = extracted.length > 1 ? extracted[1].time - extracted[0].time : 0.5;
          setVideoDuration(lastThumb.time + interval);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to extract thumbnails:', error);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    if (videoSrc) {
      loadThumbnails();
    }

    return () => {
      cancelled = true;
    };
  }, [videoSrc, cacheKey]);

  if (isLoading || thumbnails.length === 0) {
    // Show loading shimmer or solid color fallback
    return (
      <div
        className={`absolute inset-0 bg-gradient-to-r from-blue-600/50 to-blue-500/50 ${className}`}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        )}
      </div>
    );
  }

  // Fixed thumbnail width - each thumbnail represents its time slice
  // Height matches track height (~40px), width based on 9:16 aspect ratio
  const thumbHeight = 40;
  const thumbWidth = Math.round(thumbHeight * (9 / 16)); // ~22px for 9:16 video

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="flex h-full">
        {thumbnails.map((thumb, index) => (
          <img
            key={index}
            src={thumb.dataUrl}
            alt=""
            className="h-full flex-shrink-0 object-cover"
            style={{
              width: `${(1 / thumbnails.length) * 100}%`,
              minWidth: `${thumbWidth}px`,
            }}
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoFilmstrip;
