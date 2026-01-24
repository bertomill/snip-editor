'use client'

import { useState } from 'react'
import { useUser, useSignOut } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { useOverlay } from '@/components/overlays/OverlayContext'
import { textStyleTemplates } from '@/lib/templates/text-templates'
import { animationTemplates } from '@/lib/templates/animation-templates'
import { stickerCategories, getStickersByCategory } from '@/lib/templates/sticker-templates'
import { filterPresets } from '@/lib/templates/filter-presets'
import { captionTemplates } from '@/lib/caption-templates'
import { TextOverlay, StickerOverlay, ClipTransition, defaultAudioSettings } from '@/types/overlays'
import { TransitionRefinementPanel } from '@/components/overlays/TransitionRefinementPanel'
import { generateAutoTransitions } from '@/lib/transitions/auto-transitions'

type PanelType = 'text' | 'stickers' | 'filters' | 'audio' | 'cuts' | 'captions' | null;

interface SidebarProps {
  onOpenUploads?: () => void;
  onNavigateHome?: () => void;
  onCreateProject?: () => void;
  // View state - determines which mobile bottom bar to show
  view?: 'feed' | 'editor';
  // For overlay panels that need timing info
  totalDurationMs?: number;
  currentTimeMs?: number;
  // For transitions
  clipCount?: number;
}

export function Sidebar({
  onOpenUploads,
  onNavigateHome,
  onCreateProject,
  view = 'feed',
  totalDurationMs = 10000,
  currentTimeMs = 0,
  clipCount = 1,
}: SidebarProps) {
  const { user, loading } = useUser()
  const signOut = useSignOut()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelType>(null)

  // Get overlay context for captions, overlays, and transitions
  const { state: overlayState, toggleCaptionPreview, addTextOverlay, addSticker, setFilter, setAudioSettings, updateTransition, removeTransition, setTransitions, setCaptionTemplate } = useOverlay()

  const togglePanel = (panel: PanelType) => {
    setActivePanel(activePanel === panel ? null : panel)
  }

  return (
    <>
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[72px] bg-[var(--background-sidebar)] border-r border-[var(--border-subtle)] flex-col items-center py-4 z-50">
        {/* Logo */}
        <Link href="/" className="mb-4">
          <Image
            src="/branding/apple-touch-icon.png"
            alt="Snip"
            width={44}
            height={44}
            className="rounded-xl hover:scale-105 transition-transform"
          />
        </Link>

        {/* Profile - moved up below logo */}
        <div className="relative mb-4">
          {loading ? (
            <div className="w-10 h-10 rounded-full bg-[#1C1C1E] animate-pulse" />
          ) : user ? (
            <>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#4A8FE7] to-[#6366F1] flex items-center justify-center text-white font-semibold text-sm hover:scale-105 transition-transform ring-2 ring-transparent hover:ring-[#4A8FE7]/50"
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.email?.[0].toUpperCase()
                )}
              </button>

              {/* Profile Menu */}
              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute top-0 left-full ml-2 w-64 bg-[var(--background-card)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden">
                    {/* Profile Header */}
                    <div className="p-4 border-b border-[var(--border)]">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#4A8FE7] to-[#6366F1] flex items-center justify-center text-white font-semibold text-lg">
                          {user.user_metadata?.avatar_url ? (
                            <img
                              src={user.user_metadata.avatar_url}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            user.email?.[0].toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {user.user_metadata?.full_name || 'User'}
                          </p>
                          <p className="text-gray-400 text-sm truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                      <MenuItem icon={<ProfileIcon />} label="View profile" />
                      <MenuItem icon={<ProjectsIcon />} label="My projects" onClick={() => {
                        setShowProfileMenu(false);
                        onNavigateHome?.();
                      }} />
                      <MenuItem icon={<SettingsIcon />} label="Settings" />
                      <div className="border-t border-[var(--border)] my-2" />
                      <button
                        onClick={() => {
                          setShowProfileMenu(false)
                          signOut()
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <LogoutIcon />
                        <span className="text-sm">Log out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <Link
              href="/login"
              className="w-10 h-10 rounded-full bg-[var(--background-elevated)] flex items-center justify-center text-gray-400 hover:text-white hover:bg-[var(--background-card)] transition-colors"
            >
              <ProfileIcon />
            </Link>
          )}
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-[var(--border-subtle)] mb-4" />

        {/* Navigation */}
        <nav className="flex-1 flex flex-col items-center gap-2">
          {/* Home */}
          <NavButton
            icon={<HomeIcon />}
            label="Home"
            onClick={() => onNavigateHome?.()}
            active
          />

          {/* Uploads */}
          <NavButton
            icon={<UploadsIcon />}
            label="Uploads"
            onClick={() => onOpenUploads?.()}
          />

          {/* Discover/Explore */}
          <NavItem href="/" icon={<ExploreIcon />} label="Explore" />

          {/* Create - Primary Action */}
          <button
            onClick={() => onCreateProject?.()}
            className="group flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
          >
            <div className="p-2.5 rounded-xl bg-[#4A8FE7] text-white shadow-lg shadow-[#4A8FE7]/30 group-hover:bg-[#5A9FF7] group-hover:shadow-[#4A8FE7]/50 group-hover:scale-105 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-[#4A8FE7]">Create</span>
          </button>

          {/* Editor Tools - only show when in editor view */}
          {view === 'editor' && (
            <>
              {/* Divider */}
              <div className="w-8 h-px bg-[var(--border-subtle)] my-2" />

              {/* Overlay Tools */}
              <NavButton
                icon={<TextIcon />}
                label="Text"
                onClick={() => togglePanel('text')}
                active={activePanel === 'text'}
              />

              <NavButton
                icon={<StickerIcon />}
                label="Stickers"
                onClick={() => togglePanel('stickers')}
                active={activePanel === 'stickers'}
              />

              <NavButton
                icon={<FilterIcon />}
                label="Filters"
                onClick={() => togglePanel('filters')}
                active={activePanel === 'filters'}
              />

              <NavButton
                icon={<AudioEnhanceIcon />}
                label="Audio"
                onClick={() => togglePanel('audio')}
                active={activePanel === 'audio'}
              />

              <NavButton
                icon={<CutsIcon />}
                label="Cuts"
                onClick={() => togglePanel('cuts')}
                active={activePanel === 'cuts'}
              />

              <NavButton
                icon={<CaptionIcon />}
                label="Captions"
                onClick={() => togglePanel('captions')}
                active={activePanel === 'captions' || overlayState.showCaptionPreview}
              />
            </>
          )}
        </nav>

      </aside>

      {/* Secondary Panel - Canva style slide-out */}
      <SidebarPanel
        activePanel={activePanel}
        onClose={() => setActivePanel(null)}
        totalDurationMs={totalDurationMs}
        currentTimeMs={currentTimeMs}
        addTextOverlay={addTextOverlay}
        addSticker={addSticker}
        setFilter={setFilter}
        setAudioSettings={setAudioSettings}
        overlayState={overlayState}
        clipCount={clipCount}
        updateTransition={updateTransition}
        removeTransition={removeTransition}
        setTransitions={setTransitions}
        setCaptionTemplate={setCaptionTemplate}
        toggleCaptionPreview={toggleCaptionPreview}
      />

      {/* Mobile Bottom Bar - different for feed vs editor */}
      {view === 'feed' ? (
        <MobileProjectsBottomBar onCreateProject={onCreateProject} />
      ) : (
        <MobileBottomToolbar
          onNavigateHome={onNavigateHome}
          onCreateProject={onCreateProject}
          onOpenTextDrawer={() => togglePanel('text')}
          onOpenStickerDrawer={() => togglePanel('stickers')}
          onOpenFilterDrawer={() => togglePanel('filters')}
          onOpenAudioDrawer={() => togglePanel('audio')}
          onOpenCaptionsDrawer={() => togglePanel('captions')}
          captionsEnabled={overlayState.showCaptionPreview}
          audioEnabled={overlayState.audioSettings?.enhanceAudio ?? false}
        />
      )}
    </>
  )
}

// Shop app style floating pill bottom bar for projects view
function MobileProjectsBottomBar({
  onCreateProject,
}: {
  onCreateProject?: () => void
}) {
  return (
    <div className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-50 safe-area-pb">
      {/* Create Button - primary action, floating pill */}
      <button
        onClick={onCreateProject}
        className="flex items-center gap-2.5 bg-[#4A8FE7] hover:bg-[#5A9FF7] active:bg-[#3A7FD7] text-white px-8 py-4 rounded-full font-semibold text-base transition-all active:scale-95 shadow-xl shadow-[#4A8FE7]/40 hover:shadow-[#4A8FE7]/60"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Create
      </button>
    </div>
  )
}

function MobileBottomToolbar({
  onNavigateHome,
  onCreateProject,
  onOpenTextDrawer,
  onOpenStickerDrawer,
  onOpenFilterDrawer,
  onOpenAudioDrawer,
  onOpenCaptionsDrawer,
  captionsEnabled = false,
  audioEnabled = false,
}: {
  onNavigateHome?: () => void
  onCreateProject?: () => void
  onOpenTextDrawer?: () => void
  onOpenStickerDrawer?: () => void
  onOpenFilterDrawer?: () => void
  onOpenAudioDrawer?: () => void
  onOpenCaptionsDrawer?: () => void
  captionsEnabled?: boolean
  audioEnabled?: boolean
}) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1C1C1E]/95 backdrop-blur-xl border-t border-white/10 safe-area-pb">
      <div className="flex items-center justify-evenly py-2">
        <ToolbarButton
          icon={<EditIcon />}
          label="Edit"
          onClick={onNavigateHome}
        />
        <ToolbarButton
          icon={<AudioIcon />}
          label="Audio"
          onClick={onOpenAudioDrawer}
          active={audioEnabled}
        />
        <ToolbarButton
          icon={<MobileTextIcon />}
          label="Text"
          onClick={onOpenTextDrawer}
        />
        <ToolbarButton
          icon={<EffectsIcon />}
          label="Effects"
          onClick={onOpenStickerDrawer}
        />
        <ToolbarButton
          icon={<OverlayIcon />}
          label="Overlay"
          onClick={onCreateProject}
        />
        <ToolbarButton
          icon={<MobileCaptionIcon />}
          label="Captions"
          onClick={onOpenCaptionsDrawer}
          active={captionsEnabled}
        />
        <ToolbarButton
          icon={<MobileFilterIcon />}
          label="Filters"
          onClick={onOpenFilterDrawer}
        />
      </div>
    </nav>
  )
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-2 px-2 rounded-lg transition-colors ${
        active
          ? 'text-[#4A8FE7] bg-[#4A8FE7]/10'
          : 'text-gray-400 hover:text-white active:bg-white/10'
      }`}
    >
      <div className="w-6 h-6 mb-1">{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}

// Canva-style secondary panel that slides out from the sidebar
function SidebarPanel({
  activePanel,
  onClose,
  totalDurationMs,
  currentTimeMs,
  addTextOverlay,
  addSticker,
  setFilter,
  setAudioSettings,
  overlayState,
  clipCount,
  updateTransition,
  removeTransition,
  setTransitions,
  setCaptionTemplate,
  toggleCaptionPreview,
}: {
  activePanel: PanelType
  onClose: () => void
  totalDurationMs: number
  currentTimeMs: number
  addTextOverlay: (overlay: TextOverlay) => void
  addSticker: (sticker: StickerOverlay) => void
  setFilter: (filterId: string | null) => void
  setAudioSettings: (settings: Partial<import('@/types/overlays').AudioSettings>) => void
  overlayState: { textOverlays: TextOverlay[]; stickers: StickerOverlay[]; filterId: string | null; audioSettings: import('@/types/overlays').AudioSettings; clipTransitions: ClipTransition[]; captionTemplateId: string; showCaptionPreview: boolean }
  clipCount: number
  updateTransition: (id: string, updates: Partial<ClipTransition>) => void
  removeTransition: (id: string) => void
  setTransitions: (transitions: ClipTransition[]) => void
  setCaptionTemplate: (templateId: string) => void
  toggleCaptionPreview: () => void
}) {
  if (!activePanel) return null

  return (
    <div className="hidden md:block fixed left-[72px] top-0 bottom-0 w-[300px] bg-[#1C1C1E] border-r border-[var(--border-subtle)] z-40 animate-slide-right overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-white capitalize">{activePanel}</h3>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Panel Content */}
      <div className="p-4 overflow-y-auto h-[calc(100%-52px)]">
        {activePanel === 'text' && (
          <TextPanelContent
            totalDurationMs={totalDurationMs}
            currentTimeMs={currentTimeMs}
            addTextOverlay={addTextOverlay}
            textOverlayCount={overlayState.textOverlays.length}
          />
        )}
        {activePanel === 'stickers' && (
          <StickerPanelContent
            totalDurationMs={totalDurationMs}
            currentTimeMs={currentTimeMs}
            addSticker={addSticker}
            stickerCount={overlayState.stickers.length}
          />
        )}
        {activePanel === 'filters' && (
          <FilterPanelContent
            setFilter={setFilter}
            currentFilterId={overlayState.filterId}
          />
        )}
        {activePanel === 'audio' && (
          <AudioPanelContent
            audioSettings={overlayState.audioSettings ?? defaultAudioSettings}
            setAudioSettings={setAudioSettings}
          />
        )}
        {activePanel === 'cuts' && (
          <TransitionRefinementPanel
            clipTransitions={overlayState.clipTransitions}
            clipCount={clipCount}
            onUpdateTransition={updateTransition}
            onRemoveTransition={removeTransition}
            onResetToAuto={() => {
              // Generate auto transitions
              const clips = Array.from({ length: clipCount }, (_, i) => ({
                duration: totalDurationMs / 1000 / clipCount,
                index: i,
              }));
              const autoTransitions = generateAutoTransitions(clips);
              setTransitions(autoTransitions);
            }}
          />
        )}
        {activePanel === 'captions' && (
          <CaptionPanelContent
            captionTemplateId={overlayState.captionTemplateId}
            setCaptionTemplate={setCaptionTemplate}
            showCaptionPreview={overlayState.showCaptionPreview}
            toggleCaptionPreview={toggleCaptionPreview}
          />
        )}
      </div>
    </div>
  )
}

// Text Panel Content
function TextPanelContent({
  totalDurationMs,
  currentTimeMs,
  addTextOverlay,
  textOverlayCount,
}: {
  totalDurationMs: number
  currentTimeMs: number
  addTextOverlay: (overlay: TextOverlay) => void
  textOverlayCount: number
}) {
  const [content, setContent] = useState('')
  const [templateId, setTemplateId] = useState(textStyleTemplates[0].id)
  const [animationId, setAnimationId] = useState('fade')
  const [positionPreset, setPositionPreset] = useState<'top' | 'center' | 'bottom'>('center')
  const [durationMs, setDurationMs] = useState(3000)

  const canAdd = textOverlayCount < 5

  // Convert preset to x/y coordinates
  const getPositionFromPreset = (preset: 'top' | 'center' | 'bottom') => {
    switch (preset) {
      case 'top': return { x: 50, y: 15 };
      case 'center': return { x: 50, y: 50 };
      case 'bottom': return { x: 50, y: 85 };
    }
  };

  const handleAdd = () => {
    if (!content.trim() || !canAdd) return

    const newOverlay: TextOverlay = {
      id: `text-${Date.now()}`,
      content: content.trim(),
      templateId,
      animationId,
      position: getPositionFromPreset(positionPreset),
      startMs: currentTimeMs,
      durationMs,
    }

    addTextOverlay(newOverlay)
    setContent('')
  }

  return (
    <div className="space-y-4">
      {!canAdd && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-xs">
          Maximum 5 text overlays reached
        </div>
      )}

      {/* Text Input */}
      <div>
        <label className="block text-xs text-[#8E8E93] mb-2">Text Content</label>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter your text..."
          maxLength={100}
          className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#636366] focus:outline-none focus:border-[#4A8FE7] transition-colors"
        />
        <p className="text-[10px] text-[#636366] mt-1">{content.length}/100</p>
      </div>

      {/* Style Picker */}
      <div>
        <label className="block text-xs text-[#8E8E93] mb-2">Style</label>
        <div className="grid grid-cols-4 gap-1.5">
          {textStyleTemplates.map((style) => (
            <button
              key={style.id}
              onClick={() => setTemplateId(style.id)}
              className={`p-1.5 rounded-lg border transition-all ${
                templateId === style.id
                  ? 'border-[#4A8FE7] bg-[#4A8FE7]/10'
                  : 'border-[#3C3C3E] hover:border-[#4A8FE7]/50'
              }`}
            >
              <div
                className="h-6 rounded flex items-center justify-center text-[10px] font-medium"
                style={{
                  fontFamily: style.fontFamily,
                  color: style.color,
                  backgroundColor: style.backgroundColor,
                }}
              >
                Aa
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Animation Picker */}
      <div>
        <label className="block text-xs text-[#8E8E93] mb-2">Animation</label>
        <div className="flex flex-wrap gap-1.5">
          {animationTemplates.map((anim) => (
            <button
              key={anim.id}
              onClick={() => setAnimationId(anim.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] transition-all ${
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
      <div>
        <label className="block text-xs text-[#8E8E93] mb-2">Position (drag to adjust)</label>
        <div className="flex gap-1.5">
          {(['top', 'center', 'bottom'] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => setPositionPreset(pos)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] capitalize transition-all ${
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
      <div>
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
        className="w-full py-2.5 rounded-lg bg-[#4A8FE7] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3A7FD7] transition-colors"
      >
        Add Text
      </button>
    </div>
  )
}

// Sticker Panel Content
function StickerPanelContent({
  totalDurationMs,
  currentTimeMs,
  addSticker,
  stickerCount,
}: {
  totalDurationMs: number
  currentTimeMs: number
  addSticker: (sticker: StickerOverlay) => void
  stickerCount: number
}) {
  const [activeCategory, setActiveCategory] = useState<'reactions' | 'emotions' | 'objects' | 'shapes'>('reactions')
  const canAdd = stickerCount < 10

  const handleAddSticker = (stickerId: string) => {
    if (!canAdd) return

    const newSticker: StickerOverlay = {
      id: `sticker-${Date.now()}`,
      stickerId,
      position: {
        x: 20 + Math.random() * 60,
        y: 20 + Math.random() * 40,
      },
      startMs: currentTimeMs,
      durationMs: Math.min(3000, totalDurationMs - currentTimeMs),
      scale: 1,
    }

    addSticker(newSticker)
  }

  const currentStickers = getStickersByCategory(activeCategory)

  return (
    <div className="space-y-4">
      {!canAdd && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-xs">
          Maximum 10 stickers reached
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {stickerCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-3 py-1.5 rounded-full text-[10px] whitespace-nowrap transition-all ${
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
      <div className="grid grid-cols-4 gap-2">
        {currentStickers.map((sticker) => (
          <button
            key={sticker.id}
            onClick={() => handleAddSticker(sticker.id)}
            disabled={!canAdd}
            className="aspect-square flex items-center justify-center text-2xl bg-[#2C2C2E] rounded-lg hover:bg-[#3C3C3E] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={sticker.name}
          >
            {sticker.emoji}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-[#636366] text-center">
        {stickerCount}/10 stickers
      </p>
    </div>
  )
}

// Filter Panel Content
function FilterPanelContent({
  setFilter,
  currentFilterId,
}: {
  setFilter: (filterId: string | null) => void
  currentFilterId: string | null
}) {
  const handleSelectFilter = (filterId: string) => {
    setFilter(filterId === 'none' ? null : filterId)
  }

  return (
    <div className="space-y-4">
      {/* Filter Grid */}
      <div className="grid grid-cols-3 gap-2">
        {filterPresets.map((filter) => {
          const isSelected =
            (filter.id === 'none' && !currentFilterId) ||
            currentFilterId === filter.id

          return (
            <button
              key={filter.id}
              onClick={() => handleSelectFilter(filter.id)}
              className={`relative rounded-lg overflow-hidden transition-all ${
                isSelected
                  ? 'ring-2 ring-[#4A8FE7] ring-offset-1 ring-offset-[#1C1C1E]'
                  : 'hover:scale-[1.02]'
              }`}
            >
              <div
                className="aspect-square"
                style={{
                  background: filter.thumbnail || '#333',
                  filter: filter.filter !== 'none' ? filter.filter : undefined,
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                <p className="text-[9px] text-white font-medium text-center">
                  {filter.name}
                </p>
              </div>
              {isSelected && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-[#4A8FE7] rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="pt-3 border-t border-[#2C2C2E]">
        <p className="text-[10px] text-[#8E8E93] text-center">
          Active: <span className="text-white font-medium">
            {filterPresets.find(f => f.id === (currentFilterId || 'none'))?.name || 'None'}
          </span>
        </p>
      </div>
    </div>
  )
}

// Audio Panel Content
function AudioPanelContent({
  audioSettings,
  setAudioSettings,
}: {
  audioSettings: import('@/types/overlays').AudioSettings
  setAudioSettings: (settings: Partial<import('@/types/overlays').AudioSettings>) => void
}) {
  const handleToggleEnhance = () => {
    setAudioSettings({ enhanceAudio: !audioSettings.enhanceAudio })
  }

  const handleToggleNoiseReduction = () => {
    setAudioSettings({ noiseReduction: !audioSettings.noiseReduction })
  }

  const handleToggleLoudness = () => {
    setAudioSettings({ loudnessNormalization: !audioSettings.loudnessNormalization })
  }

  const handleStrengthChange = (strength: 'light' | 'medium' | 'strong') => {
    setAudioSettings({ noiseReductionStrength: strength })
  }

  return (
    <div className="space-y-4">
      {/* Main toggle */}
      <button
        onClick={handleToggleEnhance}
        className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${
          audioSettings.enhanceAudio
            ? 'bg-[#4A8FE7]/15 border border-[#4A8FE7]/30'
            : 'bg-[#2C2C2E] border border-transparent hover:bg-[#333]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            audioSettings.enhanceAudio ? 'bg-[#4A8FE7]/20' : 'bg-[#3A3A3C]'
          }`}>
            <svg className={`w-4 h-4 ${audioSettings.enhanceAudio ? 'text-[#4A8FE7]' : 'text-[#8E8E93]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="font-medium text-white text-sm">Enhance Audio</p>
            <p className="text-[10px] text-[#8E8E93]">Clean up for better transcription</p>
          </div>
        </div>
        <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
          audioSettings.enhanceAudio ? 'bg-[#4A8FE7]' : 'bg-[#3A3A3C]'
        }`}>
          <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
            audioSettings.enhanceAudio ? 'translate-x-4' : 'translate-x-0'
          }`} />
        </div>
      </button>

      {/* Sub-options (only shown when enhance is enabled) */}
      {audioSettings.enhanceAudio && (
        <div className="space-y-3 animate-fade-in">
          {/* Noise Reduction Toggle */}
          <div className="p-3 rounded-xl bg-[#2C2C2E]">
            <button
              onClick={handleToggleNoiseReduction}
              className="w-full flex items-center justify-between mb-2"
            >
              <div>
                <p className="font-medium text-white text-xs">Noise Reduction</p>
                <p className="text-[10px] text-[#636366]">Remove background noise</p>
              </div>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                audioSettings.noiseReduction ? 'bg-[#4A8FE7]' : 'bg-[#3A3A3C]'
              }`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  audioSettings.noiseReduction ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </button>

            {/* Strength selector */}
            {audioSettings.noiseReduction && (
              <div className="flex gap-1.5 mt-2 pt-2 border-t border-[#3A3A3C]">
                {(['light', 'medium', 'strong'] as const).map((strength) => (
                  <button
                    key={strength}
                    onClick={() => handleStrengthChange(strength)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all ${
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
          <div className="p-3 rounded-xl bg-[#2C2C2E]">
            <button
              onClick={handleToggleLoudness}
              className="w-full flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-white text-xs">Loudness Leveling</p>
                <p className="text-[10px] text-[#636366]">Normalize volume</p>
              </div>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                audioSettings.loudnessNormalization ? 'bg-[#4A8FE7]' : 'bg-[#3A3A3C]'
              }`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  audioSettings.loudnessNormalization ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Info footer */}
      <div className="pt-3 border-t border-[#2C2C2E]">
        <p className="text-[10px] text-[#636366] text-center leading-relaxed">
          Audio enhancement cleans up voice recordings before transcription for improved accuracy.
        </p>
      </div>
    </div>
  )
}

// Caption Panel Content
function CaptionPanelContent({
  captionTemplateId,
  setCaptionTemplate,
  showCaptionPreview,
  toggleCaptionPreview,
}: {
  captionTemplateId: string
  setCaptionTemplate: (templateId: string) => void
  showCaptionPreview: boolean
  toggleCaptionPreview: () => void
}) {
  const handleSelectTemplate = (templateId: string) => {
    setCaptionTemplate(templateId)
    // Auto-enable caption preview when selecting a style
    if (!showCaptionPreview) {
      toggleCaptionPreview()
    }
  }

  return (
    <div className="space-y-4">
      {/* Caption visibility toggle */}
      <div className="flex items-center justify-between p-3 bg-[#2C2C2E] rounded-xl">
        <span className="text-sm text-white">Show captions</span>
        <button
          onClick={toggleCaptionPreview}
          className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
            showCaptionPreview ? 'bg-[#4A8FE7]' : 'bg-[#3A3A3C]'
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
              showCaptionPreview ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Caption Style Grid */}
      <div className="grid grid-cols-2 gap-3">
        {captionTemplates.map((template) => {
          const isSelected = captionTemplateId === template.id

          return (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template.id)}
              className={`relative rounded-xl overflow-hidden transition-all text-left p-3 ${
                isSelected
                  ? 'ring-2 ring-[#4A8FE7] ring-offset-1 ring-offset-[#1C1C1E] bg-[#4A8FE7]/10'
                  : 'hover:bg-[#2C2C2E]'
              }`}
            >
              {/* Style preview */}
              <div
                className="h-10 rounded-lg mb-2 flex items-center justify-center text-sm font-semibold"
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
              <p className="font-medium text-xs text-white">{template.name}</p>
              <p className="text-[#636366] text-[10px]">{template.preview}</p>

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-[#4A8FE7] rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Info footer */}
      <div className="pt-3 border-t border-[#2C2C2E]">
        <p className="text-[10px] text-[#636366] text-center leading-relaxed">
          Captions are generated from your transcript and will be burned into the exported video.
        </p>
      </div>
    </div>
  )
}

function NavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
        active ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      <div
        className={`p-2 rounded-xl transition-colors ${
          active ? 'bg-[#1C1C1E]' : 'group-hover:bg-[#1C1C1E]'
        }`}
      >
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  )
}

function NavButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
        active ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      <div
        className={`p-2 rounded-xl transition-colors ${
          active ? 'bg-[#1C1C1E]' : 'group-hover:bg-[#1C1C1E]'
        }`}
      >
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-300 hover:bg-[var(--background-card-hover)] rounded-lg transition-colors"
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  )
}

// Desktop Icons
function HomeIcon() {
  return (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3L4 9v12h5v-7h6v7h5V9l-8-6z" />
    </svg>
  )
}

function UploadsIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function ExploreIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" />
    </svg>
  )
}

function CreateIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

// Mobile Icons (Shop app style)
function HomeIconFilled() {
  return (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3L4 9v12h16V9l-8-6z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function CreateIconMobile() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 12h6m-3-3v6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
    </svg>
  )
}

function ProjectsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4m0 14v4m-9-9h4m14 0h-4m-2.5-6.5l2.8-2.8m-11.3 11.3l2.8-2.8m0-5.7l-2.8-2.8m11.3 11.3l-2.8-2.8" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9" />
    </svg>
  )
}

// Overlay Tool Icons
function TextIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
    </svg>
  )
}

function StickerIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  )
}

function CaptionIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path strokeLinecap="round" d="M6 12h4M14 12h4M6 16h8" />
    </svg>
  )
}

function AudioEnhanceIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  )
}

function CutsIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
    </svg>
  )
}

// Mobile Toolbar Icons (CapCut style)
function EditIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 4.121a3 3 0 00-4.242 0l-9 9a1 1 0 00-.293.707V18a1 1 0 001 1h4.172a1 1 0 00.707-.293l9-9a3 3 0 000-4.243" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 7.5l4 4" />
    </svg>
  )
}

function AudioIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
    </svg>
  )
}

function MobileTextIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M12 6v14M8 6v2M16 6v2" />
    </svg>
  )
}

function EffectsIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  )
}

function OverlayIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function MobileCaptionIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path strokeLinecap="round" d="M6 12h4M14 12h4M6 16h8" />
    </svg>
  )
}

function MobileFilterIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 3a9 9 0 019 9M12 3v18M3 12h18" />
    </svg>
  )
}
