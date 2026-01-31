'use client';

import { useRouter } from 'next/navigation';
import { FeedsProvider, useFeeds } from '@/contexts/FeedsContext';
import { Channel, Idea, CreateChannelInput, CreateIdeaInput, UpdateIdeaInput, IdeaStatus, CreateEntityInput, SocialPlatform } from '@/types/feeds';
import { ChannelList, ChannelForm, IdeaCard, IdeaForm, EntityList, EntityForm, Library } from '@/components/feeds';
import { useState } from 'react';

// Kanban columns configuration
const KANBAN_COLUMNS: { status: IdeaStatus; title: string; color: string }[] = [
  { status: 'draft', title: 'Draft', color: '#8E8E93' },
  { status: 'in_progress', title: 'In Progress', color: '#F59E0B' },
  { status: 'published', title: 'Published', color: '#10B981' },
];

function FeedsPageContent() {
  const router = useRouter();
  const {
    channels,
    channelsLoading,
    ideas,
    ideasLoading,
    selectedChannelId,
    setSelectedChannelId,
    createChannel,
    updateChannel,
    deleteChannel,
    createIdea,
    updateIdea,
    deleteIdea,
    entities,
    entitiesLoading,
    createEntity,
    deleteEntity,
    createSocialAccount,
    deleteSocialAccount,
    allSocialAccounts,
  } = useFeeds();

  // Modal states
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [showIdeaForm, setShowIdeaForm] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [showEntityForm, setShowEntityForm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'library'>('kanban');

  // Drag and drop state
  const [draggingIdeaId, setDraggingIdeaId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<IdeaStatus | null>(null);

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

  // Entity handlers
  const handleCreateEntity = () => {
    setShowEntityForm(true);
  };

  const handleEntityFormSubmit = async (data: CreateEntityInput) => {
    await createEntity(data);
  };

  const handleAddSocialAccount = async (entityId: string, platform: SocialPlatform) => {
    await createSocialAccount({ entityId, platform });
  };

  const handleDeleteEntity = async (id: string) => {
    await deleteEntity(id);
  };

  const handleDeleteSocialAccount = async (id: string) => {
    await deleteSocialAccount(id);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, ideaId: string) => {
    setDraggingIdeaId(ideaId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ideaId);
    // Add a slight delay to allow the drag image to be captured
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggingIdeaId(null);
    setDragOverColumn(null);
    (e.target as HTMLElement).style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, status: IdeaStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: IdeaStatus) => {
    e.preventDefault();
    const ideaId = e.dataTransfer.getData('text/plain');
    const idea = ideas.find(i => i.id === ideaId);

    if (idea && idea.status !== newStatus) {
      await updateIdea(ideaId, { status: newStatus });
    }

    setDraggingIdeaId(null);
    setDragOverColumn(null);
  };

  // Filter ideas based on selected channel
  const filteredIdeas = selectedChannelId === null
    ? ideas
    : selectedChannelId === 'uncategorized'
    ? ideas.filter((i) => !i.channelId)
    : ideas.filter((i) => i.channelId === selectedChannelId);

  // Close sidebar when selecting a channel on mobile
  const handleSelectChannel = (channelId: string | null) => {
    setSelectedChannelId(channelId);
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen flex bg-[var(--background)]">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72
        border-r border-[var(--border)] bg-[var(--background-card)] flex flex-col
        transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:bg-[var(--background-card)]/50
        ${sidebarCollapsed ? 'md:w-16' : 'md:w-72'}
      `}>
        {/* Sidebar Header */}
        <div className={`h-14 flex items-center border-b border-[var(--border)] ${sidebarCollapsed ? 'md:px-2 md:justify-center' : 'px-4 gap-3'}`}>
          <button
            onClick={() => router.push('/')}
            className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${sidebarCollapsed ? 'md:hidden' : '-ml-1'}`}
          >
            <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className={`flex items-center gap-2 flex-1 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
            <svg className="w-5 h-5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h1 className="text-base font-semibold text-white">Feeds</h1>
          </div>
          {/* Collapsed state - show icon */}
          <button
            onClick={() => router.push('/')}
            className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${sidebarCollapsed ? 'hidden md:block' : 'hidden'}`}
            title="Go back"
          >
            <svg className="w-5 h-5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors md:hidden"
          >
            <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sidebar Content */}
        <div className={`flex-1 overflow-y-auto p-3 space-y-6 ${sidebarCollapsed ? 'md:p-2 md:space-y-4' : ''}`}>
          {/* Collapsed: Quick action icons */}
          {sidebarCollapsed && (
            <div className="hidden md:flex md:flex-col md:items-center md:gap-2">
              {/* All Ideas */}
              <button
                onClick={() => handleSelectChannel(null)}
                className={`p-2.5 rounded-lg transition-colors ${selectedChannelId === null ? 'bg-white/10 text-white' : 'text-[#8E8E93] hover:bg-white/5 hover:text-white'}`}
                title="All Ideas"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              {/* Uncategorized */}
              <button
                onClick={() => handleSelectChannel('uncategorized')}
                className={`p-2.5 rounded-lg transition-colors ${selectedChannelId === 'uncategorized' ? 'bg-white/10 text-white' : 'text-[#8E8E93] hover:bg-white/5 hover:text-white'}`}
                title="Uncategorized"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </button>
              {/* Library */}
              <button
                onClick={() => setViewMode('library')}
                className={`p-2.5 rounded-lg transition-colors ${viewMode === 'library' ? 'bg-purple-500/20 text-purple-400' : 'text-[#8E8E93] hover:bg-white/5 hover:text-white'}`}
                title="Library"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </button>
              {/* Divider */}
              <div className="w-8 border-t border-[var(--border)] my-1" />
              {/* Channel icons */}
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleSelectChannel(channel.id)}
                  className={`p-2.5 rounded-lg transition-colors ${selectedChannelId === channel.id ? 'bg-white/10 text-white' : 'text-[#8E8E93] hover:bg-white/5 hover:text-white'}`}
                  title={channel.name}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-medium" style={{ backgroundColor: channel.color || '#3B82F6' }}>
                    {channel.name.charAt(0).toUpperCase()}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Expanded: Full content */}
          <div className={sidebarCollapsed ? 'md:hidden' : ''}>
            {/* Library Quick Link */}
            <button
              onClick={() => setViewMode('library')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-4 ${
                viewMode === 'library'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-[#8E8E93] hover:bg-white/5 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-sm font-medium">Library</span>
              <span className="ml-auto text-xs text-purple-400/70">AI Context</span>
            </button>

            {/* Entities Section */}
            {entitiesLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <EntityList
                entities={entities}
                onCreateEntity={handleCreateEntity}
                onAddSocialAccount={handleAddSocialAccount}
                onDeleteEntity={handleDeleteEntity}
                onDeleteSocialAccount={handleDeleteSocialAccount}
              />
            )}

            {/* Divider */}
            <div className="border-t border-[var(--border)] my-6" />

            {/* Channels List */}
            {channelsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ChannelList
                channels={channels}
                ideas={ideas}
                selectedChannelId={selectedChannelId}
                onSelectChannel={handleSelectChannel}
                onEditChannel={handleEditChannel}
                onDeleteChannel={handleDeleteChannel}
                onCreateChannel={handleCreateChannel}
              />
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className={`border-t border-[var(--border)] p-3 ${sidebarCollapsed ? 'md:p-2' : ''}`}>
          {/* New Idea Button */}
          <button
            onClick={handleCreateIdea}
            className={`w-full flex items-center justify-center gap-2 bg-[#10B981] text-white rounded-lg hover:bg-[#059669] transition-colors font-medium text-sm ${sidebarCollapsed ? 'md:p-2.5' : 'px-4 py-2.5'}`}
            title="New Idea"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className={sidebarCollapsed ? 'md:hidden' : ''}>New Idea</span>
          </button>

          {/* Collapse Toggle Button - Desktop only */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden md:flex w-full items-center justify-center gap-2 mt-2 px-4 py-2 text-[#8E8E93] hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm ${sidebarCollapsed ? 'md:px-2' : ''}`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            <span className={sidebarCollapsed ? 'md:hidden' : ''}>Collapse</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area - Kanban Board */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Content Header */}
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger menu for mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 -ml-1 rounded-lg hover:bg-white/10 transition-colors md:hidden"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-sm font-medium text-white">
              {viewMode === 'library' ? 'Library' : selectedChannelId === null ? 'All Ideas' : selectedChannelId === 'uncategorized' ? 'Uncategorized' : channels.find(c => c.id === selectedChannelId)?.name || 'Ideas'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#2C2C2E] rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-[#10B981] text-white'
                    : 'text-[#8E8E93] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  <span className="hidden sm:inline">Board</span>
                </span>
              </button>
              <button
                onClick={() => setViewMode('library')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'library'
                    ? 'bg-purple-500 text-white'
                    : 'text-[#8E8E93] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="hidden sm:inline">Library</span>
                </span>
              </button>
            </div>
            {viewMode === 'kanban' && (
              <span className="text-sm text-[#636366]">{filteredIdeas.length} ideas</span>
            )}
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {viewMode === 'library' ? (
            <Library />
          ) : ideasLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
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
            <div className="flex flex-col gap-4 md:flex-row md:gap-6 md:h-full md:min-w-max">
              {KANBAN_COLUMNS.map((column) => {
                const columnIdeas = filteredIdeas.filter((idea) => idea.status === column.status);
                const isDropTarget = dragOverColumn === column.status;
                return (
                  <div
                    key={column.status}
                    className={`w-full md:w-80 flex-shrink-0 flex flex-col bg-[var(--background-card)]/30 rounded-xl border-2 transition-all duration-200 ${
                      isDropTarget
                        ? 'scale-[1.02] shadow-lg'
                        : 'border-[var(--border)]'
                    }`}
                    style={isDropTarget ? { borderColor: column.color, boxShadow: `0 0 20px ${column.color}40` } : undefined}
                    onDragOver={(e) => handleDragOver(e, column.status)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.status)}
                  >
                    {/* Column Header */}
                    <div className="p-4 border-b border-[var(--border)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: column.color }}
                          />
                          <h3 className="font-medium text-white">{column.title}</h3>
                        </div>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${column.color}20`,
                            color: column.color,
                          }}
                        >
                          {columnIdeas.length}
                        </span>
                      </div>
                    </div>

                    {/* Column Content */}
                    <div className={`flex-1 overflow-y-auto p-3 space-y-3 min-h-[100px] ${isDropTarget ? 'bg-white/5' : ''}`}>
                      {columnIdeas.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center py-8 text-center ${isDropTarget ? 'opacity-50' : ''}`}>
                          <p className="text-sm text-[#636366]">
                            {isDropTarget ? 'Drop here' : `No ${column.title.toLowerCase()} ideas`}
                          </p>
                        </div>
                      ) : (
                        columnIdeas.map((idea) => (
                          <div
                            key={idea.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idea.id)}
                            onDragEnd={handleDragEnd}
                            className={`cursor-grab active:cursor-grabbing ${
                              draggingIdeaId === idea.id ? 'opacity-50' : ''
                            }`}
                          >
                            <IdeaCard
                              idea={idea}
                              onClick={() => handleEditIdea(idea)}
                              onDelete={() => handleDeleteIdea(idea.id)}
                              compact
                            />
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Idea Button for Draft column */}
                    {column.status === 'draft' && (
                      <div className="p-3 border-t border-[var(--border)]">
                        <button
                          onClick={handleCreateIdea}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-[#8E8E93] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Idea
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* Idea Form Modal */}
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
        entities={entities}
        socialAccounts={allSocialAccounts}
      />

      {/* Entity Form Modal */}
      <EntityForm
        isOpen={showEntityForm}
        onClose={() => setShowEntityForm(false)}
        onSubmit={handleEntityFormSubmit}
      />

      {/* Floating Action Button - Add Idea */}
      <button
        onClick={handleCreateIdea}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-12 h-12 md:w-14 md:h-14 bg-[#10B981] hover:bg-[#059669] text-white rounded-full shadow-lg shadow-[#10B981]/30 hover:shadow-[#10B981]/50 transition-all hover:scale-105 active:scale-95 flex items-center justify-center z-30"
        aria-label="Add new idea"
      >
        <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}

export default function FeedsPage() {
  return (
    <FeedsProvider>
      <FeedsPageContent />
    </FeedsProvider>
  );
}
