import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import {
  ENTER_DURATION_FRAMES,
  EXIT_DURATION_FRAMES,
  animationTemplates,
} from '../templates/animation-templates';
import { AnimationStyle } from '@/types/overlays';

interface AnimatedWrapperProps {
  enterAnimation: string;
  exitAnimation: string;
  startFrame: number;
  durationFrames: number;
  fps: number;
  children: React.ReactNode;
}

/**
 * Wrapper component that applies separate enter/exit animations to children
 * Uses function-based animation templates for flexibility
 */
export const AnimatedWrapper: React.FC<AnimatedWrapperProps> = ({
  enterAnimation,
  exitAnimation,
  startFrame,
  durationFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;
  const endFrame = durationFrames;

  // Calculate progress for enter and exit animations (0 to 1)
  const enterProgress = interpolate(
    localFrame,
    [0, ENTER_DURATION_FRAMES],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  const exitProgress = interpolate(
    localFrame,
    [endFrame - EXIT_DURATION_FRAMES, endFrame],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Determine if we're in enter, middle, or exit phase
  const isEntering = localFrame < ENTER_DURATION_FRAMES;
  const isExiting = localFrame > endFrame - EXIT_DURATION_FRAMES;

  // Get animation templates (fallback to fade if not found)
  const enterTemplate = animationTemplates[enterAnimation] || animationTemplates.fade;
  const exitTemplate = animationTemplates[exitAnimation] || animationTemplates.fade;

  // Get animation styles based on phase
  const getAnimationStyles = (): React.CSSProperties => {
    let enterStyles: AnimationStyle = { opacity: 1 };
    let exitStyles: AnimationStyle = { opacity: 1 };

    // Apply enter animation during enter phase
    if (isEntering) {
      enterStyles = enterTemplate.enter(enterProgress);
    }

    // Apply exit animation during exit phase
    if (isExiting) {
      exitStyles = exitTemplate.exit(exitProgress);
    }

    // If we're in both enter and exit phase (very short duration), combine them
    if (isEntering && isExiting) {
      // Multiply opacities
      const combinedOpacity = (enterStyles.opacity ?? 1) * (exitStyles.opacity ?? 1);

      // Combine transforms
      const transforms: string[] = [];
      if (enterStyles.transform) transforms.push(enterStyles.transform);
      if (exitStyles.transform) transforms.push(exitStyles.transform);

      // Combine filters
      const filters: string[] = [];
      if (enterStyles.filter) filters.push(enterStyles.filter);
      if (exitStyles.filter) filters.push(exitStyles.filter);

      return {
        opacity: combinedOpacity,
        transform: transforms.length > 0 ? transforms.join(' ') : undefined,
        filter: filters.length > 0 ? filters.join(' ') : undefined,
      };
    }

    // Return the active phase's styles
    if (isEntering) {
      return {
        opacity: enterStyles.opacity,
        transform: enterStyles.transform,
        filter: enterStyles.filter,
      };
    }

    if (isExiting) {
      return {
        opacity: exitStyles.opacity,
        transform: exitStyles.transform,
        filter: exitStyles.filter,
      };
    }

    // Middle phase - fully visible
    return { opacity: 1 };
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
