import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing } from 'remotion';
import { StickerOverlay } from '@/types/overlays';
import { getStickerById } from '../templates/sticker-templates';

interface StickerLayerProps {
  stickers: StickerOverlay[];
  fps: number;
}

/**
 * Renders sticker overlays with positioning and animations
 */
export const StickerLayer: React.FC<StickerLayerProps> = ({ stickers, fps }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {stickers.map((sticker) => {
        const startFrame = Math.floor((sticker.startMs / 1000) * fps);
        const durationFrames = Math.floor((sticker.durationMs / 1000) * fps);

        return (
          <Sequence
            key={sticker.id}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <StickerItem sticker={sticker} durationFrames={durationFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

interface StickerItemProps {
  sticker: StickerOverlay;
  durationFrames: number;
}

const StickerItem: React.FC<StickerItemProps> = ({ sticker, durationFrames }) => {
  const frame = useCurrentFrame();
  const stickerTemplate = getStickerById(sticker.stickerId);

  if (!stickerTemplate) return null;

  // Enter animation (first 10 frames)
  const enterProgress = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Exit animation (last 8 frames)
  const exitProgress = interpolate(
    frame,
    [durationFrames - 8, durationFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Scale animation with bounce on enter
  const enterScale = interpolate(enterProgress, [0, 0.6, 0.8, 1], [0, 1.2, 0.95, 1], {
    easing: Easing.out(Easing.cubic),
  });

  const exitScale = interpolate(exitProgress, [0, 1], [0, 1]);

  // Subtle floating animation
  const floatOffset = Math.sin(frame * 0.15) * 3;

  // Opacity
  const opacity = enterProgress * exitProgress;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${sticker.position.x}%`,
        top: `${sticker.position.y}%`,
        transform: `translate(-50%, -50%) scale(${sticker.scale * enterScale * exitScale}) translateY(${floatOffset}px)`,
        fontSize: '64px',
        opacity,
        filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.4))',
        userSelect: 'none',
      }}
    >
      {stickerTemplate.emoji}
    </div>
  );
};
