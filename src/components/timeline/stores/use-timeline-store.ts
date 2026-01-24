import { create } from 'zustand';
import { TimelineItem } from '../types';

// Type for ghost element data during drag operations
export interface GhostInstanceData {
  id: string;
  left: number;
  width: number;
  top: number;
}

// Type for drag information
export interface DragInfoState {
  id: string;
  action: "move" | "resize-start" | "resize-end";
  startX: number;
  startY: number;
  startPosition: number; // start time in seconds
  startDuration: number; // duration in seconds
  startRow: number;
  ghostLeft?: number;
  ghostWidth?: number;
  ghostTop?: number;
  isValidDrop: boolean;
  selectedItemsSnapshot: DraggedItemSnapshot[];
  currentRow?: number;
  currentStart?: number;
  currentDuration?: number;
}

// Type for dragged item snapshot
export interface DraggedItemSnapshot {
  id: string;
  originalStart: number;
  originalDuration: number;
  originalRow: number;
  type?: string;
  label?: string;
  data?: any;
}

interface TimelineState {
  ghostMarkerPosition: number | null;
  isDragging: boolean;
  isPlayheadDragging: boolean;
  draggedItem: TimelineItem | null;
  ghostElement: GhostInstanceData[] | null;
  isValidDrop: boolean;
  dragInfo: DragInfoState | null;
  insertionIndex: number | null;
}

export interface ITimelineStore extends TimelineState {
  setGhostMarkerPosition: (position: number | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  setIsPlayheadDragging: (isPlayheadDragging: boolean) => void;
  setDraggedItem: (item: TimelineItem | null) => void;
  setGhostElement: (ghostElement: GhostInstanceData[] | null) => void;
  setIsValidDrop: (isValid: boolean) => void;
  setDragInfo: (dragInfo: DragInfoState | null) => void;
  getDragInfo: () => DragInfoState | null;
  setInsertionIndex: (index: number | null) => void;
  getInsertionIndex: () => number | null;
  resetDragState: () => void;
  clearAllState: () => void;
}

const useTimelineStore = create<ITimelineStore>()((set, get) => ({
  // Initial state
  ghostMarkerPosition: null,
  isDragging: false,
  isPlayheadDragging: false,
  draggedItem: null,
  ghostElement: null,
  isValidDrop: true,
  dragInfo: null,
  insertionIndex: null,

  // Basic setters
  setGhostMarkerPosition: (position: number | null) => {
    set({ ghostMarkerPosition: position });
  },

  setIsDragging: (isDragging: boolean) => {
    set({ isDragging });
  },

  setIsPlayheadDragging: (isPlayheadDragging: boolean) => {
    set({ isPlayheadDragging });
  },

  setDraggedItem: (item: TimelineItem | null) => {
    set({ draggedItem: item });
  },

  setGhostElement: (ghostElement: GhostInstanceData[] | null) => {
    set({ ghostElement });
  },

  setIsValidDrop: (isValid: boolean) => {
    set({ isValidDrop: isValid });
  },

  setDragInfo: (dragInfo: DragInfoState | null) => {
    set({ dragInfo });
  },

  getDragInfo: () => {
    return get().dragInfo;
  },

  setInsertionIndex: (index: number | null) => {
    set({ insertionIndex: index });
  },

  getInsertionIndex: () => get().insertionIndex,

  resetDragState: () => {
    set({
      draggedItem: null,
      ghostElement: null,
      isValidDrop: false,
      dragInfo: null,
      isDragging: false,
      insertionIndex: null,
    });
  },

  clearAllState: () => {
    set({
      ghostMarkerPosition: null,
      isDragging: false,
      draggedItem: null,
      ghostElement: null,
      isValidDrop: true,
      dragInfo: null,
      insertionIndex: null,
    });
  },
}));

export default useTimelineStore;
