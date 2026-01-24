/**
 * TikTok-style transition templates for clip boundaries
 * Uses pure Remotion interpolate() - no external libraries needed
 */
import { interpolate, Easing } from "remotion";
import { TransitionType } from "@/types/overlays";

export interface TransitionEffect {
  transform?: string;
  opacity?: number;
  filter?: string;
}

export interface TransitionTemplate {
  id: TransitionType;
  name: string;
  description: string;
  durationFrames: number;
  /**
   * Apply transition effect at a given frame
   * @param frame - Current frame relative to transition start (0 to durationFrames)
   * @param durationFrames - Total duration of the transition
   * @param intensity - Multiplier for effect strength (0.5 - 2.0)
   * @returns Style properties to apply
   */
  apply: (frame: number, durationFrames: number, intensity: number) => TransitionEffect;
  /**
   * Some transitions need an overlay element (like flash)
   */
  overlay?: (frame: number, durationFrames: number, intensity: number) => {
    visible: boolean;
    backgroundColor?: string;
    opacity?: number;
  };
}

/**
 * Zoom Punch - Scale 1.0 -> 1.05 -> 1.0 at cut point
 * The quintessential TikTok transition effect
 */
const zoomPunch: TransitionTemplate = {
  id: 'zoom-punch',
  name: 'Zoom Punch',
  description: 'Quick zoom in/out at cut',
  durationFrames: 6,
  apply: (frame, duration, intensity) => {
    const maxScale = 1 + (0.05 * intensity);
    const scale = interpolate(
      frame,
      [0, duration / 2, duration],
      [1, maxScale, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    return {
      transform: `scale(${scale})`,
    };
  },
};

/**
 * Flash - White overlay fade at cut
 * Creates a punchy flash effect between clips
 */
const flash: TransitionTemplate = {
  id: 'flash',
  name: 'Flash',
  description: 'White flash at cut point',
  durationFrames: 4,
  apply: () => ({}), // No transform, just overlay
  overlay: (frame, duration, intensity) => {
    const opacity = interpolate(
      frame,
      [0, duration / 2, duration],
      [0, 0.8 * intensity, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    return {
      visible: opacity > 0.01,
      backgroundColor: '#FFFFFF',
      opacity,
    };
  },
};

/**
 * Shake - Horizontal wobble at cut
 * Energetic shake effect for dynamic cuts
 */
const shake: TransitionTemplate = {
  id: 'shake',
  name: 'Shake',
  description: 'Horizontal shake at cut',
  durationFrames: 8,
  apply: (frame, duration, intensity) => {
    // Create oscillating movement that dampens over time
    const baseAmplitude = 10 * intensity;
    const progress = frame / duration;
    const dampening = 1 - progress;

    // Oscillate using sine wave, getting faster then slower
    const frequency = interpolate(
      frame,
      [0, duration / 2, duration],
      [2, 6, 2],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    const xOffset = Math.sin(frame * frequency) * baseAmplitude * dampening;

    return {
      transform: `translateX(${xOffset}px)`,
    };
  },
};

/**
 * Glitch - RGB split + slight displacement
 * Digital glitch effect for tech/gaming content
 */
const glitch: TransitionTemplate = {
  id: 'glitch',
  name: 'Glitch',
  description: 'Digital glitch effect',
  durationFrames: 5,
  apply: (frame, duration, intensity) => {
    // Create glitchy displacement
    const progress = frame / duration;
    const glitchIntensity = interpolate(
      frame,
      [0, duration / 2, duration],
      [0, 1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Random-ish displacement using frame number
    const xOffset = ((frame * 7) % 11 - 5) * intensity * glitchIntensity * 2;
    const yOffset = ((frame * 13) % 7 - 3) * intensity * glitchIntensity;

    // Slight scale jitter
    const scaleJitter = 1 + (((frame * 3) % 5 - 2) * 0.01 * intensity * glitchIntensity);

    return {
      transform: `translate(${xOffset}px, ${yOffset}px) scale(${scaleJitter})`,
      // Use filter to create RGB-split-like effect via hue rotation
      filter: glitchIntensity > 0.3
        ? `hue-rotate(${((frame * 17) % 30 - 15) * intensity}deg) saturate(${1 + glitchIntensity * 0.5})`
        : undefined,
    };
  },
  overlay: (frame, duration, intensity) => {
    // Brief color flash during peak glitch
    const glitchIntensity = interpolate(
      frame,
      [0, duration / 2, duration],
      [0, 1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    const showOverlay = glitchIntensity > 0.6 && frame % 2 === 0;

    return {
      visible: showOverlay,
      backgroundColor: frame % 4 === 0 ? '#FF0000' : frame % 4 === 2 ? '#00FF00' : '#0000FF',
      opacity: 0.15 * intensity,
    };
  },
};

/**
 * Whip Pan - Motion blur slide effect
 * Simulates a fast camera pan
 */
const whipPan: TransitionTemplate = {
  id: 'whip-pan',
  name: 'Whip Pan',
  description: 'Fast pan blur effect',
  durationFrames: 6,
  apply: (frame, duration, intensity) => {
    // Move right then back to center
    const xOffset = interpolate(
      frame,
      [0, duration / 3, duration * 2/3, duration],
      [0, 30 * intensity, -10 * intensity, 0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      }
    );

    // Motion blur at peak movement
    const blurAmount = interpolate(
      frame,
      [0, duration / 3, duration],
      [0, 8 * intensity, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return {
      transform: `translateX(${xOffset}px)`,
      filter: blurAmount > 0.5 ? `blur(${blurAmount}px)` : undefined,
    };
  },
};

/**
 * Speed Ramp - Scale + blur for motion feel
 * Creates the feeling of acceleration/deceleration
 */
const speedRamp: TransitionTemplate = {
  id: 'speed-ramp',
  name: 'Speed Ramp',
  description: 'Scale + blur motion effect',
  durationFrames: 8,
  apply: (frame, duration, intensity) => {
    // Scale up then settle
    const scale = interpolate(
      frame,
      [0, duration / 3, duration * 2/3, duration],
      [1, 1.08 * intensity, 1.02, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
      }
    );

    // Radial blur effect (simulated with regular blur)
    const blurAmount = interpolate(
      frame,
      [0, duration / 4, duration / 2, duration],
      [0, 4 * intensity, 2 * intensity, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return {
      transform: `scale(${scale})`,
      filter: blurAmount > 0.5 ? `blur(${blurAmount}px)` : undefined,
    };
  },
};

/**
 * No transition - placeholder for when transitions are disabled
 */
const none: TransitionTemplate = {
  id: 'none',
  name: 'None',
  description: 'No transition effect',
  durationFrames: 0,
  apply: () => ({}),
};

/**
 * All available transition templates
 */
export const transitionTemplates: Record<TransitionType, TransitionTemplate> = {
  'none': none,
  'zoom-punch': zoomPunch,
  'flash': flash,
  'shake': shake,
  'glitch': glitch,
  'whip-pan': whipPan,
  'speed-ramp': speedRamp,
};

/**
 * Get a transition template by ID
 */
export function getTransitionTemplate(id: TransitionType): TransitionTemplate {
  return transitionTemplates[id] || transitionTemplates['none'];
}

/**
 * Get all transition templates as an array (for UI)
 */
export function getAllTransitionTemplates(): TransitionTemplate[] {
  return Object.values(transitionTemplates);
}

/**
 * Get only active transition templates (excludes 'none')
 */
export function getActiveTransitionTemplates(): TransitionTemplate[] {
  return Object.values(transitionTemplates).filter(t => t.id !== 'none');
}
