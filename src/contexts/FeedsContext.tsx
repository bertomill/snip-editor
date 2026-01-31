'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  Channel, Idea, CreateChannelInput, UpdateChannelInput, CreateIdeaInput, UpdateIdeaInput, IdeaStatus,
  Entity, SocialAccount, CreateEntityInput, UpdateEntityInput, CreateSocialAccountInput, SocialPlatform
} from '@/types/feeds';
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

  // Entities (people/companies)
  entities: Entity[];
  entitiesLoading: boolean;
  entitiesError: string | null;
  refreshEntities: () => Promise<void>;
  createEntity: (input: CreateEntityInput) => Promise<Entity | null>;
  updateEntity: (id: string, input: UpdateEntityInput) => Promise<boolean>;
  deleteEntity: (id: string) => Promise<boolean>;

  // Social Accounts
  createSocialAccount: (input: CreateSocialAccountInput) => Promise<SocialAccount | null>;
  deleteSocialAccount: (id: string) => Promise<boolean>;

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

  // Helper to get all social accounts flattened
  allSocialAccounts: SocialAccount[];
}

const FeedsContext = createContext<FeedsContextValue | null>(null);

export function FeedsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();

  // Channels state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  // Entities state
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [entitiesError, setEntitiesError] = useState<string | null>(null);

  // Ideas state
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  // UI state
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | null>(null);

  // Computed: all social accounts flattened
  const allSocialAccounts = entities.flatMap(e => e.socialAccounts || []);

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

  // Fetch entities
  const refreshEntities = useCallback(async () => {
    if (!user?.id) {
      setEntities([]);
      return;
    }

    setEntitiesLoading(true);
    setEntitiesError(null);

    try {
      const response = await fetch('/api/entities');
      const data = await response.json();

      if (response.ok) {
        setEntities(data.entities || []);
      } else {
        setEntitiesError(data.error || 'Failed to fetch entities');
      }
    } catch (err) {
      setEntitiesError('Failed to fetch entities');
      console.error('Error fetching entities:', err);
    } finally {
      setEntitiesLoading(false);
    }
  }, [user?.id]);

  // Create entity
  const createEntity = useCallback(async (input: CreateEntityInput): Promise<Entity | null> => {
    if (!user?.id) {
      setEntitiesError('You must be logged in');
      return null;
    }

    try {
      const response = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (response.ok && data.entity) {
        setEntities(prev => [...prev, data.entity]);
        return data.entity;
      } else {
        setEntitiesError(data.error || 'Failed to create entity');
        return null;
      }
    } catch (err) {
      setEntitiesError('Failed to create entity');
      console.error('Error creating entity:', err);
      return null;
    }
  }, [user?.id]);

  // Update entity
  const updateEntity = useCallback(async (id: string, input: UpdateEntityInput): Promise<boolean> => {
    try {
      const response = await fetch(`/api/entities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        const result = await response.json();
        setEntities(prev => prev.map(e => e.id === id ? { ...e, ...result.entity } : e));
        return true;
      } else {
        const result = await response.json();
        setEntitiesError(result.error || 'Failed to update entity');
        return false;
      }
    } catch (err) {
      setEntitiesError('Failed to update entity');
      console.error('Error updating entity:', err);
      return false;
    }
  }, []);

  // Delete entity
  const deleteEntity = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/entities/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setEntities(prev => prev.filter(e => e.id !== id));
        return true;
      } else {
        const data = await response.json();
        setEntitiesError(data.error || 'Failed to delete entity');
        return false;
      }
    } catch (err) {
      setEntitiesError('Failed to delete entity');
      console.error('Error deleting entity:', err);
      return false;
    }
  }, []);

  // Create social account
  const createSocialAccount = useCallback(async (input: CreateSocialAccountInput): Promise<SocialAccount | null> => {
    if (!user?.id) {
      return null;
    }

    try {
      const response = await fetch('/api/social-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (response.ok && data.socialAccount) {
        // Add to the entity's social accounts
        setEntities(prev => prev.map(e => {
          if (e.id === input.entityId) {
            return {
              ...e,
              socialAccounts: [...(e.socialAccounts || []), data.socialAccount],
            };
          }
          return e;
        }));
        return data.socialAccount;
      } else {
        console.error('Failed to create social account:', data.error);
        return null;
      }
    } catch (err) {
      console.error('Error creating social account:', err);
      return null;
    }
  }, [user?.id]);

  // Delete social account
  const deleteSocialAccount = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/social-accounts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from entities
        setEntities(prev => prev.map(e => ({
          ...e,
          socialAccounts: (e.socialAccounts || []).filter(sa => sa.id !== id),
        })));
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.error('Error deleting social account:', err);
      return false;
    }
  }, []);

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

  // Load entities on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      refreshEntities();
    }
  }, [user?.id, refreshEntities]);

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
        entities,
        entitiesLoading,
        entitiesError,
        refreshEntities,
        createEntity,
        updateEntity,
        deleteEntity,
        createSocialAccount,
        deleteSocialAccount,
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
        allSocialAccounts,
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
