"use client";

import React, { useState } from 'react';
import { useOverlay } from './OverlayContext';
import { TextOverlay } from '@/types/overlays';
import { textStyleTemplates } from '@/lib/templates/text-templates';
import { animationTemplates } from '@/lib/templates/animation-templates';

interface TextOverlayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  totalDurationMs: number;
  currentTimeMs: number;
}

/**
 * Drawer for adding and editing text overlays
 */
export function TextOverlayDrawer({
  isOpen,
  onClose,
  totalDurationMs,
  currentTimeMs,
}: TextOverlayDrawerProps) {
  const { state, addTextOverlay } = useOverlay();
  const [content, setContent] = useState('');
  const [templateId, setTemplateId] = useState(textStyleTemplates[0].id);
  const [animationId, setAnimationId] = useState('fade');
  const [positionPreset, setPositionPreset] = useState<'top' | 'center' | 'bottom'>('center');
  const [durationMs, setDurationMs] = useState(3000);

  // Convert preset to x/y coordinates
  const getPositionFromPreset = (preset: 'top' | 'center' | 'bottom') => {
    switch (preset) {
      case 'top': return { x: 50, y: 15 };
      case 'center': return { x: 50, y: 50 };
      case 'bottom': return { x: 50, y: 85 };
    }
  };

  const canAdd = state.textOverlays.length < 5;

  const handleAdd = () => {
    if (!content.trim() || !canAdd) return;

    const newOverlay: TextOverlay = {
      id: `text-${Date.now()}`,
      content: content.trim(),
      templateId,
      animationId,
      position: getPositionFromPreset(positionPreset),
      startMs: currentTimeMs,
      durationMs,
    };

    addTextOverlay(newOverlay);
    setContent('');
    onClose();
  };

  if (!isOpen) return null;

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
          <h3 className="text-lg font-semibold text-white">Add Text</h3>
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
            Maximum 5 text overlays reached
          </div>
        )}

        {/* Text Input */}
        <div className="mb-5">
          <label className="block text-xs text-[#8E8E93] mb-2">Text Content</label>
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your text..."
            maxLength={100}
            className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-xl px-4 py-3 text-white placeholder:text-[#636366] focus:outline-none focus:border-[#4A8FE7] transition-colors"
          />
          <p className="text-xs text-[#636366] mt-1.5">{content.length}/100 characters</p>
        </div>

        {/* Style Picker */}
        <div className="mb-5">
          <label className="block text-xs text-[#8E8E93] mb-2">Style</label>
          <div className="grid grid-cols-4 gap-2">
            {textStyleTemplates.map((style) => (
              <button
                key={style.id}
                onClick={() => setTemplateId(style.id)}
                className={`p-2 rounded-xl border transition-all ${
                  templateId === style.id
                    ? 'border-[#4A8FE7] bg-[#4A8FE7]/10'
                    : 'border-[#3C3C3E] hover:border-[#4A8FE7]/50'
                }`}
              >
                <div
                  className="h-8 rounded-lg flex items-center justify-center text-xs font-medium truncate px-1"
                  style={{
                    fontFamily: style.fontFamily,
                    color: style.color,
                    backgroundColor: style.backgroundColor,
                    textShadow: style.textShadow,
                  }}
                >
                  Aa
                </div>
                <p className="text-[10px] text-[#8E8E93] mt-1.5 text-center truncate">{style.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Animation Picker */}
        <div className="mb-5">
          <label className="block text-xs text-[#8E8E93] mb-2">Animation</label>
          <div className="flex flex-wrap gap-2">
            {animationTemplates.map((anim) => (
              <button
                key={anim.id}
                onClick={() => setAnimationId(anim.id)}
                className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                  animationId === anim.id
                    ? 'bg-[#4A8FE7] text-white'
                    : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
                }`}
              >
                {anim.name}
              </button>
            ))}
          </div>
        </div>

        {/* Position Picker */}
        <div className="mb-5">
          <label className="block text-xs text-[#8E8E93] mb-2">Initial Position (drag to adjust in preview)</label>
          <div className="flex gap-2">
            {(['top', 'center', 'bottom'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setPositionPreset(pos)}
                className={`flex-1 py-2 rounded-xl text-xs capitalize transition-all ${
                  positionPreset === pos
                    ? 'bg-[#4A8FE7] text-white'
                    : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Duration Slider */}
        <div className="mb-6">
          <label className="block text-xs text-[#8E8E93] mb-2">
            Duration: {(durationMs / 1000).toFixed(1)}s
          </label>
          <input
            type="range"
            min={500}
            max={Math.min(10000, totalDurationMs - currentTimeMs)}
            step={100}
            value={durationMs}
            onChange={(e) => setDurationMs(Number(e.target.value))}
            className="w-full accent-[#4A8FE7]"
          />
        </div>

        {/* Add Button */}
        <button
          onClick={handleAdd}
          disabled={!content.trim() || !canAdd}
          className="w-full py-3 rounded-xl bg-[#4A8FE7] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3A7FD7] transition-colors"
        >
          Add Text Overlay
        </button>
      </div>
    </div>
  );
}
