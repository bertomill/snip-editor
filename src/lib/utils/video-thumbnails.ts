/**
 * Utility for extracting video thumbnails for timeline filmstrip
 */

export interface VideoThumbnail {
  time: number;
  dataUrl: string;
}

/**
 * Extract thumbnails from a video at regular time intervals
 * @param videoSrc - The video source URL (can be blob URL or regular URL)
 * @param intervalSeconds - Time interval between thumbnails (default 0.5 seconds for smooth filmstrip)
 * @param thumbnailHeight - Height of each thumbnail (width auto-calculated)
 * @param maxThumbnails - Maximum number of thumbnails to extract (to prevent memory issues)
 * @returns Promise<VideoThumbnail[]>
 */
export async function extractVideoThumbnails(
  videoSrc: string,
  intervalSeconds: number = 0.5,
  thumbnailHeight: number = 80,
  maxThumbnails: number = 200
): Promise<VideoThumbnail[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    const thumbnails: VideoThumbnail[] = [];
    let currentIndex = 0;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!duration || duration === Infinity) {
        reject(new Error('Could not determine video duration'));
        return;
      }

      // Calculate aspect ratio and canvas dimensions
      const aspectRatio = video.videoWidth / video.videoHeight;
      const thumbnailWidth = Math.round(thumbnailHeight * aspectRatio);

      canvas.width = thumbnailWidth;
      canvas.height = thumbnailHeight;

      // Calculate time intervals - one thumbnail every intervalSeconds
      const numThumbnails = Math.min(
        Math.ceil(duration / intervalSeconds),
        maxThumbnails
      );
      const actualInterval = duration / numThumbnails;
      const times = Array.from({ length: numThumbnails }, (_, i) => i * actualInterval);

      const captureFrame = () => {
        if (currentIndex >= times.length) {
          resolve(thumbnails);
          video.remove();
          return;
        }

        const time = times[currentIndex];
        video.currentTime = time;
      };

      video.onseeked = () => {
        // Draw the current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to data URL with good quality for sharp thumbnails
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        thumbnails.push({
          time: times[currentIndex],
          dataUrl,
        });

        currentIndex++;
        captureFrame();
      };

      video.onerror = () => {
        reject(new Error('Error loading video'));
      };

      // Start capturing
      captureFrame();
    };

    video.onerror = () => {
      reject(new Error('Error loading video for thumbnail extraction'));
    };

    video.src = videoSrc;
  });
}

/**
 * Create a filmstrip CSS background from thumbnails
 */
export function createFilmstripBackground(thumbnails: VideoThumbnail[]): string {
  if (thumbnails.length === 0) return '';

  // Create a repeating pattern of thumbnails
  const backgrounds = thumbnails.map((t, i) => {
    const position = (i / thumbnails.length) * 100;
    return `url(${t.dataUrl})`;
  });

  return backgrounds.join(', ');
}

/**
 * Cache for video thumbnails to avoid re-extraction
 */
const thumbnailCache = new Map<string, VideoThumbnail[]>();

export async function getCachedThumbnails(
  videoSrc: string,
  cacheKey: string,
  intervalSeconds: number = 0.5
): Promise<VideoThumbnail[]> {
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey)!;
  }

  const thumbnails = await extractVideoThumbnails(videoSrc, intervalSeconds);
  thumbnailCache.set(cacheKey, thumbnails);
  return thumbnails;
}

export function clearThumbnailCache(cacheKey?: string): void {
  if (cacheKey) {
    thumbnailCache.delete(cacheKey);
  } else {
    thumbnailCache.clear();
  }
}
