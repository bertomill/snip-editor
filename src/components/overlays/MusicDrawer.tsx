"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useOverlay } from "./OverlayContext";
import { MusicTrack } from "@/types/overlays";
import { MusicSearchResult } from "@/app/api/music/search/route";

interface MusicDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  totalDurationMs: number;
  currentTimeMs: number;
}

const MUSIC_CATEGORIES = [
  { id: "", name: "All" },
  { id: "beats", name: "Beats" },
  { id: "ambient", name: "Ambient" },
  { id: "cinematic", name: "Cinematic" },
  { id: "electronic", name: "Electronic" },
  { id: "jazz", name: "Jazz" },
  { id: "classical", name: "Classical" },
];

/**
 * Drawer for searching and adding background music
 */
export function MusicDrawer({
  isOpen,
  onClose,
  totalDurationMs,
  currentTimeMs,
}: MusicDrawerProps) {
  const { state, addMusicTrack } = useOverlay();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [tracks, setTracks] = useState<MusicSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const canAdd = state.musicTracks.length < 3;

  // Fetch music tracks
  const fetchTracks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (activeCategory) params.set("category", activeCategory);

      const response = await fetch(`/api/music/search?${params.toString()}`);
      const data = await response.json();

      setTracks(data.tracks || []);
      setIsDemo(data.isDemo || false);
    } catch (error) {
      console.error("Failed to fetch music:", error);
      setTracks([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, activeCategory]);

  // Fetch tracks on mount and when search/category changes
  useEffect(() => {
    if (isOpen) {
      fetchTracks();
    }
  }, [isOpen, fetchTracks]);

  // Cleanup audio on close
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      setPlayingTrackId(null);
    }
  }, [isOpen]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracks();
  };

  // Toggle preview playback
  const togglePreview = (track: MusicSearchResult) => {
    if (playingTrackId === track.id) {
      // Stop playing
      audioRef.current?.pause();
      setPlayingTrackId(null);
    } else {
      // Start playing
      if (audioRef.current) {
        audioRef.current.src = track.previewUrl;
        audioRef.current.volume = 0.5;
        audioRef.current.play().catch(console.error);
        setPlayingTrackId(track.id);
      }
    }
  };

  // Add music track
  const handleAddTrack = (track: MusicSearchResult) => {
    if (!canAdd) return;

    // Stop preview if playing
    audioRef.current?.pause();
    setPlayingTrackId(null);

    const newTrack: MusicTrack = {
      id: `music-${Date.now()}`,
      pixabayId: track.id,
      url: track.audioUrl,
      name: track.title,
      artist: track.artist,
      startMs: currentTimeMs,
      durationMs: Math.min(track.duration * 1000, totalDurationMs - currentTimeMs),
      trimStartMs: 0,
      volume: 0.3, // Default 30% volume for background music
    };

    addMusicTrack(newTrack);
    onClose();
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Hidden audio element for preview */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingTrackId(null)}
        className="hidden"
      />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">Add Music</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg
              className="w-5 h-5 text-white/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {!canAdd && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
            Maximum 3 music tracks reached
          </div>
        )}

        {isDemo && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm">
            Showing demo tracks. Add PIXABAY_API_KEY for full library access.
          </div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search music..."
              className="flex-1 px-4 py-2 bg-[#2C2C2E] rounded-lg text-white placeholder-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#4A8FE7]"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-[#4A8FE7] text-white rounded-lg hover:bg-[#3A7FD7] transition-colors disabled:opacity-50"
            >
              {isLoading ? "..." : "Search"}
            </button>
          </div>
        </form>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {MUSIC_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                activeCategory === category.id
                  ? "bg-[#4A8FE7] text-white"
                  : "bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Track List */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-[#8E8E93]">
              Loading tracks...
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-8 text-[#8E8E93]">
              No tracks found. Try a different search.
            </div>
          ) : (
            tracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-3 p-3 bg-[#2C2C2E] rounded-xl hover:bg-[#3C3C3E] transition-colors"
              >
                {/* Play/Pause button */}
                <button
                  onClick={() => togglePreview(track)}
                  className="w-10 h-10 flex items-center justify-center bg-[#4A8FE7] rounded-full hover:bg-[#3A7FD7] transition-colors flex-shrink-0"
                >
                  {playingTrackId === track.id ? (
                    <svg
                      className="w-5 h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-white ml-0.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{track.title}</p>
                  <p className="text-[#8E8E93] text-sm truncate">
                    {track.artist} • {formatDuration(track.duration)}
                  </p>
                </div>

                {/* Add button */}
                <button
                  onClick={() => handleAddTrack(track)}
                  disabled={!canAdd}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-medium rounded-lg hover:from-pink-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  Add
                </button>
              </div>
            ))
          )}
        </div>

        {/* Usage hint */}
        <p className="text-xs text-[#636366] text-center mt-5">
          Music will start at current playback position ({state.musicTracks.length}/3)
        </p>
      </div>
    </div>
  );
}
