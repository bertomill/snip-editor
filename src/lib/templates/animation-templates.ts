import { AnimationTemplate } from '@/types/overlays';

/**
 * Animation templates for text overlays with separate enter/exit functions
 * Each animation provides independent enter and exit behaviors
 * Progress parameter ranges from 0 to 1
 */

// Easing functions for smoother animations
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
};
const easeOutElastic = (t: number) => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

export const animationTemplates: Record<string, AnimationTemplate> = {
  none: {
    id: 'none',
    name: 'None',
    description: 'Instant appear/disappear',
    enter: () => ({ opacity: 1 }),
    exit: () => ({ opacity: 1 }),
  },

  fade: {
    id: 'fade',
    name: 'Fade',
    description: 'Simple opacity transition',
    enter: (progress) => ({
      opacity: easeOutCubic(progress),
    }),
    exit: (progress) => ({
      opacity: 1 - easeInCubic(progress),
    }),
  },

  scale: {
    id: 'scale',
    name: 'Scale',
    description: 'Scale from 0 to 1',
    enter: (progress) => {
      const scale = easeOutBack(progress);
      return {
        opacity: Math.min(1, progress * 2),
        transform: `scale(${scale})`,
      };
    },
    exit: (progress) => {
      const scale = 1 - easeInCubic(progress);
      return {
        opacity: 1 - progress,
        transform: `scale(${scale})`,
      };
    },
  },

  'slide-up': {
    id: 'slide-up',
    name: 'Slide Up',
    description: 'Slide from bottom',
    enter: (progress) => {
      const y = (1 - easeOutCubic(progress)) * 50;
      return {
        opacity: easeOutCubic(progress),
        transform: `translateY(${y}px)`,
      };
    },
    exit: (progress) => {
      const y = -easeInCubic(progress) * 50;
      return {
        opacity: 1 - easeInCubic(progress),
        transform: `translateY(${y}px)`,
      };
    },
  },

  'slide-down': {
    id: 'slide-down',
    name: 'Slide Down',
    description: 'Slide from top',
    enter: (progress) => {
      const y = (1 - easeOutCubic(progress)) * -50;
      return {
        opacity: easeOutCubic(progress),
        transform: `translateY(${y}px)`,
      };
    },
    exit: (progress) => {
      const y = easeInCubic(progress) * 50;
      return {
        opacity: 1 - easeInCubic(progress),
        transform: `translateY(${y}px)`,
      };
    },
  },

  'slide-left': {
    id: 'slide-left',
    name: 'Slide Left',
    description: 'Slide from right',
    enter: (progress) => {
      const x = (1 - easeOutCubic(progress)) * 50;
      return {
        opacity: easeOutCubic(progress),
        transform: `translateX(${x}px)`,
      };
    },
    exit: (progress) => {
      const x = -easeInCubic(progress) * 50;
      return {
        opacity: 1 - easeInCubic(progress),
        transform: `translateX(${x}px)`,
      };
    },
  },

  'slide-right': {
    id: 'slide-right',
    name: 'Slide Right',
    description: 'Slide from left',
    enter: (progress) => {
      const x = (1 - easeOutCubic(progress)) * -50;
      return {
        opacity: easeOutCubic(progress),
        transform: `translateX(${x}px)`,
      };
    },
    exit: (progress) => {
      const x = easeInCubic(progress) * 50;
      return {
        opacity: 1 - easeInCubic(progress),
        transform: `translateX(${x}px)`,
      };
    },
  },

  bounce: {
    id: 'bounce',
    name: 'Bounce',
    description: 'Elastic bounce with overshoot',
    enter: (progress) => {
      const scale = easeOutElastic(progress);
      return {
        opacity: Math.min(1, progress * 3),
        transform: `scale(${scale})`,
      };
    },
    exit: (progress) => {
      const scale = 1 - easeInBack(progress);
      return {
        opacity: 1 - progress,
        transform: `scale(${Math.max(0, scale)})`,
      };
    },
  },

  'float-in': {
    id: 'float-in',
    name: 'Float In',
    description: 'Smooth floating entrance',
    enter: (progress) => {
      const y = (1 - easeOutCubic(progress)) * 30;
      const scale = 0.95 + easeOutCubic(progress) * 0.05;
      return {
        opacity: easeOutCubic(progress),
        transform: `translateY(${y}px) scale(${scale})`,
      };
    },
    exit: (progress) => {
      const y = -easeInCubic(progress) * 30;
      const scale = 1 - easeInCubic(progress) * 0.05;
      return {
        opacity: 1 - easeInCubic(progress),
        transform: `translateY(${y}px) scale(${scale})`,
      };
    },
  },

  blur: {
    id: 'blur',
    name: 'Blur',
    description: 'Blur in/out effect',
    enter: (progress) => {
      const blur = (1 - easeOutCubic(progress)) * 10;
      return {
        opacity: easeOutCubic(progress),
        filter: `blur(${blur}px)`,
      };
    },
    exit: (progress) => {
      const blur = easeInCubic(progress) * 10;
      return {
        opacity: 1 - easeInCubic(progress),
        filter: `blur(${blur}px)`,
      };
    },
  },

  'rotate-in': {
    id: 'rotate-in',
    name: 'Rotate In',
    description: 'Rotation with scale',
    enter: (progress) => {
      const rotation = (1 - easeOutCubic(progress)) * -15;
      const scale = easeOutBack(progress);
      return {
        opacity: easeOutCubic(progress),
        transform: `rotate(${rotation}deg) scale(${scale})`,
      };
    },
    exit: (progress) => {
      const rotation = easeInCubic(progress) * 15;
      const scale = 1 - easeInCubic(progress);
      return {
        opacity: 1 - easeInCubic(progress),
        transform: `rotate(${rotation}deg) scale(${scale})`,
      };
    },
  },

  'flip-x': {
    id: 'flip-x',
    name: 'Flip X',
    description: '3D flip horizontal',
    enter: (progress) => {
      const rotateY = (1 - easeOutCubic(progress)) * 90;
      return {
        opacity: progress > 0.5 ? 1 : easeOutCubic(progress * 2),
        transform: `perspective(400px) rotateY(${rotateY}deg)`,
      };
    },
    exit: (progress) => {
      const rotateY = -easeInCubic(progress) * 90;
      return {
        opacity: progress < 0.5 ? 1 : 1 - easeInCubic((progress - 0.5) * 2),
        transform: `perspective(400px) rotateY(${rotateY}deg)`,
      };
    },
  },

  'flip-y': {
    id: 'flip-y',
    name: 'Flip Y',
    description: '3D flip vertical',
    enter: (progress) => {
      const rotateX = (1 - easeOutCubic(progress)) * 90;
      return {
        opacity: progress > 0.5 ? 1 : easeOutCubic(progress * 2),
        transform: `perspective(400px) rotateX(${rotateX}deg)`,
      };
    },
    exit: (progress) => {
      const rotateX = easeInCubic(progress) * 90;
      return {
        opacity: progress < 0.5 ? 1 : 1 - easeInCubic((progress - 0.5) * 2),
        transform: `perspective(400px) rotateX(${rotateX}deg)`,
      };
    },
  },

  pulse: {
    id: 'pulse',
    name: 'Pulse',
    description: 'Heartbeat scale effect',
    enter: (progress) => {
      // Two-beat pulse: 0→1.1→0.95→1
      let scale: number;
      if (progress < 0.4) {
        scale = easeOutCubic(progress / 0.4) * 1.15;
      } else if (progress < 0.7) {
        scale = 1.15 - ((progress - 0.4) / 0.3) * 0.2;
      } else {
        scale = 0.95 + ((progress - 0.7) / 0.3) * 0.05;
      }
      return {
        opacity: Math.min(1, progress * 2),
        transform: `scale(${scale})`,
      };
    },
    exit: (progress) => {
      const scale = 1 - easeInCubic(progress) * 0.3;
      return {
        opacity: 1 - easeInCubic(progress),
        transform: `scale(${scale})`,
      };
    },
  },

  'zoom-blur': {
    id: 'zoom-blur',
    name: 'Zoom Blur',
    description: 'Zoom with blur combo',
    enter: (progress) => {
      const scale = 0.8 + easeOutCubic(progress) * 0.2;
      const blur = (1 - easeOutCubic(progress)) * 8;
      return {
        opacity: easeOutCubic(progress),
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
      };
    },
    exit: (progress) => {
      const scale = 1 + easeInCubic(progress) * 0.2;
      const blur = easeInCubic(progress) * 8;
      return {
        opacity: 1 - easeInCubic(progress),
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
      };
    },
  },
};

// Get array of templates for UI iteration
export const animationTemplateList: AnimationTemplate[] = Object.values(animationTemplates);

export function getAnimationById(id: string): AnimationTemplate | undefined {
  return animationTemplates[id];
}

export function getDefaultAnimation(): AnimationTemplate {
  return animationTemplates.fade;
}

/**
 * Animation timing configuration
 * Used by the AnimatedWrapper component
 */
export const ANIMATION_DURATION_FRAMES = 15; // ~0.5s at 30fps
export const ENTER_DURATION_FRAMES = 15;
export const EXIT_DURATION_FRAMES = 12;
