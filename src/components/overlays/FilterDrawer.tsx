"use client";

import React from 'react';
import { useOverlay } from './OverlayContext';
import { filterPresets } from '@/lib/templates/filter-presets';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Drawer for selecting video filters
 */
export function FilterDrawer({ isOpen, onClose }: FilterDrawerProps) {
  const { state, setFilter } = useOverlay();

  const handleSelectFilter = (filterId: string) => {
    setFilter(filterId === 'none' ? null : filterId);
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
          <h3 className="text-lg font-semibold text-white">Video Filter</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-3 gap-3">
          {filterPresets.map((filter) => {
            const isSelected =
              (filter.id === 'none' && !state.filterId) ||
              state.filterId === filter.id;

            return (
              <button
                key={filter.id}
                onClick={() => handleSelectFilter(filter.id)}
                className={`relative rounded-xl overflow-hidden transition-all ${
                  isSelected
                    ? 'ring-2 ring-[#4A8FE7] ring-offset-2 ring-offset-[#1C1C1E] scale-[1.02]'
                    : 'hover:scale-[1.02]'
                }`}
              >
                {/* Filter preview thumbnail */}
                <div
                  className="aspect-square"
                  style={{
                    background: filter.thumbnail || '#333',
                    filter: filter.filter !== 'none' ? filter.filter : undefined,
                  }}
                />

                {/* Filter name */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs text-white font-medium text-center">
                    {filter.name}
                  </p>
                </div>

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

        {/* Current filter indicator */}
        <div className="mt-5 pt-4 border-t border-[#2C2C2E]">
          <p className="text-xs text-[#8E8E93] text-center">
            Active: <span className="text-white font-medium">
              {filterPresets.find(f => f.id === (state.filterId || 'none'))?.name || 'None'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
