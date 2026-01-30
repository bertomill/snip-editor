'use client';

import { useState, useEffect } from 'react';
import { Channel, CreateChannelInput, CHANNEL_COLORS, CHANNEL_ICONS } from '@/types/feeds';

interface ChannelFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateChannelInput) => Promise<void>;
  channel?: Channel | null;
}

const ICON_COMPONENTS: Record<string, React.ReactNode> = {
  folder: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  ),
  lightbulb: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
    </svg>
  ),
  star: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  ),
  heart: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ),
  bookmark: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
    </svg>
  ),
  flag: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
    </svg>
  ),
  tag: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
    </svg>
  ),
  zap: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
    </svg>
  ),
};

export function ChannelForm({ isOpen, onClose, onSubmit, channel }: ChannelFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(CHANNEL_COLORS[0]);
  const [icon, setIcon] = useState<string>(CHANNEL_ICONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!channel;

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setDescription(channel.description || '');
      setColor(channel.color);
      setIcon(channel.icon);
    } else {
      setName('');
      setDescription('');
      setColor(CHANNEL_COLORS[0]);
      setIcon(CHANNEL_ICONS[0]);
    }
  }, [channel, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || undefined, color, icon });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#1C1C1E] rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2C2E]">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Channel' : 'New Channel'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Channel name..."
                maxLength={50}
                className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#636366] focus:outline-none focus:border-[#4A8FE7] transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this channel about?"
                rows={2}
                maxLength={200}
                className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#636366] focus:outline-none focus:border-[#4A8FE7] transition-colors resize-none"
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Color</label>
              <div className="flex gap-2">
                {CHANNEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1C1C1E]' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Icon</label>
              <div className="flex gap-2">
                {CHANNEL_ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                      icon === i
                        ? 'bg-[#4A8FE7]/20 text-[#4A8FE7]'
                        : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#333]'
                    }`}
                  >
                    {ICON_COMPONENTS[i]}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-2">Preview</label>
              <div className="p-3 bg-[#2C2C2E] rounded-xl flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {ICON_COMPONENTS[icon]}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{name || 'Channel name'}</p>
                  {description && <p className="text-[10px] text-[#8E8E93]">{description}</p>}
                </div>
              </div>
            </div>
          </div>

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
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#4A8FE7] text-white hover:bg-[#3A7FD7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
