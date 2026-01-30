'use client';

import { useState } from 'react';
import { useFeeds } from '@/contexts/FeedsContext';
import { Channel, Idea, CreateChannelInput, CreateIdeaInput, UpdateIdeaInput } from '@/types/feeds';
import { ChannelList } from './ChannelList';
import { ChannelForm } from './ChannelForm';
import { IdeaList } from './IdeaList';
import { IdeaForm } from './IdeaForm';

interface FeedsPanelProps {
  onClose: () => void;
}

export function FeedsPanel({ onClose }: FeedsPanelProps) {
  const {
    channels,
    channelsLoading,
    ideas,
    ideasLoading,
    selectedChannelId,
    setSelectedChannelId,
    statusFilter,
    setStatusFilter,
    createChannel,
    updateChannel,
    deleteChannel,
    createIdea,
    updateIdea,
    deleteIdea,
  } = useFeeds();

  // Modal states
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [showIdeaForm, setShowIdeaForm] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  // Handlers
  const handleCreateChannel = () => {
    setEditingChannel(null);
    setShowChannelForm(true);
  };

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
    setShowChannelForm(true);
  };

  const handleDeleteChannel = async (id: string) => {
    if (window.confirm('Delete this channel? Ideas will be moved to Uncategorized.')) {
      await deleteChannel(id);
    }
  };

  const handleChannelFormSubmit = async (data: CreateChannelInput) => {
    if (editingChannel) {
      await updateChannel(editingChannel.id, data);
    } else {
      await createChannel(data);
    }
  };

  const handleCreateIdea = () => {
    setEditingIdea(null);
    setShowIdeaForm(true);
  };

  const handleEditIdea = (idea: Idea) => {
    setEditingIdea(idea);
    setShowIdeaForm(true);
  };

  const handleDeleteIdea = async (id: string) => {
    if (window.confirm('Delete this idea?')) {
      await deleteIdea(id);
    }
  };

  const handleIdeaFormSubmit = async (data: CreateIdeaInput) => {
    if (editingIdea) {
      await updateIdea(editingIdea.id, data as UpdateIdeaInput);
    } else {
      await createIdea(data);
    }
  };

  // Filter ideas based on selected channel
  const filteredIdeas = selectedChannelId === null
    ? ideas
    : selectedChannelId === 'uncategorized'
    ? ideas.filter((i) => !i.channelId)
    : ideas.filter((i) => i.channelId === selectedChannelId);

  return (
    <>
      <div className="h-full w-full bg-[#1C1C1E] overflow-hidden flex flex-col">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#4A8FE7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-sm font-semibold text-white">Feeds</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Channels Section */}
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-[#8E8E93] uppercase tracking-wider">Channels</h4>
            </div>
            {channelsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ChannelList
                channels={channels}
                ideas={ideas}
                selectedChannelId={selectedChannelId}
                onSelectChannel={setSelectedChannelId}
                onEditChannel={handleEditChannel}
                onDeleteChannel={handleDeleteChannel}
                onCreateChannel={handleCreateChannel}
              />
            )}
          </div>

          {/* Ideas Section */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-[#8E8E93] uppercase tracking-wider">Ideas</h4>
              <span className="text-[10px] text-[#636366]">{filteredIdeas.length} items</span>
            </div>
            <IdeaList
              ideas={filteredIdeas}
              isLoading={ideasLoading}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onSelectIdea={handleEditIdea}
              onDeleteIdea={handleDeleteIdea}
              onCreateIdea={handleCreateIdea}
            />
          </div>
        </div>
      </div>

      {/* Channel Form Modal */}
      <ChannelForm
        isOpen={showChannelForm}
        onClose={() => {
          setShowChannelForm(false);
          setEditingChannel(null);
        }}
        onSubmit={handleChannelFormSubmit}
        channel={editingChannel}
      />

      {/* Idea Form Drawer */}
      <IdeaForm
        isOpen={showIdeaForm}
        onClose={() => {
          setShowIdeaForm(false);
          setEditingIdea(null);
        }}
        onSubmit={handleIdeaFormSubmit}
        idea={editingIdea}
        channels={channels}
        defaultChannelId={selectedChannelId}
      />
    </>
  );
}
