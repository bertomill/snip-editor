'use client';

import { memo } from 'react';

interface WordSpanProps {
  id: string;
  text: string;
  isDeleted: boolean;
  isActive: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
}

/**
 * Individual word component with visual states for script-driven editing
 * Supports click-and-drag selection
 */
export const WordSpan = memo(function WordSpan({
  id,
  text,
  isDeleted,
  isActive,
  isSelected,
  onClick,
  onMouseDown,
  onMouseEnter,
}: WordSpanProps) {
  // Build class names based on state
  let className = 'inline cursor-pointer rounded px-0.5 py-0.5 transition-all duration-150 select-none ';

  if (isDeleted) {
    // Deleted state - red strikethrough, dimmed
    className += 'line-through text-red-400/60 bg-red-950/20 hover:bg-red-950/40';
  } else if (isSelected) {
    // Selected state - highlighted for deletion
    className += 'bg-blue-500/30 text-white';
  } else if (isActive) {
    // Active state - currently playing
    className += 'bg-[#4A8FE7]/30 text-white font-semibold';
  } else {
    // Normal state
    className += 'text-white/80 hover:text-white hover:bg-[#242430]';
  }

  return (
    <span
      data-word-id={id}
      className={className}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    >
      {text}
    </span>
  );
});
