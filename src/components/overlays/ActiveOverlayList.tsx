"use client";

import React from 'react';
import { useOverlay } from './OverlayContext';
import { getStickerById } from '@/lib/templates/sticker-templates';
import { getFilterById } from '@/lib/templates/filter-presets';

/**
 * Displays active overlays as chips below the preview
 */
export function ActiveOverlayList() {
  const { state, removeTextOverlay, removeSticker, setFilter } = useOverlay();

  const hasOverlays =
    state.textOverlays.length > 0 ||
    state.stickers.length > 0 ||
    (state.filterId && state.filterId !== 'none');

  if (!hasOverlays) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 px-1">
      {/* Filter chip */}
      {state.filterId && state.filterId !== 'none' && (
        <Chip
          label={getFilterById(state.filterId)?.name || 'Filter'}
          icon={
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4" />
            </svg>
          }
          onRemove={() => setFilter(null)}
          color="purple"
        />
      )}

      {/* Text overlay chips */}
      {state.textOverlays.map((overlay) => (
        <Chip
          key={overlay.id}
          label={overlay.content.length > 15 ? overlay.content.slice(0, 15) + '...' : overlay.content}
          icon={<span className="font-bold text-[10px]">T</span>}
          onRemove={() => removeTextOverlay(overlay.id)}
          color="blue"
        />
      ))}

      {/* Sticker chips */}
      {state.stickers.map((sticker) => {
        const template = getStickerById(sticker.stickerId);
        return (
          <Chip
            key={sticker.id}
            label={template?.emoji || '?'}
            onRemove={() => removeSticker(sticker.id)}
            color="yellow"
          />
        );
      })}
    </div>
  );
}

interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  onRemove: () => void;
  color: 'blue' | 'yellow' | 'purple';
}

function Chip({ label, icon, onRemove, color }: ChipProps) {
  const colorClasses = {
    blue: 'bg-[#4A8FE7]/20 text-[#4A8FE7] border-[#4A8FE7]/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${colorClasses[color]}`}>
      {icon}
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 hover:opacity-70 transition-opacity"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
