'use client';

import React from 'react';
import { ClipTransition } from '@/types/overlays';

interface TransitionMarkerProps {
  transition: ClipTransition;
  position: number; // percentage position on timeline
}

/**
 * Visual indicator showing where a transition effect will be applied
 * between two clips on the timeline.
 */
export const TransitionMarker: React.FC<TransitionMarkerProps> = ({
  transition,
  position,
}) => {
  // Get icon and color based on transition type
  const getTransitionStyle = () => {
    switch (transition.type) {
      case 'zoom-punch':
      case 'zoom-blur':
        return { icon: '🔍', bg: 'from-blue-500/80 to-blue-600/80' };
      case 'flash':
      case 'color-flash':
        return { icon: '⚡', bg: 'from-yellow-400/80 to-orange-500/80' };
      case 'shake':
        return { icon: '📳', bg: 'from-red-500/80 to-red-600/80' };
      case 'glitch':
      case 'rgb-split':
        return { icon: '📺', bg: 'from-purple-500/80 to-pink-500/80' };
      case 'spin-zoom':
        return { icon: '🌀', bg: 'from-cyan-500/80 to-blue-500/80' };
      case 'bounce-pop':
        return { icon: '💥', bg: 'from-green-500/80 to-emerald-500/80' };
      case 'strobe':
        return { icon: '💡', bg: 'from-white/80 to-gray-300/80' };
      case 'whip-pan':
      case 'slide-push':
        return { icon: '➡️', bg: 'from-indigo-500/80 to-violet-500/80' };
      default:
        return { icon: '✨', bg: 'from-pink-500/80 to-purple-500/80' };
    }
  };

  const { icon, bg } = getTransitionStyle();

  return (
    <div
      className="absolute z-20 flex items-center justify-center"
      style={{
        left: `${position}%`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Transition indicator pill */}
      <div
        className={`
          flex items-center justify-center
          w-6 h-6 rounded-full
          bg-gradient-to-br ${bg}
          border-2 border-white/50
          shadow-lg shadow-black/30
          cursor-pointer
          hover:scale-110 hover:border-white
          transition-all duration-150
          group
        `}
        title={`Transition: ${transition.type}`}
      >
        <span className="text-[10px]">{icon}</span>
      </div>

      {/* Tooltip on hover */}
      <div className="
        absolute bottom-full mb-1 left-1/2 -translate-x-1/2
        px-2 py-1 rounded bg-black/90 text-white text-[10px] font-medium
        whitespace-nowrap
        opacity-0 group-hover:opacity-100
        pointer-events-none
        transition-opacity duration-150
      ">
        {transition.type.replace(/-/g, ' ')}
      </div>
    </div>
  );
};

export default TransitionMarker;
