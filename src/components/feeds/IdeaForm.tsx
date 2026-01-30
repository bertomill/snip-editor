'use client';

import { useState, useEffect } from 'react';
import { Idea, Channel, CreateIdeaInput, IdeaStatus, IDEA_STATUS_CONFIG } from '@/types/feeds';
import { TagInput } from './TagInput';

interface IdeaFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateIdeaInput) => Promise<void>;
  idea?: Idea | null;
  channels: Channel[];
  defaultChannelId?: string | null;
}

const STATUS_OPTIONS: IdeaStatus[] = ['draft', 'in_progress', 'published', 'archived'];

export function IdeaForm({
  isOpen,
  onClose,
  onSubmit,
  idea,
  channels,
  defaultChannelId,
}: IdeaFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [status, setStatus] = useState<IdeaStatus>('draft');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!idea;

  useEffect(() => {
    if (idea) {
      setTitle(idea.title);
      setDescription(idea.description || '');
      setChannelId(idea.channelId || null);
      setTags(idea.tags);
      setImageUrl(idea.imageUrl || '');
      setVideoUrl(idea.videoUrl || '');
      setStatus(idea.status);
    } else {
      setTitle('');
      setDescription('');
      setChannelId(defaultChannelId && defaultChannelId !== 'uncategorized' ? defaultChannelId : null);
      setTags([]);
      setImageUrl('');
      setVideoUrl('');
      setStatus('draft');
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
        channelId: channelId || undefined,
        tags,
        imageUrl: imageUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        status,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#1C1C1E] z-[101] shadow-2xl animate-slide-left overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2C2E]">
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
          <div className="p-5 space-y-5">
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

            {/* Description */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details..."
                rows={4}
                maxLength={2000}
                className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#636366] focus:outline-none focus:border-[#4A8FE7] transition-colors resize-none"
              />
            </div>

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
        <div className="px-5 py-4 border-t border-[#2C2C2E] flex justify-end gap-3">
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
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#4A8FE7] text-white hover:bg-[#3A7FD7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Idea'}
          </button>
        </div>
      </div>
    </>
  );
}
