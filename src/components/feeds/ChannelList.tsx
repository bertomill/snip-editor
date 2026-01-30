'use client';

import { Channel, Idea } from '@/types/feeds';
import { ChannelCard } from './ChannelCard';

interface ChannelListProps {
  channels: Channel[];
  ideas: Idea[];
  selectedChannelId: string | null;
  onSelectChannel: (id: string | null) => void;
  onEditChannel: (channel: Channel) => void;
  onDeleteChannel: (id: string) => void;
  onCreateChannel: () => void;
}

export function ChannelList({
  channels,
  ideas,
  selectedChannelId,
  onSelectChannel,
  onEditChannel,
  onDeleteChannel,
  onCreateChannel,
}: ChannelListProps) {
  // Count ideas per channel
  const getIdeaCount = (channelId: string | null) => {
    if (channelId === null) {
      return ideas.filter((i) => !i.channelId).length;
    }
    return ideas.filter((i) => i.channelId === channelId).length;
  };

  const totalIdeas = ideas.length;
  const uncategorizedCount = getIdeaCount(null);

  return (
    <div className="space-y-2">
      {/* All Ideas */}
      <div
        onClick={() => onSelectChannel(null)}
        className={`p-3 rounded-xl cursor-pointer transition-all ${
          selectedChannelId === null
            ? 'bg-[#4A8FE7]/15 border border-[#4A8FE7]/30'
            : 'bg-[#2C2C2E] hover:bg-[#333] border border-transparent'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#4A8FE7]/20 flex items-center justify-center text-[#4A8FE7]">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">All Ideas</p>
          </div>
          <span className="text-[10px] text-[#636366]">{totalIdeas}</span>
        </div>
      </div>

      {/* Uncategorized */}
      {uncategorizedCount > 0 && (
        <div
          onClick={() => onSelectChannel('uncategorized')}
          className={`p-3 rounded-xl cursor-pointer transition-all ${
            selectedChannelId === 'uncategorized'
              ? 'bg-[#8E8E93]/15 border border-[#8E8E93]/30'
              : 'bg-[#2C2C2E] hover:bg-[#333] border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#8E8E93]/20 flex items-center justify-center text-[#8E8E93]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Uncategorized</p>
            </div>
            <span className="text-[10px] text-[#636366]">{uncategorizedCount}</span>
          </div>
        </div>
      )}

      {/* Divider */}
      {channels.length > 0 && (
        <div className="flex items-center gap-2 py-2">
          <div className="flex-1 h-px bg-[#3C3C3E]" />
          <span className="text-[10px] text-[#636366] uppercase tracking-wider">Channels</span>
          <div className="flex-1 h-px bg-[#3C3C3E]" />
        </div>
      )}

      {/* Channel Cards */}
      {channels.map((channel) => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          isSelected={selectedChannelId === channel.id}
          onClick={() => onSelectChannel(channel.id)}
          onEdit={() => onEditChannel(channel)}
          onDelete={() => onDeleteChannel(channel.id)}
          ideaCount={getIdeaCount(channel.id)}
        />
      ))}

      {/* Create Channel Button */}
      <button
        onClick={onCreateChannel}
        className="w-full p-3 rounded-xl border border-dashed border-[#3C3C3E] text-[#8E8E93] hover:text-white hover:border-[#4A8FE7] hover:bg-[#4A8FE7]/5 transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-xs font-medium">New Channel</span>
      </button>
    </div>
  );
}
