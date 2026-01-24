import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { ENTER_DURATION_FRAMES, EXIT_DURATION_FRAMES } from '../templates/animation-templates';

interface AnimatedWrapperProps {
  animationId: string;
  startFrame: number;
  durationFrames: number;
  fps: number;
  children: React.ReactNode;
}

/**
 * Wrapper component that applies enter/exit animations to children
 * Uses Remotion's interpolate for smooth frame-based animations
 */
export const AnimatedWrapper: React.FC<AnimatedWrapperProps> = ({
  animationId,
  startFrame,
  durationFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;
  const endFrame = durationFrames;

  // Calculate progress for enter and exit animations
  const enterProgress = interpolate(
    localFrame,
    [0, ENTER_DURATION_FRAMES],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  const exitProgress = interpolate(
    localFrame,
    [endFrame - EXIT_DURATION_FRAMES, endFrame],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Get animation styles based on animation type
  const getAnimationStyles = (): React.CSSProperties => {
    switch (animationId) {
      case 'none':
        return {};

      case 'fade': {
        const opacity = interpolate(enterProgress, [0, 1], [0, 1]) *
          interpolate(exitProgress, [0, 1], [1, 0]);
        return { opacity };
      }

      case 'scale': {
        const enterScale = interpolate(enterProgress, [0, 1], [0.5, 1], {
          easing: Easing.out(Easing.back(1.5)),
        });
        const exitScale = interpolate(exitProgress, [0, 1], [1, 0.5]);
        const opacity = interpolate(enterProgress, [0, 1], [0, 1]) *
          interpolate(exitProgress, [0, 1], [1, 0]);
        return {
          transform: `scale(${enterScale * exitScale})`,
          opacity,
        };
      }

      case 'slide-up': {
        const enterY = interpolate(enterProgress, [0, 1], [50, 0], {
          easing: Easing.out(Easing.cubic),
        });
        const exitY = interpolate(exitProgress, [0, 1], [0, -50], {
          easing: Easing.in(Easing.cubic),
        });
        const opacity = interpolate(enterProgress, [0, 1], [0, 1]) *
          interpolate(exitProgress, [0, 1], [1, 0]);
        return {
          transform: `translateY(${enterY + exitY}px)`,
          opacity,
        };
      }

      case 'slide-down': {
        const enterY = interpolate(enterProgress, [0, 1], [-50, 0], {
          easing: Easing.out(Easing.cubic),
        });
        const exitY = interpolate(exitProgress, [0, 1], [0, 50], {
          easing: Easing.in(Easing.cubic),
        });
        const opacity = interpolate(enterProgress, [0, 1], [0, 1]) *
          interpolate(exitProgress, [0, 1], [1, 0]);
        return {
          transform: `translateY(${enterY + exitY}px)`,
          opacity,
        };
      }

      case 'bounce': {
        const enterScale = interpolate(enterProgress, [0, 0.5, 0.75, 1], [0, 1.2, 0.9, 1], {
          easing: Easing.out(Easing.cubic),
        });
        const exitScale = interpolate(exitProgress, [0, 1], [1, 0], {
          easing: Easing.in(Easing.cubic),
        });
        const opacity = interpolate(enterProgress, [0, 0.2], [0, 1], {
          extrapolateRight: 'clamp',
        }) * interpolate(exitProgress, [0.8, 1], [1, 0], {
          extrapolateLeft: 'clamp',
        });
        return {
          transform: `scale(${enterScale * exitScale})`,
          opacity,
        };
      }

      default:
        return {};
    }
  };

  // Don't render if outside animation window
  if (localFrame < 0 || localFrame > durationFrames) {
    return null;
  }

  return (
    <div style={{ ...getAnimationStyles() }}>
      {children}
    </div>
  );
};
