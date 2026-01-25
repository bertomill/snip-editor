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
 * Zoom Blur - Heavy dramatic zoom with intense motion blur
 * Very eye-catching for demos
 */
const zoomBlur: TransitionTemplate = {
  id: 'zoom-blur',
  name: 'Zoom Blur',
  description: 'Dramatic zoom with heavy blur',
  durationFrames: 8,
  apply: (frame, duration, intensity) => {
    // Aggressive zoom curve
    const maxScale = 1 + (0.25 * intensity); // Up to 1.25x zoom
    const scale = interpolate(
      frame,
      [0, duration * 0.3, duration * 0.5, duration],
      [1, maxScale, maxScale * 0.95, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.back(1.5)),
      }
    );

    // Heavy motion blur at peak
    const blurAmount = interpolate(
      frame,
      [0, duration * 0.3, duration * 0.6, duration],
      [0, 15 * intensity, 8 * intensity, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return {
      transform: `scale(${scale})`,
      filter: `blur(${blurAmount}px)`,
    };
  },
};

/**
 * RGB Split - Color channel separation effect
 * Creates that viral glitchy TikTok look
 */
const rgbSplit: TransitionTemplate = {
  id: 'rgb-split',
  name: 'RGB Split',
  description: 'Color channel separation',
  durationFrames: 6,
  apply: (frame, duration, intensity) => {
    const splitAmount = interpolate(
      frame,
      [0, duration * 0.4, duration],
      [0, 1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Create pseudo-RGB split using hue rotation and position shifts
    const xShift = 8 * intensity * splitAmount * (frame % 2 === 0 ? 1 : -1);
    const scale = 1 + (0.03 * splitAmount * intensity);

    return {
      transform: `translateX(${xShift}px) scale(${scale})`,
      filter: `saturate(${1 + splitAmount * 0.8}) contrast(${1 + splitAmount * 0.2}) hue-rotate(${splitAmount * 15 * intensity}deg)`,
    };
  },
  overlay: (frame, duration, intensity) => {
    const progress = interpolate(
      frame,
      [0, duration * 0.4, duration],
      [0, 1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Rapid color flashes
    const colors = ['#FF0080', '#00FFFF', '#FF0000', '#00FF00'];
    const colorIndex = Math.floor(frame * 2) % colors.length;

    return {
      visible: progress > 0.3 && frame % 2 === 0,
      backgroundColor: colors[colorIndex],
      opacity: 0.15 * intensity * progress,
    };
  },
};

/**
 * Spin Zoom - Rotation combined with zoom
 * Very dramatic, great for high-energy content
 */
const spinZoom: TransitionTemplate = {
  id: 'spin-zoom',
  name: 'Spin Zoom',
  description: 'Rotation + zoom combo',
  durationFrames: 10,
  apply: (frame, duration, intensity) => {
    // Quick spin (partial rotation)
    const rotation = interpolate(
      frame,
      [0, duration * 0.4, duration],
      [0, 15 * intensity, 0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.back(2)),
      }
    );

    // Zoom in then settle
    const scale = interpolate(
      frame,
      [0, duration * 0.3, duration * 0.6, duration],
      [1, 1.15 * intensity, 1.05, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      }
    );

    return {
      transform: `rotate(${rotation}deg) scale(${scale})`,
    };
  },
};

/**
 * Bounce Pop - Bouncy scale with overshoot
 * Fun, playful transition
 */
const bouncePop: TransitionTemplate = {
  id: 'bounce-pop',
  name: 'Bounce Pop',
  description: 'Bouncy scale with overshoot',
  durationFrames: 12,
  apply: (frame, duration, intensity) => {
    // Bouncy scale using spring-like curve
    const scale = interpolate(
      frame,
      [0, duration * 0.2, duration * 0.4, duration * 0.6, duration * 0.8, duration],
      [1, 1.2 * intensity, 0.92, 1.08 * intensity, 0.98, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }
    );

    // Slight vertical bounce
    const yOffset = interpolate(
      frame,
      [0, duration * 0.2, duration * 0.5, duration],
      [0, -15 * intensity, 5 * intensity, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return {
      transform: `scale(${scale}) translateY(${yOffset}px)`,
    };
  },
};

/**
 * Slide Push - Push old content out while new slides in
 * Classic but effective
 */
const slidePush: TransitionTemplate = {
  id: 'slide-push',
  name: 'Slide Push',
  description: 'Push content horizontally',
  durationFrames: 8,
  apply: (frame, duration, intensity) => {
    // Slide from right to left
    const xOffset = interpolate(
      frame,
      [0, duration],
      [100 * intensity, 0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      }
    );

    // Slight scale for depth
    const scale = interpolate(
      frame,
      [0, duration * 0.5, duration],
      [0.9, 1.02, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return {
      transform: `translateX(${xOffset}px) scale(${scale})`,
    };
  },
};

/**
 * Lens Distort - Barrel/pincushion distortion effect
 * Creates a warped, liquid-like transition
 */
const lensDistort: TransitionTemplate = {
  id: 'lens-distort',
  name: 'Lens Distort',
  description: 'Warped lens effect',
  durationFrames: 8,
  apply: (frame, duration, intensity) => {
    // Simulate lens distortion with scale oscillation
    const distortProgress = interpolate(
      frame,
      [0, duration * 0.3, duration * 0.6, duration],
      [0, 1, 0.8, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Non-uniform scale for distortion feel
    const scaleX = 1 + (0.1 * intensity * distortProgress);
    const scaleY = 1 - (0.05 * intensity * distortProgress);

    // Slight blur for lens feel
    const blur = 3 * intensity * distortProgress;

    return {
      transform: `scale(${scaleX}, ${scaleY})`,
      filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
    };
  },
};

/**
 * Strobe - Rapid flash strobe effect
 * Very attention-grabbing, club/concert vibe
 */
const strobe: TransitionTemplate = {
  id: 'strobe',
  name: 'Strobe',
  description: 'Rapid flash strobe',
  durationFrames: 8,
  apply: (frame) => {
    // Quick scale pulse on each strobe
    const pulse = frame % 2 === 0 ? 1.03 : 1;
    return {
      transform: `scale(${pulse})`,
    };
  },
  overlay: (frame, duration, intensity) => {
    // Rapid on/off flashing
    const strobeOn = frame % 2 === 0;
    const fadeOut = interpolate(
      frame,
      [0, duration],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return {
      visible: strobeOn && fadeOut > 0.2,
      backgroundColor: '#FFFFFF',
      opacity: 0.9 * intensity * fadeOut,
    };
  },
};

/**
 * Color Flash - Colored flash (pink/cyan gradient feel)
 * Modern, stylish transition
 */
const colorFlash: TransitionTemplate = {
  id: 'color-flash',
  name: 'Color Flash',
  description: 'Colorful flash effect',
  durationFrames: 6,
  apply: (frame, duration, intensity) => {
    // Slight zoom during flash
    const scale = interpolate(
      frame,
      [0, duration * 0.3, duration],
      [1, 1.05 * intensity, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return {
      transform: `scale(${scale})`,
    };
  },
  overlay: (frame, duration, intensity) => {
    const opacity = interpolate(
      frame,
      [0, duration * 0.3, duration],
      [0, 0.7 * intensity, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Alternate between pink and cyan
    const isPink = frame < duration / 2;
    const color = isPink ? '#FF00FF' : '#00FFFF';

    return {
      visible: opacity > 0.05,
      backgroundColor: color,
      opacity,
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
  // New dramatic transitions
  'zoom-blur': zoomBlur,
  'rgb-split': rgbSplit,
  'spin-zoom': spinZoom,
  'bounce-pop': bouncePop,
  'slide-push': slidePush,
  'lens-distort': lensDistort,
  'strobe': strobe,
  'color-flash': colorFlash,
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
