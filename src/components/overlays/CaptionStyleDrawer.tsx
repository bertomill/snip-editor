"use client";

import React from 'react';
import { useOverlay } from './OverlayContext';
import { captionTemplates } from '@/lib/caption-templates';

interface CaptionStyleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Drawer for selecting caption styles during editing
 */
export function CaptionStyleDrawer({ isOpen, onClose }: CaptionStyleDrawerProps) {
  const { state, setCaptionTemplate, toggleCaptionPreview } = useOverlay();

  const handleSelectTemplate = (templateId: string) => {
    setCaptionTemplate(templateId);
    // Auto-enable caption preview when selecting a style
    if (!state.showCaptionPreview) {
      toggleCaptionPreview();
    }
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
      <div className="relative w-full max-w-lg bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">Caption Style</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Caption visibility toggle */}
        <div className="flex items-center justify-between mb-5 p-3 bg-[#2C2C2E] rounded-xl">
          <span className="text-sm text-white">Show captions</span>
          <button
            onClick={toggleCaptionPreview}
            className={`w-12 h-7 rounded-full transition-colors ${
              state.showCaptionPreview ? 'bg-[#4A8FE7]' : 'bg-[#3A3A3C]'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                state.showCaptionPreview ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Caption Style Grid */}
        <div className="grid grid-cols-2 gap-4">
          {captionTemplates.map((template) => {
            const isSelected = state.captionTemplateId === template.id;

            return (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template.id)}
                className={`relative rounded-xl overflow-hidden transition-all text-left ${
                  isSelected
                    ? 'ring-2 ring-[#4A8FE7] ring-offset-2 ring-offset-[#1C1C1E] scale-[1.02]'
                    : 'hover:scale-[1.02] hover:bg-[#2C2C2E]'
                }`}
              >
                {/* Style preview */}
                <div
                  className="h-14 rounded-xl mb-3 flex items-center justify-center text-base font-semibold"
                  style={{
                    backgroundColor: template.styles.highlightStyle?.backgroundColor || "#3B82F6",
                    color: template.styles.highlightStyle?.color || "#FFF",
                    fontFamily: template.styles.fontFamily,
                    textShadow: template.styles.textShadow,
                  }}
                >
                  Aa
                </div>

                {/* Template info */}
                <p className="font-medium text-sm mb-0.5 text-white">{template.name}</p>
                <p className="text-[#636366] text-xs">{template.preview}</p>

                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-[#4A8FE7] rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Info footer */}
        <div className="mt-5 pt-4 border-t border-[#2C2C2E]">
          <p className="text-xs text-[#8E8E93] text-center">
            Captions are auto-generated from your transcript and will be burned into the exported video.
          </p>
        </div>
      </div>
    </div>
  );
}
