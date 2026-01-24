'use client';

import { useState } from 'react';
import { ClipTransition, TransitionType } from '@/types/overlays';
import { getActiveTransitionTemplates, getTransitionTemplate } from '@/lib/templates/transition-templates';

interface TransitionRefinementPanelProps {
  clipTransitions: ClipTransition[];
  clipCount: number;
  onUpdateTransition: (id: string, updates: Partial<ClipTransition>) => void;
  onRemoveTransition: (id: string) => void;
  onResetToAuto: () => void;
}

export function TransitionRefinementPanel({
  clipTransitions,
  clipCount,
  onUpdateTransition,
  onRemoveTransition,
  onResetToAuto,
}: TransitionRefinementPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const templates = getActiveTransitionTemplates();

  // No transitions to show if only one clip
  if (clipCount < 2) {
    return (
      <div className="text-center py-8 text-[#636366]">
        <p className="text-sm">Add more clips to enable transitions</p>
        <p className="text-xs mt-1">Transitions appear between clips</p>
      </div>
    );
  }

  // No transitions applied
  if (clipTransitions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[#8E8E93] text-sm mb-4">No transitions applied</p>
        <button
          onClick={onResetToAuto}
          className="px-4 py-2 bg-[#4A8FE7] text-white text-sm rounded-lg hover:bg-[#3A7FD7] transition-colors"
        >
          Auto-apply transitions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with reset button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[#8E8E93]">
          {clipTransitions.length} transition{clipTransitions.length > 1 ? 's' : ''} applied
        </p>
        <button
          onClick={onResetToAuto}
          className="text-xs text-[#4A8FE7] hover:text-[#3A7FD7] transition-colors"
        >
          Reset to auto
        </button>
      </div>

      {/* Transition list */}
      <div className="space-y-2">
        {clipTransitions.map((transition, index) => {
          const isExpanded = expandedId === transition.id;
          const template = getTransitionTemplate(transition.type);

          return (
            <div
              key={transition.id}
              className={`rounded-xl border transition-all ${
                isExpanded
                  ? 'bg-[#2C2C2E] border-[#4A8FE7]/30'
                  : 'bg-[#242424] border-transparent hover:border-[#3C3C3E]'
              }`}
            >
              {/* Header row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : transition.id)}
                className="w-full flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#4A8FE7]/20 flex items-center justify-center">
                    <TransitionIcon type={transition.type} />
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-medium">
                      Cut {index + 1}
                    </p>
                    <p className="text-[#636366] text-xs">
                      {template.name}
                    </p>
                  </div>
                </div>
                <svg
                  className={`w-4 h-4 text-[#636366] transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-[#3C3C3E] pt-3">
                  {/* Type selector */}
                  <div>
                    <label className="block text-xs text-[#8E8E93] mb-2">Effect</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onUpdateTransition(transition.id, {
                            type: t.id,
                            durationFrames: t.durationFrames,
                          })}
                          className={`p-2 rounded-lg text-center transition-all ${
                            transition.type === t.id
                              ? 'bg-[#4A8FE7] text-white'
                              : 'bg-[#3C3C3E] text-[#8E8E93] hover:bg-[#444]'
                          }`}
                        >
                          <div className="flex justify-center mb-1">
                            <TransitionIcon type={t.id} />
                          </div>
                          <p className="text-[10px]">{t.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Intensity slider */}
                  <div>
                    <label className="block text-xs text-[#8E8E93] mb-2">
                      Intensity: {(transition.intensity * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min={50}
                      max={200}
                      step={10}
                      value={transition.intensity * 100}
                      onChange={(e) => onUpdateTransition(transition.id, {
                        intensity: Number(e.target.value) / 100,
                      })}
                      className="w-full accent-[#4A8FE7]"
                    />
                    <div className="flex justify-between text-[10px] text-[#636366] mt-1">
                      <span>Subtle</span>
                      <span>Strong</span>
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => {
                      onRemoveTransition(transition.id);
                      setExpandedId(null);
                    }}
                    className="w-full py-2 text-red-400 hover:bg-red-400/10 rounded-lg text-sm transition-colors"
                  >
                    Remove transition
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info footer */}
      <div className="pt-3 border-t border-[#2C2C2E]">
        <p className="text-[10px] text-[#636366] text-center leading-relaxed">
          Transitions are applied at clip boundaries for a TikTok-style editing feel.
        </p>
      </div>
    </div>
  );
}

/**
 * Icon for each transition type
 */
function TransitionIcon({ type }: { type: TransitionType }) {
  const iconClass = "w-4 h-4 text-[#4A8FE7]";

  switch (type) {
    case 'zoom-punch':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8M8 12h8" />
        </svg>
      );
    case 'flash':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'shake':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h4l3-9 4 18 3-9h4" />
        </svg>
      );
    case 'glitch':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6l-3 6h5l-7 12v-8H5l4-10z" />
        </svg>
      );
    case 'whip-pan':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      );
    case 'speed-ramp':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" strokeWidth={2} />
        </svg>
      );
  }
}

export default TransitionRefinementPanel;
