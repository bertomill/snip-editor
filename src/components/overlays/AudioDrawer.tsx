"use client";

import React from 'react';
import { useOverlay } from './OverlayContext';

interface AudioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Drawer for audio enhancement settings (noise reduction + loudness normalization)
 */
export function AudioDrawer({ isOpen, onClose }: AudioDrawerProps) {
  const { state, setAudioSettings } = useOverlay();
  const { audioSettings } = state;

  const handleToggleEnhance = () => {
    setAudioSettings({ enhanceAudio: !audioSettings.enhanceAudio });
  };

  const handleToggleNoiseReduction = () => {
    setAudioSettings({ noiseReduction: !audioSettings.noiseReduction });
  };

  const handleToggleLoudness = () => {
    setAudioSettings({ loudnessNormalization: !audioSettings.loudnessNormalization });
  };

  const handleStrengthChange = (strength: 'light' | 'medium' | 'strong') => {
    setAudioSettings({ noiseReductionStrength: strength });
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
          <h3 className="text-lg font-semibold text-white">Audio Enhancement</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main toggle */}
        <div className="mb-6">
          <button
            onClick={handleToggleEnhance}
            className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${
              audioSettings.enhanceAudio
                ? 'bg-[#4A8FE7]/15 border border-[#4A8FE7]/30'
                : 'bg-[#2C2C2E] border border-transparent hover:bg-[#333]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                audioSettings.enhanceAudio ? 'bg-[#4A8FE7]/20' : 'bg-[#3A3A3C]'
              }`}>
                <svg className={`w-5 h-5 ${audioSettings.enhanceAudio ? 'text-[#4A8FE7]' : 'text-[#8E8E93]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium text-white">Enhance Audio</p>
                <p className="text-xs text-[#8E8E93]">Clean up voice for better transcription</p>
              </div>
            </div>
            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${
              audioSettings.enhanceAudio ? 'bg-[#4A8FE7]' : 'bg-[#3A3A3C]'
            }`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                audioSettings.enhanceAudio ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </div>
          </button>
        </div>

        {/* Sub-options (only shown when enhance is enabled) */}
        {audioSettings.enhanceAudio && (
          <div className="space-y-4 animate-fade-in">
            {/* Noise Reduction Toggle */}
            <div className="p-4 rounded-xl bg-[#2C2C2E]">
              <button
                onClick={handleToggleNoiseReduction}
                className="w-full flex items-center justify-between mb-3"
              >
                <div>
                  <p className="font-medium text-white text-sm">Noise Reduction</p>
                  <p className="text-xs text-[#636366]">Remove background noise</p>
                </div>
                <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                  audioSettings.noiseReduction ? 'bg-[#4A8FE7]' : 'bg-[#3A3A3C]'
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    audioSettings.noiseReduction ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </div>
              </button>

              {/* Strength selector (only when noise reduction is on) */}
              {audioSettings.noiseReduction && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-[#3A3A3C]">
                  {(['light', 'medium', 'strong'] as const).map((strength) => (
                    <button
                      key={strength}
                      onClick={() => handleStrengthChange(strength)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                        audioSettings.noiseReductionStrength === strength
                          ? 'bg-[#4A8FE7] text-white'
                          : 'bg-[#3A3A3C] text-[#8E8E93] hover:bg-[#444]'
                      }`}
                    >
                      {strength.charAt(0).toUpperCase() + strength.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Loudness Normalization Toggle */}
            <div className="p-4 rounded-xl bg-[#2C2C2E]">
              <button
                onClick={handleToggleLoudness}
                className="w-full flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-white text-sm">Loudness Leveling</p>
                  <p className="text-xs text-[#636366]">Normalize audio volume</p>
                </div>
                <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                  audioSettings.loudnessNormalization ? 'bg-[#4A8FE7]' : 'bg-[#3A3A3C]'
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    audioSettings.loudnessNormalization ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="mt-6 pt-4 border-t border-[#2C2C2E]">
          <p className="text-xs text-[#636366] text-center leading-relaxed">
            Audio enhancement uses FFmpeg filters to clean up voice recordings before transcription.
            This can improve transcription accuracy for noisy audio.
          </p>
        </div>
      </div>
    </div>
  );
}
