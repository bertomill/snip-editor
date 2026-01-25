"use client";

import React from 'react';
import { useOverlay } from './OverlayContext';
import { captionTemplates } from '@/lib/caption-templates';

interface MobileCaptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CapCut-style mobile drawer for selecting caption styles
 * Slides up from bottom with None option and style presets
 */
export function MobileCaptionsDrawer({
  isOpen,
  onClose,
}: MobileCaptionsDrawerProps) {
  const { state, setCaptionTemplate, toggleCaptionPreview } = useOverlay();

  const handleSelectNone = () => {
    if (state.showCaptionPreview) {
      toggleCaptionPreview();
    }
    onClose();
  };

  const handleSelectTemplate = (templateId: string) => {
    setCaptionTemplate(templateId);
    // Auto-enable captions when selecting a style
    if (!state.showCaptionPreview) {
      toggleCaptionPreview();
    }
    onClose();
  };

  if (!isOpen) return null;

  const isNoneSelected = !state.showCaptionPreview;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full bg-[#1C1C1E] rounded-t-2xl animate-slide-up max-h-[70vh] flex flex-col">
        {/* Drag Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-[#3C3C3E] rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-[#2C2C2E]">
          <h2 className="text-white text-lg font-semibold text-center">Captions</h2>
          <p className="text-[#8E8E93] text-xs text-center mt-1">
            Choose a caption style for your video
          </p>
        </div>

        {/* Options Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {/* None Option */}
            <button
              onClick={handleSelectNone}
              className={`relative aspect-[4/3] rounded-xl flex flex-col items-center justify-center transition-all ${
                isNoneSelected
                  ? 'ring-2 ring-[#4A8FE7] ring-offset-2 ring-offset-[#1C1C1E] bg-[#2C2C2E]'
                  : 'bg-[#2C2C2E] hover:bg-[#3C3C3E]'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[#3C3C3E] flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">None</span>
              <span className="text-[#636366] text-xs mt-0.5">No captions</span>
              {isNoneSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-[#4A8FE7] rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>

            {/* Caption Templates */}
            {captionTemplates.map((template) => {
              const isSelected = state.showCaptionPreview && state.captionTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.id)}
                  className={`relative aspect-[4/3] rounded-xl flex flex-col items-center justify-center transition-all overflow-hidden ${
                    isSelected
                      ? 'ring-2 ring-[#4A8FE7] ring-offset-2 ring-offset-[#1C1C1E]'
                      : 'hover:ring-1 hover:ring-white/20'
                  }`}
                  style={{ backgroundColor: '#2C2C2E' }}
                >
                  {/* Preview Text */}
                  <div
                    className="px-3 py-1 mb-2 rounded"
                    style={{
                      fontFamily: template.styles.fontFamily,
                      fontSize: '14px',
                      color: template.styles.color,
                      textShadow: template.styles.textShadow,
                      backgroundColor: template.styles.highlightStyle?.backgroundColor || 'transparent',
                      borderRadius: template.styles.highlightStyle?.borderRadius || '4px',
                    }}
                  >
                    Hello
                  </div>
                  <span className="text-white text-sm font-medium">{template.name}</span>
                  <span className="text-[#636366] text-xs mt-0.5">{template.preview}</span>
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
        </div>

        {/* Footer Info */}
        <div className="px-4 py-3 border-t border-[#2C2C2E]">
          <p className="text-[#636366] text-xs text-center">
            Captions are generated from your transcript and burned into the exported video
          </p>
        </div>
      </div>
    </div>
  );
}
