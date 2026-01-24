"use client";

import React, { useState } from 'react';
import { useOverlay } from './OverlayContext';
import { StickerOverlay } from '@/types/overlays';
import { stickerTemplates, stickerCategories, getStickersByCategory } from '@/lib/templates/sticker-templates';

interface StickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  totalDurationMs: number;
  currentTimeMs: number;
}

/**
 * Drawer for adding stickers and emojis
 */
export function StickerDrawer({
  isOpen,
  onClose,
  totalDurationMs,
  currentTimeMs,
}: StickerDrawerProps) {
  const { state, addSticker } = useOverlay();
  const [activeCategory, setActiveCategory] = useState<typeof stickerCategories[number]['id']>('reactions');

  const canAdd = state.stickers.length < 10;

  const handleAddSticker = (stickerId: string) => {
    if (!canAdd) return;

    const newSticker: StickerOverlay = {
      id: `sticker-${Date.now()}`,
      stickerId,
      position: {
        x: 20 + Math.random() * 60, // Random position between 20-80%
        y: 20 + Math.random() * 40,
      },
      startMs: currentTimeMs,
      durationMs: Math.min(3000, totalDurationMs - currentTimeMs),
      scale: 1,
    };

    addSticker(newSticker);
    onClose();
  };

  if (!isOpen) return null;

  const currentStickers = getStickersByCategory(activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">Add Sticker</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!canAdd && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
            Maximum 10 stickers reached
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {stickerCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                activeCategory === category.id
                  ? 'bg-[#4A8FE7] text-white'
                  : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Sticker Grid */}
        <div className="grid grid-cols-4 gap-3">
          {currentStickers.map((sticker) => (
            <button
              key={sticker.id}
              onClick={() => handleAddSticker(sticker.id)}
              disabled={!canAdd}
              className="aspect-square flex items-center justify-center text-4xl bg-[#2C2C2E] rounded-xl hover:bg-[#3C3C3E] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={sticker.name}
            >
              {sticker.emoji}
            </button>
          ))}
        </div>

        {/* Usage hint */}
        <p className="text-xs text-[#636366] text-center mt-5">
          Stickers appear at current playback position ({state.stickers.length}/10)
        </p>
      </div>
    </div>
  );
}
