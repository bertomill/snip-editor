"use client";

import React, { useState } from 'react';
import { useOverlay } from './OverlayContext';
import { TextOverlay } from '@/types/overlays';
import { textStyleTemplates } from '@/lib/templates/text-templates';
import { animationTemplateList } from '@/lib/templates/animation-templates';

type TabType = 'templates' | 'styles' | 'effects';

interface MobileTextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  totalDurationMs: number;
  currentTimeMs: number;
}

/**
 * CapCut-style mobile drawer for adding text overlays
 * Slides up from bottom with tabbed interface
 */
export function MobileTextDrawer({
  isOpen,
  onClose,
  totalDurationMs,
  currentTimeMs,
}: MobileTextDrawerProps) {
  const { state, addTextOverlay } = useOverlay();
  const [content, setContent] = useState('');
  const [templateId, setTemplateId] = useState(textStyleTemplates[0].id);
  const [enterAnimation, setEnterAnimation] = useState('fade');
  const [exitAnimation, setExitAnimation] = useState('fade');
  const [positionPreset, setPositionPreset] = useState<'top' | 'center' | 'bottom'>('center');
  const [durationMs, setDurationMs] = useState(3000);
  const [activeTab, setActiveTab] = useState<TabType>('templates');

  const canAdd = state.textOverlays.length < 5;

  const getPositionFromPreset = (preset: 'top' | 'center' | 'bottom') => {
    switch (preset) {
      case 'top': return { x: 50, y: 15 };
      case 'center': return { x: 50, y: 50 };
      case 'bottom': return { x: 50, y: 85 };
    }
  };

  const handleAdd = () => {
    if (!content.trim() || !canAdd) return;

    const newOverlay: TextOverlay = {
      id: `text-${Date.now()}`,
      content: content.trim(),
      templateId,
      enterAnimation,
      exitAnimation,
      position: getPositionFromPreset(positionPreset),
      startMs: currentTimeMs,
      durationMs,
    };

    addTextOverlay(newOverlay);
    setContent('');
    onClose();
  };

  const handleSelectTemplate = (id: string) => {
    setTemplateId(id);
  };

  if (!isOpen) return null;

  const selectedTemplate = textStyleTemplates.find(t => t.id === templateId);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full bg-[#1C1C1E] rounded-t-2xl animate-slide-up max-h-[70vh] flex flex-col">
        {/* Text Input Section */}
        <div className="px-4 pt-4 pb-3 border-b border-[#2C2C2E]">
          <div className="flex items-center gap-2 bg-[#2C2C2E] rounded-xl px-4 py-3">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter text"
              maxLength={100}
              className="flex-1 bg-transparent text-white placeholder:text-[#636366] text-base focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => {/* Could open fullscreen editor */}}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
            <button
              onClick={handleAdd}
              disabled={!content.trim() || !canAdd}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
          {!canAdd && (
            <p className="text-yellow-400 text-xs mt-2">Maximum 5 text overlays reached</p>
          )}
        </div>

        {/* Drag Handle */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 bg-[#3C3C3E] rounded-full" />
        </div>

        {/* Tabs */}
        <div className="px-4 border-b border-[#2C2C2E]">
          <div className="flex gap-6">
            <TabButton
              label="Templates"
              active={activeTab === 'templates'}
              onClick={() => setActiveTab('templates')}
            />
            <TabButton
              label="Styles"
              active={activeTab === 'styles'}
              onClick={() => setActiveTab('styles')}
            />
            <TabButton
              label="Effects"
              active={activeTab === 'effects'}
              onClick={() => setActiveTab('effects')}
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'templates' && (
            <TemplatesTab
              templates={textStyleTemplates}
              selectedId={templateId}
              onSelect={handleSelectTemplate}
            />
          )}
          {activeTab === 'styles' && (
            <StylesTab
              positionPreset={positionPreset}
              onPositionChange={setPositionPreset}
              durationMs={durationMs}
              onDurationChange={setDurationMs}
              maxDuration={Math.min(10000, totalDurationMs - currentTimeMs)}
            />
          )}
          {activeTab === 'effects' && (
            <EffectsTab
              enterAnimation={enterAnimation}
              exitAnimation={exitAnimation}
              onEnterChange={setEnterAnimation}
              onExitChange={setExitAnimation}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 text-sm font-medium transition-colors relative ${
        active ? 'text-white' : 'text-[#8E8E93]'
      }`}
    >
      {label}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A8FE7] rounded-full" />
      )}
    </button>
  );
}

function TemplatesTab({
  templates,
  selectedId,
  onSelect,
}: {
  templates: typeof textStyleTemplates;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {templates.map((template) => {
        const isSelected = selectedId === template.id;
        return (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className={`aspect-square rounded-xl flex items-center justify-center transition-all relative ${
              isSelected
                ? 'ring-2 ring-[#4A8FE7] ring-offset-1 ring-offset-[#1C1C1E]'
                : 'hover:bg-[#2C2C2E]'
            }`}
            style={{ backgroundColor: '#2C2C2E' }}
          >
            <span
              className="text-sm font-semibold"
              style={{
                fontFamily: template.fontFamily,
                color: template.color,
                textShadow: template.textShadow,
                ...(template.backgroundColor && !template.backgroundColor.includes('gradient') && {
                  backgroundColor: template.backgroundColor,
                  padding: '4px 8px',
                  borderRadius: template.borderRadius || '4px',
                }),
              }}
            >
              Abc
            </span>
            {isSelected && (
              <div className="absolute top-1 right-1 w-4 h-4 bg-[#4A8FE7] rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function StylesTab({
  positionPreset,
  onPositionChange,
  durationMs,
  onDurationChange,
  maxDuration,
}: {
  positionPreset: 'top' | 'center' | 'bottom';
  onPositionChange: (preset: 'top' | 'center' | 'bottom') => void;
  durationMs: number;
  onDurationChange: (ms: number) => void;
  maxDuration: number;
}) {
  return (
    <div className="space-y-6">
      {/* Position */}
      <div>
        <label className="block text-xs text-[#8E8E93] mb-3">Position</label>
        <div className="flex gap-2">
          {(['top', 'center', 'bottom'] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => onPositionChange(pos)}
              className={`flex-1 py-3 rounded-xl text-sm capitalize transition-all ${
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

      {/* Duration */}
      <div>
        <label className="block text-xs text-[#8E8E93] mb-3">
          Duration: {(durationMs / 1000).toFixed(1)}s
        </label>
        <input
          type="range"
          min={500}
          max={maxDuration}
          step={100}
          value={durationMs}
          onChange={(e) => onDurationChange(Number(e.target.value))}
          className="w-full accent-[#4A8FE7] h-2"
        />
        <div className="flex justify-between text-[10px] text-[#636366] mt-1">
          <span>0.5s</span>
          <span>{(maxDuration / 1000).toFixed(0)}s</span>
        </div>
      </div>
    </div>
  );
}

function EffectsTab({
  enterAnimation,
  exitAnimation,
  onEnterChange,
  onExitChange,
}: {
  enterAnimation: string;
  exitAnimation: string;
  onEnterChange: (id: string) => void;
  onExitChange: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Enter Animation */}
      <div>
        <label className="block text-xs text-[#8E8E93] mb-3">Enter Animation</label>
        <div className="flex flex-wrap gap-2">
          {animationTemplateList.map((anim) => (
            <button
              key={anim.id}
              onClick={() => onEnterChange(anim.id)}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                enterAnimation === anim.id
                  ? 'bg-[#4A8FE7] text-white'
                  : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
              }`}
            >
              {anim.name}
            </button>
          ))}
        </div>
      </div>

      {/* Exit Animation */}
      <div>
        <label className="block text-xs text-[#8E8E93] mb-3">Exit Animation</label>
        <div className="flex flex-wrap gap-2">
          {animationTemplateList.map((anim) => (
            <button
              key={anim.id}
              onClick={() => onExitChange(anim.id)}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                exitAnimation === anim.id
                  ? 'bg-[#4A8FE7] text-white'
                  : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
              }`}
            >
              {anim.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
