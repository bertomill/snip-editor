import { useState, useEffect, useCallback } from 'react';
import { TimelineTrack, TimelineItem } from '../types';
import { SNAPPING_CONFIG } from '../constants';

export interface UseTimelineTracksProps {
  initialTracks: TimelineTrack[];
  onTracksChange?: (tracks: TimelineTrack[]) => void;
  selectedItemIds?: string[];
  onSelectedItemsChange?: (itemIds: string[]) => void;
}

export const useTimelineTracks = ({
  initialTracks,
  onTracksChange,
  selectedItemIds = [],
  onSelectedItemsChange
}: UseTimelineTracksProps) => {
  const [tracks, setTracks] = useState<TimelineTrack[]>(initialTracks);

  useEffect(() => {
    setTracks(initialTracks);
  }, [initialTracks]);

  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / SNAPPING_CONFIG.gridSize) * SNAPPING_CONFIG.gridSize;
  }, []);

  const handleItemMove = useCallback((itemId: string, newStart: number, newEnd: number, newTrackId: string) => {
    setTracks(prevTracks => {
      // Find the item in any track
      let sourceItem: TimelineItem | null = null;
      for (const track of prevTracks) {
        const found = track.items.find(item => item.id === itemId);
        if (found) {
          sourceItem = found;
          break;
        }
      }

      if (!sourceItem) return prevTracks;

      // Remove from all tracks
      const newTracks = prevTracks.map(track => ({
        ...track,
        items: track.items.filter(item => item.id !== itemId)
      }));

      // Add to target track with updated position
      const targetTrackIndex = newTracks.findIndex(track => track.id === newTrackId);
      if (targetTrackIndex !== -1) {
        const updatedItem: TimelineItem = {
          id: sourceItem.id,
          trackId: newTrackId,
          start: snapToGrid(newStart),
          end: snapToGrid(newEnd),
          label: sourceItem.label,
          type: sourceItem.type,
          color: sourceItem.color,
          data: sourceItem.data,
        };

        newTracks[targetTrackIndex].items.push(updatedItem);
        newTracks[targetTrackIndex].items.sort((a, b) => a.start - b.start);
      }

      onTracksChange?.(newTracks);
      return newTracks;
    });
  }, [onTracksChange, snapToGrid]);

  const handleItemResize = useCallback((itemId: string, newStart: number, newEnd: number) => {
    setTracks(prevTracks => {
      const newTracks = prevTracks.map(track => ({
        ...track,
        items: track.items.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              start: snapToGrid(newStart),
              end: snapToGrid(newEnd)
            };
          }
          return item;
        })
      }));

      onTracksChange?.(newTracks);
      return newTracks;
    });
  }, [onTracksChange, snapToGrid]);

  const handleItemsDelete = useCallback((itemIds: string[]) => {
    setTracks(prevTracks => {
      const newTracks = prevTracks.map(track => ({
        ...track,
        items: track.items.filter(item => !itemIds.includes(item.id))
      }));

      onTracksChange?.(newTracks);
      return newTracks;
    });
  }, [onTracksChange]);

  const handleTrackReorder = useCallback((fromIndex: number, toIndex: number) => {
    setTracks(prevTracks => {
      // Validate indices
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prevTracks.length ||
        toIndex >= prevTracks.length ||
        fromIndex === toIndex
      ) {
        return prevTracks;
      }

      // Create new array and reorder
      const newTracks = [...prevTracks];
      const [movedTrack] = newTracks.splice(fromIndex, 1);
      newTracks.splice(toIndex, 0, movedTrack);

      onTracksChange?.(newTracks);
      return newTracks;
    });
  }, [onTracksChange]);

  return {
    tracks,
    setTracks,
    handleItemMove,
    handleItemResize,
    handleItemsDelete,
    handleTrackReorder,
  };
};
