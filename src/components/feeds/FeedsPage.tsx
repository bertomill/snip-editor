'use client';

import { useState } from 'react';
import { useFeeds } from '@/contexts/FeedsContext';
import { Channel, Idea, CreateChannelInput, CreateIdeaInput, UpdateIdeaInput } from '@/types/feeds';
import { ChannelList } from './ChannelList';
import { ChannelForm } from './ChannelForm';
import { IdeaCard } from './IdeaCard';
import { IdeaForm } from './IdeaForm';
import { IdeaStatus, IDEA_STATUS_CONFIG } from '@/types/feeds';

interface FeedsPageProps {
  onBack: () => void;
}

const STATUS_OPTIONS: (IdeaStatus | null)[] = [null, 'draft', 'in_progress', 'published', 'archived'];

export function FeedsPage({ onBack }: FeedsPageProps) {
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
    <div className="h-screen flex bg-[var(--background)]">
      {/* Fixed Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--background-card)]/50 flex flex-col">
        {/* Sidebar Header */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-[var(--border)]">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h1 className="text-base font-semibold text-white">Feeds</h1>
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-3">
          {channelsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
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

        {/* Sidebar Footer - New Idea Button */}
        <div className="p-3 border-t border-[var(--border)]">
          <button
            onClick={handleCreateIdea}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#10B981] text-white rounded-lg hover:bg-[#059669] transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Idea
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Content Header with Filters */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status || 'all'}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  statusFilter === status
                    ? 'bg-[#10B981] text-white'
                    : 'text-[#8E8E93] hover:bg-white/5 hover:text-white'
                }`}
              >
                {status ? IDEA_STATUS_CONFIG[status].label : 'All'}
              </button>
            ))}
          </div>
          <span className="text-sm text-[#636366] ml-4 flex-shrink-0">{filteredIdeas.length} ideas</span>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {ideasLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No ideas yet</h3>
              <p className="text-[#8E8E93] mb-6 max-w-sm">Start capturing your content ideas and organize them into channels</p>
              <button
                onClick={handleCreateIdea}
                className="flex items-center gap-2 px-6 py-3 bg-[#10B981] text-white rounded-lg hover:bg-[#059669] transition-colors font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create First Idea
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {filteredIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onClick={() => handleEditIdea(idea)}
                  onDelete={() => handleDeleteIdea(idea.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

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
    </div>
  );
}
