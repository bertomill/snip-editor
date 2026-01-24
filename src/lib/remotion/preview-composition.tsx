import React from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo, useCurrentFrame } from 'remotion';
import { CaptionLayer } from './caption-layer';
import { TextLayer } from './text-layer';
import { StickerLayer } from './sticker-layer';
import { SnipCaption, CaptionStyles } from '../types/composition';
import { TextOverlay, StickerOverlay } from '@/types/overlays';
import { getFilterById } from '../templates/filter-presets';

export interface PreviewCompositionProps {
  videoSrc: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  captions: SnipCaption[];
  captionStyles: CaptionStyles;
  showCaptionPreview: boolean;
  textOverlays: TextOverlay[];
  stickers: StickerOverlay[];
  filterId: string | null;
}

/**
 * Preview composition for @remotion/player
 * Shows video with captions, text overlays, stickers, and filters
 */
export const PreviewComposition: React.FC<PreviewCompositionProps> = ({
  videoSrc,
  captions,
  captionStyles,
  showCaptionPreview,
  textOverlays,
  stickers,
  filterId,
  fps,
}) => {
  const frame = useCurrentFrame();

  // Get filter CSS
  const filter = filterId ? getFilterById(filterId) : null;
  const filterStyle = filter && filter.id !== 'none' ? filter.filter : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Video Layer with optional filter */}
      <AbsoluteFill style={{ filter: filterStyle }}>
        <OffthreadVideo
          src={videoSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>

      {/* Stickers Layer */}
      {stickers.length > 0 && (
        <StickerLayer stickers={stickers} fps={fps} />
      )}

      {/* Text Overlays Layer */}
      {textOverlays.length > 0 && (
        <TextLayer textOverlays={textOverlays} fps={fps} />
      )}

      {/* Caption Layer - positioned at bottom */}
      {showCaptionPreview && captions.length > 0 && (
        <AbsoluteFill
          style={{
            top: 'auto',
            bottom: 0,
            height: '30%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <CaptionLayer
            captions={captions}
            styles={captionStyles}
            fps={fps}
            currentFrame={frame}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/**
 * Multi-clip preview composition for the player
 * Handles multiple video clips in sequence
 */
export interface MultiClipPreviewProps {
  clips: {
    src: string;
    startMs: number;
    endMs: number;
  }[];
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  captions: SnipCaption[];
  captionStyles: CaptionStyles;
  showCaptionPreview: boolean;
  textOverlays: TextOverlay[];
  stickers: StickerOverlay[];
  filterId: string | null;
}

export const MultiClipPreview: React.FC<MultiClipPreviewProps> = ({
  clips,
  captions,
  captionStyles,
  showCaptionPreview,
  textOverlays,
  stickers,
  filterId,
  fps,
}) => {
  const frame = useCurrentFrame();

  // Get filter CSS
  const filter = filterId ? getFilterById(filterId) : null;
  const filterStyle = filter && filter.id !== 'none' ? filter.filter : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Video Clips Layer with optional filter */}
      <AbsoluteFill style={{ filter: filterStyle }}>
        {clips.map((clip, index) => {
          const startFrame = Math.floor((clip.startMs / 1000) * fps);
          const durationFrames = Math.floor(((clip.endMs - clip.startMs) / 1000) * fps);

          return (
            <Sequence
              key={`clip-${index}`}
              from={startFrame}
              durationInFrames={durationFrames}
            >
              <AbsoluteFill>
                <OffthreadVideo
                  src={clip.src}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </AbsoluteFill>
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {/* Stickers Layer */}
      {stickers.length > 0 && (
        <StickerLayer stickers={stickers} fps={fps} />
      )}

      {/* Text Overlays Layer */}
      {textOverlays.length > 0 && (
        <TextLayer textOverlays={textOverlays} fps={fps} />
      )}

      {/* Caption Layer - positioned at bottom */}
      {showCaptionPreview && captions.length > 0 && (
        <AbsoluteFill
          style={{
            top: 'auto',
            bottom: 0,
            height: '30%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <CaptionLayer
            captions={captions}
            styles={captionStyles}
            fps={fps}
            currentFrame={frame}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
