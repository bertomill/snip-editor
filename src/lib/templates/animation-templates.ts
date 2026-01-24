import { AnimationTemplate } from '@/types/overlays';

/**
 * Animation templates for text overlays
 * Uses Remotion's interpolate for smooth enter/exit animations
 */
export const animationTemplates: AnimationTemplate[] = [
  {
    id: 'none',
    name: 'None',
    description: 'No animation, instant appear/disappear',
  },
  {
    id: 'fade',
    name: 'Fade',
    description: 'Smooth fade in and out',
  },
  {
    id: 'scale',
    name: 'Scale',
    description: 'Scale up on enter, down on exit',
  },
  {
    id: 'slide-up',
    name: 'Slide Up',
    description: 'Slide in from bottom, out to top',
  },
  {
    id: 'slide-down',
    name: 'Slide Down',
    description: 'Slide in from top, out to bottom',
  },
  {
    id: 'bounce',
    name: 'Bounce',
    description: 'Bouncy scale animation',
  },
];

export function getAnimationById(id: string): AnimationTemplate | undefined {
  return animationTemplates.find(a => a.id === id);
}

export function getDefaultAnimation(): AnimationTemplate {
  return animationTemplates[1]; // Fade as default
}

/**
 * Animation timing configuration
 * Used by the AnimatedWrapper component
 */
export const ANIMATION_DURATION_FRAMES = 15; // ~0.5s at 30fps
export const ENTER_DURATION_FRAMES = 15;
export const EXIT_DURATION_FRAMES = 12;
