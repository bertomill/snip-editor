"use client";

import React from 'react';
import { useOverlay } from './OverlayContext';

interface OverlayToolbarProps {
  onOpenTextDrawer: () => void;
  onOpenStickerDrawer: () => void;
  onOpenFilterDrawer: () => void;
}

/**
 * Floating toolbar with [T][S][F] buttons for overlay controls
 */
export function OverlayToolbar({
  onOpenTextDrawer,
  onOpenStickerDrawer,
  onOpenFilterDrawer,
}: OverlayToolbarProps) {
  const { state, toggleCaptionPreview } = useOverlay();

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black/70 backdrop-blur-md rounded-full px-3 py-2 border border-white/10">
      {/* Caption Preview Toggle */}
      <button
        onClick={toggleCaptionPreview}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
          state.showCaptionPreview
            ? 'bg-[#4A8FE7] text-white'
            : 'bg-white/10 text-white/60 hover:bg-white/20'
        }`}
        title={state.showCaptionPreview ? 'Hide Captions' : 'Show Captions'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      </button>

      <div className="w-px h-5 bg-white/20" />

      {/* Text Overlay Button */}
      <button
        onClick={onOpenTextDrawer}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-all"
        title="Add Text"
      >
        <span className="font-bold text-sm">T</span>
      </button>

      {/* Sticker Button */}
      <button
        onClick={onOpenStickerDrawer}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-all"
        title="Add Sticker"
      >
        <span className="text-base">S</span>
      </button>

      {/* Filter Button */}
      <button
        onClick={onOpenFilterDrawer}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
          state.filterId && state.filterId !== 'none'
            ? 'bg-[#4A8FE7] text-white'
            : 'bg-white/10 text-white/60 hover:bg-white/20'
        }`}
        title="Filters"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>
    </div>
  );
}
