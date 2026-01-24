"use client";

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { OverlayState, OverlayAction, TextOverlay, StickerOverlay, ClipTransition, AudioSettings, defaultAudioSettings } from '@/types/overlays';

const initialState: OverlayState = {
  textOverlays: [],
  stickers: [],
  filterId: null,
  showCaptionPreview: true,
  captionPositionY: 75, // Default near bottom (75% from top)
  audioSettings: defaultAudioSettings,
  clipTransitions: [],
};

function overlayReducer(state: OverlayState, action: OverlayAction): OverlayState {
  switch (action.type) {
    case 'ADD_TEXT_OVERLAY':
      if (state.textOverlays.length >= 5) return state; // Max 5 text overlays
      return {
        ...state,
        textOverlays: [...state.textOverlays, action.payload],
      };

    case 'UPDATE_TEXT_OVERLAY':
      return {
        ...state,
        textOverlays: state.textOverlays.map((overlay) =>
          overlay.id === action.payload.id
            ? { ...overlay, ...action.payload.updates }
            : overlay
        ),
      };

    case 'REMOVE_TEXT_OVERLAY':
      return {
        ...state,
        textOverlays: state.textOverlays.filter((o) => o.id !== action.payload),
      };

    case 'ADD_STICKER':
      if (state.stickers.length >= 10) return state; // Max 10 stickers
      return {
        ...state,
        stickers: [...state.stickers, action.payload],
      };

    case 'UPDATE_STICKER':
      return {
        ...state,
        stickers: state.stickers.map((sticker) =>
          sticker.id === action.payload.id
            ? { ...sticker, ...action.payload.updates }
            : sticker
        ),
      };

    case 'REMOVE_STICKER':
      return {
        ...state,
        stickers: state.stickers.filter((s) => s.id !== action.payload),
      };

    case 'SET_FILTER':
      return {
        ...state,
        filterId: action.payload,
      };

    case 'TOGGLE_CAPTION_PREVIEW':
      return {
        ...state,
        showCaptionPreview: !state.showCaptionPreview,
      };

    case 'SET_CAPTION_POSITION':
      return {
        ...state,
        captionPositionY: Math.max(10, Math.min(90, action.payload)), // Clamp between 10-90%
      };

    case 'RESET_OVERLAYS':
      return initialState;

    case 'SET_AUDIO_SETTINGS':
      return {
        ...state,
        audioSettings: { ...state.audioSettings, ...action.payload },
      };

    case 'ADD_TRANSITION':
      return {
        ...state,
        clipTransitions: [...state.clipTransitions, action.payload],
      };

    case 'UPDATE_TRANSITION':
      return {
        ...state,
        clipTransitions: state.clipTransitions.map((t) =>
          t.id === action.payload.id
            ? { ...t, ...action.payload.updates }
            : t
        ),
      };

    case 'REMOVE_TRANSITION':
      return {
        ...state,
        clipTransitions: state.clipTransitions.filter((t) => t.id !== action.payload),
      };

    case 'SET_TRANSITIONS':
      return {
        ...state,
        clipTransitions: action.payload,
      };

    case 'SET_STATE':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

interface OverlayContextValue {
  state: OverlayState;
  dispatch: React.Dispatch<OverlayAction>;
  addTextOverlay: (overlay: TextOverlay) => void;
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
  removeTextOverlay: (id: string) => void;
  addSticker: (sticker: StickerOverlay) => void;
  updateSticker: (id: string, updates: Partial<StickerOverlay>) => void;
  removeSticker: (id: string) => void;
  setFilter: (filterId: string | null) => void;
  toggleCaptionPreview: () => void;
  setCaptionPosition: (positionY: number) => void;
  setAudioSettings: (settings: Partial<AudioSettings>) => void;
  addTransition: (transition: ClipTransition) => void;
  updateTransition: (id: string, updates: Partial<ClipTransition>) => void;
  removeTransition: (id: string) => void;
  setTransitions: (transitions: ClipTransition[]) => void;
  loadState: (state: Partial<OverlayState>) => void;
  resetOverlays: () => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(overlayReducer, initialState);

  const value: OverlayContextValue = {
    state,
    dispatch,
    addTextOverlay: (overlay) => dispatch({ type: 'ADD_TEXT_OVERLAY', payload: overlay }),
    updateTextOverlay: (id, updates) => dispatch({ type: 'UPDATE_TEXT_OVERLAY', payload: { id, updates } }),
    removeTextOverlay: (id) => dispatch({ type: 'REMOVE_TEXT_OVERLAY', payload: id }),
    addSticker: (sticker) => dispatch({ type: 'ADD_STICKER', payload: sticker }),
    updateSticker: (id, updates) => dispatch({ type: 'UPDATE_STICKER', payload: { id, updates } }),
    removeSticker: (id) => dispatch({ type: 'REMOVE_STICKER', payload: id }),
    setFilter: (filterId) => dispatch({ type: 'SET_FILTER', payload: filterId }),
    toggleCaptionPreview: () => dispatch({ type: 'TOGGLE_CAPTION_PREVIEW' }),
    setCaptionPosition: (positionY) => dispatch({ type: 'SET_CAPTION_POSITION', payload: positionY }),
    setAudioSettings: (settings) => dispatch({ type: 'SET_AUDIO_SETTINGS', payload: settings }),
    addTransition: (transition) => dispatch({ type: 'ADD_TRANSITION', payload: transition }),
    updateTransition: (id, updates) => dispatch({ type: 'UPDATE_TRANSITION', payload: { id, updates } }),
    removeTransition: (id) => dispatch({ type: 'REMOVE_TRANSITION', payload: id }),
    setTransitions: (transitions) => dispatch({ type: 'SET_TRANSITIONS', payload: transitions }),
    loadState: (newState) => dispatch({ type: 'SET_STATE', payload: newState }),
    resetOverlays: () => dispatch({ type: 'RESET_OVERLAYS' }),
  };

  return (
    <OverlayContext.Provider value={value}>
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlay() {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }
  return context;
}
