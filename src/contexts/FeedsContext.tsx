'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Channel, Idea, CreateChannelInput, UpdateChannelInput, CreateIdeaInput, UpdateIdeaInput, IdeaStatus } from '@/types/feeds';
import { useUser } from '@/lib/supabase/hooks';

interface FeedsContextValue {
  // Channels
  channels: Channel[];
  channelsLoading: boolean;
  channelsError: string | null;
  refreshChannels: () => Promise<void>;
  createChannel: (input: CreateChannelInput) => Promise<Channel | null>;
  updateChannel: (id: string, input: UpdateChannelInput) => Promise<boolean>;
  deleteChannel: (id: string) => Promise<boolean>;

  // Ideas
  ideas: Idea[];
  ideasLoading: boolean;
  ideasError: string | null;
  refreshIdeas: (channelId?: string | null, status?: IdeaStatus | null) => Promise<void>;
  createIdea: (input: CreateIdeaInput) => Promise<Idea | null>;
  updateIdea: (id: string, input: UpdateIdeaInput) => Promise<boolean>;
  deleteIdea: (id: string) => Promise<boolean>;

  // UI State
  selectedChannelId: string | null;
  setSelectedChannelId: (id: string | null) => void;
  statusFilter: IdeaStatus | null;
  setStatusFilter: (status: IdeaStatus | null) => void;
}

const FeedsContext = createContext<FeedsContextValue | null>(null);

export function FeedsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();

  // Channels state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  // Ideas state
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  // UI state
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | null>(null);

  // Fetch channels
  const refreshChannels = useCallback(async () => {
    if (!user?.id) {
      setChannels([]);
      return;
    }

    setChannelsLoading(true);
    setChannelsError(null);

    try {
      const response = await fetch('/api/channels');
      const data = await response.json();

      if (response.ok) {
        setChannels(data.channels || []);
      } else {
        setChannelsError(data.error || 'Failed to fetch channels');
      }
    } catch (err) {
      setChannelsError('Failed to fetch channels');
      console.error('Error fetching channels:', err);
    } finally {
      setChannelsLoading(false);
    }
  }, [user?.id]);

  // Create channel
  const createChannel = useCallback(async (input: CreateChannelInput): Promise<Channel | null> => {
    if (!user?.id) {
      setChannelsError('You must be logged in to create channels');
      return null;
    }

    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (response.ok && data.channel) {
        setChannels(prev => [data.channel, ...prev]);
        return data.channel;
      } else {
        setChannelsError(data.error || 'Failed to create channel');
        return null;
      }
    } catch (err) {
      setChannelsError('Failed to create channel');
      console.error('Error creating channel:', err);
      return null;
    }
  }, [user?.id]);

  // Update channel
  const updateChannel = useCallback(async (id: string, input: UpdateChannelInput): Promise<boolean> => {
    try {
      const response = await fetch(`/api/channels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        const result = await response.json();
        setChannels(prev => prev.map(c => c.id === id ? { ...c, ...result.channel } : c));
        return true;
      } else {
        const result = await response.json();
        setChannelsError(result.error || 'Failed to update channel');
        return false;
      }
    } catch (err) {
      setChannelsError('Failed to update channel');
      console.error('Error updating channel:', err);
      return false;
    }
  }, []);

  // Delete channel
  const deleteChannel = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/channels/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setChannels(prev => prev.filter(c => c.id !== id));
        // Clear selection if deleted channel was selected
        if (selectedChannelId === id) {
          setSelectedChannelId(null);
        }
        return true;
      } else {
        const data = await response.json();
        setChannelsError(data.error || 'Failed to delete channel');
        return false;
      }
    } catch (err) {
      setChannelsError('Failed to delete channel');
      console.error('Error deleting channel:', err);
      return false;
    }
  }, [selectedChannelId]);

  // Fetch ideas
  const refreshIdeas = useCallback(async (channelId?: string | null, status?: IdeaStatus | null) => {
    if (!user?.id) {
      setIdeas([]);
      return;
    }

    setIdeasLoading(true);
    setIdeasError(null);

    try {
      const params = new URLSearchParams();
      if (channelId) params.set('channelId', channelId);
      if (status) params.set('status', status);

      const url = `/api/ideas${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        setIdeas(data.ideas || []);
      } else {
        setIdeasError(data.error || 'Failed to fetch ideas');
      }
    } catch (err) {
      setIdeasError('Failed to fetch ideas');
      console.error('Error fetching ideas:', err);
    } finally {
      setIdeasLoading(false);
    }
  }, [user?.id]);

  // Create idea
  const createIdea = useCallback(async (input: CreateIdeaInput): Promise<Idea | null> => {
    if (!user?.id) {
      setIdeasError('You must be logged in to create ideas');
      return null;
    }

    try {
      const response = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (response.ok && data.idea) {
        setIdeas(prev => [data.idea, ...prev]);
        return data.idea;
      } else {
        setIdeasError(data.error || 'Failed to create idea');
        return null;
      }
    } catch (err) {
      setIdeasError('Failed to create idea');
      console.error('Error creating idea:', err);
      return null;
    }
  }, [user?.id]);

  // Update idea
  const updateIdea = useCallback(async (id: string, input: UpdateIdeaInput): Promise<boolean> => {
    try {
      const response = await fetch(`/api/ideas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        const result = await response.json();
        setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...result.idea } : i));
        return true;
      } else {
        const result = await response.json();
        setIdeasError(result.error || 'Failed to update idea');
        return false;
      }
    } catch (err) {
      setIdeasError('Failed to update idea');
      console.error('Error updating idea:', err);
      return false;
    }
  }, []);

  // Delete idea
  const deleteIdea = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/ideas/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setIdeas(prev => prev.filter(i => i.id !== id));
        return true;
      } else {
        const data = await response.json();
        setIdeasError(data.error || 'Failed to delete idea');
        return false;
      }
    } catch (err) {
      setIdeasError('Failed to delete idea');
      console.error('Error deleting idea:', err);
      return false;
    }
  }, []);

  // Load channels on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      refreshChannels();
    }
  }, [user?.id, refreshChannels]);

  // Load ideas when user, selected channel, or status filter changes
  useEffect(() => {
    if (user?.id) {
      refreshIdeas(selectedChannelId, statusFilter);
    }
  }, [user?.id, selectedChannelId, statusFilter, refreshIdeas]);

  return (
    <FeedsContext.Provider
      value={{
        channels,
        channelsLoading,
        channelsError,
        refreshChannels,
        createChannel,
        updateChannel,
        deleteChannel,
        ideas,
        ideasLoading,
        ideasError,
        refreshIdeas,
        createIdea,
        updateIdea,
        deleteIdea,
        selectedChannelId,
        setSelectedChannelId,
        statusFilter,
        setStatusFilter,
      }}
    >
      {children}
    </FeedsContext.Provider>
  );
}

export function useFeeds() {
  const context = useContext(FeedsContext);
  if (!context) {
    throw new Error('useFeeds must be used within a FeedsProvider');
  }
  return context;
}
