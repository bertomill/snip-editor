'use client';

import { useState, useEffect } from 'react';
import { Idea, Channel, CreateIdeaInput, IdeaStatus, IDEA_STATUS_CONFIG, Entity, SocialAccount, SOCIAL_PLATFORMS } from '@/types/feeds';
import { TagInput } from './TagInput';

interface IdeaFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateIdeaInput) => Promise<void>;
  idea?: Idea | null;
  channels: Channel[];
  defaultChannelId?: string | null;
  entities?: Entity[];
  socialAccounts?: SocialAccount[];
}

const STATUS_OPTIONS: IdeaStatus[] = ['draft', 'in_progress', 'published', 'archived'];

export function IdeaForm({
  isOpen,
  onClose,
  onSubmit,
  idea,
  channels,
  defaultChannelId,
  entities = [],
  socialAccounts = [],
}: IdeaFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [status, setStatus] = useState<IdeaStatus>('draft');
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [platformDrafts, setPlatformDrafts] = useState<Record<string, string>>({});
  const [showPlatformSelector, setShowPlatformSelector] = useState(false);
  const [selectedPlatformsForModify, setSelectedPlatformsForModify] = useState<string[]>([]);
  const [isModifying, setIsModifying] = useState(false);
  const [activePlatformTab, setActivePlatformTab] = useState<string | null>(null);

  const isEditing = !!idea;

  useEffect(() => {
    if (idea) {
      setTitle(idea.title);
      setDescription(idea.description || '');
      setDraftContent(idea.draftContent || '');
      setPlatformDrafts(idea.platformDrafts || {});
      setChannelId(idea.channelId || null);
      setTags(idea.tags);
      setImageUrl(idea.imageUrl || '');
      setVideoUrl(idea.videoUrl || '');
      setStatus(idea.status);
      setTargetPlatforms(idea.targetPlatforms || []);
      setActivePlatformTab(null);
      setShowPlatformSelector(false);
      setSelectedPlatformsForModify([]);
    } else {
      setTitle('');
      setDescription('');
      setDraftContent('');
      setPlatformDrafts({});
      setChannelId(defaultChannelId && defaultChannelId !== 'uncategorized' ? defaultChannelId : null);
      setTags([]);
      setImageUrl('');
      setVideoUrl('');
      setStatus('draft');
      setTargetPlatforms([]);
      setActivePlatformTab(null);
      setShowPlatformSelector(false);
      setSelectedPlatformsForModify([]);
    }
  }, [idea, isOpen, defaultChannelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        draftContent: draftContent.trim() || undefined,
        platformDrafts: Object.keys(platformDrafts).length > 0 ? platformDrafts : undefined,
        channelId: channelId || undefined,
        tags,
        imageUrl: imageUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        status,
        targetPlatforms,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePlatform = (accountId: string) => {
    setTargetPlatforms(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  // AI Draft function
  const handleAIDraft = async () => {
    if (isDrafting) return;

    // Get the first selected platform info for drafting
    const selectedAccount = socialAccounts.find(sa => targetPlatforms.includes(sa.id));
    const platformConfig = selectedAccount
      ? SOCIAL_PLATFORMS.find(p => p.id === selectedAccount.platform)
      : null;
    const entity = selectedAccount
      ? entities.find(e => e.id === selectedAccount.entityId)
      : null;

    setIsDrafting(true);
    setDraftError(null);
    try {
      const response = await fetch('/api/draft-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platformConfig?.name || 'social media',
          accountName: entity?.name || selectedAccount?.handle || 'my account',
          title: title.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate draft');
      }

      if (data.draft) {
        setDraftContent(data.draft);
      }
    } catch (error) {
      console.error('AI draft error:', error);
      setDraftError(error instanceof Error ? error.message : 'Failed to generate draft');
    } finally {
      setIsDrafting(false);
    }
  };

  // Modify for different platforms
  const handleModifyForPlatforms = async () => {
    if (isModifying || !draftContent.trim() || selectedPlatformsForModify.length === 0) return;

    setIsModifying(true);
    setDraftError(null);
    try {
      const response = await fetch('/api/modify-for-platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalContent: draftContent.trim(),
          targetPlatforms: selectedPlatformsForModify,
          title: title.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to modify content');
      }

      if (data.platformDrafts) {
        setPlatformDrafts(prev => ({ ...prev, ...data.platformDrafts }));
        setShowPlatformSelector(false);
        setSelectedPlatformsForModify([]);
        // Set the first new platform as active tab
        const firstPlatform = selectedPlatformsForModify[0];
        if (firstPlatform) {
          setActivePlatformTab(firstPlatform);
        }
      }
    } catch (error) {
      console.error('Modify for platforms error:', error);
      setDraftError(error instanceof Error ? error.message : 'Failed to modify content');
    } finally {
      setIsModifying(false);
    }
  };

  const togglePlatformForModify = (platformId: string) => {
    setSelectedPlatformsForModify(prev =>
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  // Group social accounts by entity
  const accountsByEntity = entities.map(entity => ({
    entity,
    accounts: socialAccounts.filter(sa => sa.entityId === entity.id),
  })).filter(group => group.accounts.length > 0);

  const getPlatformIcon = (platform: string) => {
    const config = SOCIAL_PLATFORMS.find(p => p.id === platform);
    return config?.color || '#8E8E93';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="w-full max-w-lg bg-[#1C1C1E] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C2C2E]">
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? 'Edit Idea' : 'New Idea'}
            </h2>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Target Platforms - at top */}
            {accountsByEntity.length > 0 && (
              <div>
                <label className="block text-xs text-[#8E8E93] mb-2">Post to platforms</label>
                <div className="space-y-3">
                  {accountsByEntity.map(({ entity, accounts }) => (
                    <div key={entity.id}>
                      <p className="text-[10px] text-[#636366] mb-1.5">{entity.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {accounts.map((account) => {
                          const isSelected = targetPlatforms.includes(account.id);
                          const platformConfig = SOCIAL_PLATFORMS.find(p => p.id === account.platform);
                          return (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() => togglePlatform(account.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                isSelected
                                  ? 'text-white'
                                  : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
                              }`}
                              style={isSelected ? { backgroundColor: platformConfig?.color } : undefined}
                            >
                              {account.handle || platformConfig?.name}
                              {isSelected && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Channel */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Channel</label>
              <select
                value={channelId || ''}
                onChange={(e) => setChannelId(e.target.value || null)}
                className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#4A8FE7] transition-colors appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238E8E93'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '16px',
                }}
              >
                <option value="">Uncategorized</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's your idea?"
                maxLength={200}
                className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#636366] focus:outline-none focus:border-[#4A8FE7] transition-colors"
              />
            </div>

            {/* Description - User notes */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Notes</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add your notes, ideas, or context..."
                rows={3}
                maxLength={2000}
                className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#636366] focus:outline-none focus:border-[#4A8FE7] transition-colors resize-none"
              />
            </div>

            {/* AI Draft Content */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-[#8E8E93] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Post Draft
                </label>
                <button
                  type="button"
                  onClick={handleAIDraft}
                  disabled={isDrafting || !title.trim()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 hover:from-purple-500/30 hover:to-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-purple-500/30"
                >
                  {isDrafting ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Drafting...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      {draftContent ? 'Regenerate' : 'Generate'}
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Click 'Generate' to create an AI-drafted post based on your title and notes..."
                  rows={4}
                  maxLength={3000}
                  className="w-full bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/20 rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#636366] focus:outline-none focus:border-purple-500/40 transition-colors resize-none"
                />
                {draftContent && (
                  <button
                    type="button"
                    onClick={() => setDraftContent('')}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 text-[#636366] hover:text-white transition-colors"
                    title="Clear draft"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {draftError && (
                <p className="mt-2 text-xs text-red-400">{draftError}</p>
              )}

              {/* Modify for other platforms */}
              {draftContent.trim() && (
                <div className="mt-3">
                  {!showPlatformSelector ? (
                    <button
                      type="button"
                      onClick={() => setShowPlatformSelector(true)}
                      className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Modify for other platforms
                    </button>
                  ) : (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-blue-300 font-medium">Select platforms to adapt content for:</p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPlatformSelector(false);
                            setSelectedPlatformsForModify([]);
                          }}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                          <svg className="w-4 h-4 text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {SOCIAL_PLATFORMS.map((platform) => {
                          const isSelected = selectedPlatformsForModify.includes(platform.name);
                          const alreadyHasDraft = platformDrafts[platform.name];
                          return (
                            <button
                              key={platform.id}
                              type="button"
                              onClick={() => togglePlatformForModify(platform.name)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                                isSelected
                                  ? 'text-white'
                                  : alreadyHasDraft
                                  ? 'bg-[#2C2C2E] text-green-400 border border-green-500/30'
                                  : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
                              }`}
                              style={isSelected ? { backgroundColor: platform.color } : undefined}
                            >
                              {platform.name}
                              {isSelected && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {alreadyHasDraft && !isSelected && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={handleModifyForPlatforms}
                        disabled={isModifying || selectedPlatformsForModify.length === 0}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isModifying ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Generating {selectedPlatformsForModify.length} version{selectedPlatformsForModify.length > 1 ? 's' : ''}...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            Generate for {selectedPlatformsForModify.length || 0} platform{selectedPlatformsForModify.length !== 1 ? 's' : ''}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Platform-specific draft cards */}
              {Object.keys(platformDrafts).length > 0 && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-[#8E8E93]">Platform versions:</p>
                  {Object.entries(platformDrafts).map(([platform, content]) => {
                    const platformConfig = SOCIAL_PLATFORMS.find(p => p.name === platform);
                    const isExpanded = activePlatformTab === platform;
                    return (
                      <div
                        key={platform}
                        className="rounded-xl border overflow-hidden transition-all"
                        style={{
                          borderColor: `${platformConfig?.color || '#4A8FE7'}40`,
                          backgroundColor: `${platformConfig?.color || '#4A8FE7'}08`
                        }}
                      >
                        {/* Card Header */}
                        <div
                          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                          onClick={() => setActivePlatformTab(isExpanded ? null : platform)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                              style={{ backgroundColor: platformConfig?.color || '#4A8FE7' }}
                            >
                              {platform.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-white">{platform}</span>
                            <span className="text-[10px] text-[#636366]">
                              {content.length} chars
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(content);
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-[#8E8E93] hover:text-white transition-colors"
                              title="Copy to clipboard"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlatformDrafts(prev => {
                                  const newDrafts = { ...prev };
                                  delete newDrafts[platform];
                                  return newDrafts;
                                });
                                if (activePlatformTab === platform) {
                                  setActivePlatformTab(null);
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-[#8E8E93] hover:text-red-400 transition-colors"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <svg
                              className={`w-4 h-4 text-[#636366] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Preview (always visible) */}
                        {!isExpanded && (
                          <div className="px-3 pb-3">
                            <p className="text-xs text-[#8E8E93] line-clamp-2 whitespace-pre-wrap">
                              {content}
                            </p>
                          </div>
                        )}

                        {/* Expanded Edit View */}
                        {isExpanded && (
                          <div className="px-3 pb-3">
                            <textarea
                              value={content}
                              onChange={(e) => setPlatformDrafts(prev => ({ ...prev, [platform]: e.target.value }))}
                              rows={5}
                              className="w-full bg-[#1C1C1E] border border-[#3C3C3E] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#4A8FE7] transition-colors resize-none"
                              style={{ borderColor: `${platformConfig?.color || '#4A8FE7'}40` }}
                            />
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] text-[#636366]">
                                {content.length} characters
                                {platform === 'X (Twitter)' && content.length > 280 && (
                                  <span className="text-red-400 ml-1">({content.length - 280} over limit)</span>
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Tags</label>
              <TagInput tags={tags} onChange={setTags} placeholder="Add tag and press Enter..." />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Status</label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((s) => {
                  const config = IDEA_STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                        status === s
                          ? 'text-white'
                          : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
                      }`}
                      style={
                        status === s
                          ? { backgroundColor: config.color }
                          : undefined
                      }
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Media URLs */}
            <div className="pt-3 border-t border-[#2C2C2E]">
              <p className="text-xs text-[#8E8E93] mb-3">Media References (optional)</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-[#636366] mb-1">Image URL</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#636366] focus:outline-none focus:border-[#4A8FE7] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#636366] mb-1">Video URL</label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#636366] focus:outline-none focus:border-[#4A8FE7] transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#2C2C2E] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#8E8E93] hover:bg-[#2C2C2E] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Idea'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
