import { useCallback, useRef } from 'react';
import { TimelineItem, TimelineTrack, TrackItemType } from '../types';
import { TIMELINE_CONSTANTS, SNAPPING_CONFIG } from '../constants';
import useTimelineStore, { DragInfoState, DraggedItemSnapshot, GhostInstanceData } from '../stores/use-timeline-store';

interface UseTimelineDragAndDropProps {
  totalDuration: number;
  tracks: TimelineTrack[];
  onItemMove?: (itemId: string, newStart: number, newEnd: number, newTrackId: string) => void;
  onItemResize?: (itemId: string, newStart: number, newEnd: number) => void;
  timelineRef: React.RefObject<HTMLDivElement> | React.RefObject<HTMLDivElement | null>;
  selectedItemIds?: string[];
}

const MIN_ITEM_DURATION = 0.1;

export const useTimelineDragAndDrop = ({
  totalDuration,
  tracks,
  onItemMove,
  onItemResize,
  timelineRef,
  selectedItemIds = [],
}: UseTimelineDragAndDropProps) => {
  const {
    setDraggedItem,
    setGhostElement,
    setIsValidDrop,
    setDragInfo,
    getDragInfo,
    resetDragState,
    setIsDragging,
    setInsertionIndex,
  } = useTimelineStore();

  const lastUpdateTime = useRef<number>(0);

  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / SNAPPING_CONFIG.gridSize) * SNAPPING_CONFIG.gridSize;
  }, []);

  const calculateGhostPosition = useCallback(
    (startTime: number, duration: number, trackIndex: number): GhostInstanceData => {
      const leftPercentage = (startTime / totalDuration) * 100;
      const widthPercentage = (duration / totalDuration) * 100;
      const topPercentage = trackIndex * (100 / tracks.length);

      return {
        id: 'ghost',
        left: Math.max(0, leftPercentage),
        width: Math.max(0.1, widthPercentage),
        top: topPercentage,
      };
    },
    [totalDuration, tracks.length]
  );

  const validateDropPosition = useCallback(
    (targetStart: number, targetDuration: number, targetTrackIndex: number, excludeIds: string[] = [], itemType?: TrackItemType) => {
      const targetEnd = targetStart + targetDuration;

      if (targetStart < 0) {
        return { isValid: false, reason: "Cannot place item before timeline start" };
      }

      if (targetTrackIndex < 0 || targetTrackIndex >= tracks.length) {
        return { isValid: false, reason: "Invalid track" };
      }

      const targetTrack = tracks[targetTrackIndex];

      // Video clips can be reordered - allow "overlap" since they'll be repositioned
      if (itemType === TrackItemType.VIDEO && targetTrack.id === 'video-track') {
        return { isValid: true };
      }

      // Check for overlaps (for non-video items)
      const overlappingItems = targetTrack.items.filter(
        (item) =>
          !excludeIds.includes(item.id) &&
          targetStart < item.end &&
          targetEnd > item.start
      );

      if (overlappingItems.length > 0) {
        return { isValid: false, reason: "Overlaps with existing item" };
      }

      return { isValid: true };
    },
    [tracks]
  );

  const handleDragStart = useCallback(
    (item: TimelineItem, clientX: number, clientY: number, action: "move" | "resize-start" | "resize-end") => {
      // Prevent dragging script/pause items
      if (item.type === TrackItemType.SCRIPT || item.type === TrackItemType.PAUSE) {
        return;
      }

      if (!timelineRef.current) return;

      const itemTrackIndex = tracks.findIndex(track => track.id === item.trackId);
      if (itemTrackIndex === -1) return;

      const itemDuration = item.end - item.start;

      const selectedItemsSnapshot: DraggedItemSnapshot[] = [{
        id: item.id,
        originalStart: item.start,
        originalDuration: itemDuration,
        originalRow: itemTrackIndex,
        type: item.type,
        label: item.label,
        data: item.data,
      }];

      const dragInfo: DragInfoState = {
        id: item.id,
        action,
        startX: clientX,
        startY: clientY,
        startPosition: item.start,
        startDuration: itemDuration,
        startRow: itemTrackIndex,
        isValidDrop: true,
        selectedItemsSnapshot,
      };

      setDragInfo(dragInfo);
      setDraggedItem(item);
      setIsDragging(true);

      const initialGhost = calculateGhostPosition(item.start, itemDuration, itemTrackIndex);
      setGhostElement([initialGhost]);
      setIsValidDrop(true);
      setInsertionIndex(null);
    },
    [timelineRef, tracks, setDragInfo, setDraggedItem, setIsDragging, setGhostElement, setIsValidDrop, calculateGhostPosition, setInsertionIndex]
  );

  const handleDrag = useCallback(
    (clientX: number, clientY: number) => {
      const dragInfo = getDragInfo();
      if (!dragInfo || !timelineRef.current) return;

      // Throttle updates for performance
      const now = performance.now();
      if (now - lastUpdateTime.current < 16) return;
      lastUpdateTime.current = now;

      const timelineRect = timelineRef.current.getBoundingClientRect();
      const deltaX = clientX - dragInfo.startX;
      const deltaY = clientY - dragInfo.startY;

      const deltaTime = (deltaX / timelineRect.width) * totalDuration;
      const trackHeight = TIMELINE_CONSTANTS.TRACK_HEIGHT;
      const deltaTrack = Math.round(deltaY / trackHeight);

      let newStart: number;
      let newDuration: number;
      let newTrackIndex: number;

      switch (dragInfo.action) {
        case "move":
          newStart = snapToGrid(dragInfo.startPosition + deltaTime);
          newDuration = dragInfo.startDuration;
          newTrackIndex = Math.max(0, Math.min(tracks.length - 1, dragInfo.startRow + deltaTrack));
          break;

        case "resize-start":
          const rawNewStart = dragInfo.startPosition + deltaTime;
          const snappedNewStart = snapToGrid(rawNewStart);
          const originalEnd = dragInfo.startPosition + dragInfo.startDuration;
          newDuration = Math.max(MIN_ITEM_DURATION, originalEnd - snappedNewStart);
          newStart = originalEnd - newDuration;
          newTrackIndex = dragInfo.startRow;
          break;

        case "resize-end":
          newStart = dragInfo.startPosition;
          const rawNewDuration = dragInfo.startDuration + deltaTime;
          newDuration = Math.max(MIN_ITEM_DURATION, snapToGrid(rawNewDuration));
          newTrackIndex = dragInfo.startRow;
          break;

        default:
          return;
      }

      // Ensure boundaries
      newStart = Math.max(0, newStart);

      // Get item type from snapshot for validation
      const itemType = dragInfo.selectedItemsSnapshot?.[0]?.type as TrackItemType | undefined;
      const validation = validateDropPosition(newStart, newDuration, newTrackIndex, [dragInfo.id], itemType);

      const ghostElement = calculateGhostPosition(newStart, newDuration, newTrackIndex);

      setGhostElement([ghostElement]);
      setIsValidDrop(validation.isValid);
      setDragInfo({
        ...dragInfo,
        currentStart: newStart,
        currentDuration: newDuration,
        currentRow: newTrackIndex,
      });
    },
    [getDragInfo, timelineRef, totalDuration, tracks.length, snapToGrid, validateDropPosition, calculateGhostPosition, setGhostElement, setIsValidDrop, setDragInfo]
  );

  const handleDragEnd = useCallback(() => {
    const dragInfo = getDragInfo();
    if (!dragInfo) {
      return;
    }

    const state = useTimelineStore.getState();
    const ghostElements = state.ghostElement;

    if (!ghostElements || ghostElements.length === 0 || !state.isValidDrop) {
      resetDragState();
      return;
    }

    const ghostElement = ghostElements[0];
    const finalStart = snapToGrid((ghostElement.left / 100) * totalDuration);
    const finalDuration = snapToGrid((ghostElement.width / 100) * totalDuration);
    const finalTrackIndex = Math.round(ghostElement.top * tracks.length / 100);
    const finalEnd = finalStart + finalDuration;

    if (dragInfo.action === "move" && onItemMove) {
      const targetTrack = tracks[finalTrackIndex];
      if (targetTrack) {
        onItemMove(dragInfo.id, finalStart, finalEnd, targetTrack.id);
      }
    } else if ((dragInfo.action === "resize-start" || dragInfo.action === "resize-end") && onItemResize) {
      onItemResize(dragInfo.id, finalStart, finalEnd);
    }

    resetDragState();
  }, [getDragInfo, resetDragState, snapToGrid, totalDuration, tracks, onItemMove, onItemResize]);

  return {
    handleDragStart,
    handleDrag,
    handleDragEnd,
  };
};
