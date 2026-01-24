"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { captionTemplates, CaptionTemplate } from "@/lib/caption-templates";
import {
  OverlayProvider,
  useOverlay,
  OverlayToolbar,
  ActiveOverlayList,
  TextOverlayDrawer,
  StickerDrawer,
  FilterDrawer,
} from "@/components/overlays";
import { getFilterById } from "@/lib/templates/filter-presets";
import { TextOverlay, StickerOverlay } from "@/types/overlays";
import { Sidebar } from "@/components/Sidebar";

type EditorStep = "upload" | "edit" | "export";

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  clipIndex: number;
}

interface VideoClip {
  file: File;
  url: string;
  previewUrl?: string; // Browser-compatible preview URL (for MOV/HEVC files)
  duration: number;
  transcript?: string;
  segments?: TranscriptSegment[];
}

export default function Home() {
  const [step, setStep] = useState<EditorStep>("upload");
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [deletedSegments, setDeletedSegments] = useState<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      clips.forEach((clip) => URL.revokeObjectURL(clip.url));
    };
  }, [clips]);

  const [isConverting, setIsConverting] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    setIsConverting(true);
    setStep("edit");

    const videoClips: VideoClip[] = await Promise.all(
      files.map(async (file) => {
        const url = URL.createObjectURL(file);
        const duration = await getVideoDuration(url);

        // Check if we need to convert for browser preview
        const needsConversion =
          file.type === "video/quicktime" ||
          file.name.toLowerCase().endsWith(".mov") ||
          file.name.toLowerCase().endsWith(".hevc");

        let previewUrl: string | undefined;

        if (needsConversion) {
          try {
            const formData = new FormData();
            formData.append("video", file);

            const response = await fetch("/api/convert-preview", {
              method: "POST",
              body: formData,
            });

            if (response.ok) {
              const data = await response.json();
              previewUrl = data.url;
            }
          } catch (error) {
            console.error("Preview conversion failed:", error);
          }
        }

        return { file, url, previewUrl, duration };
      })
    );

    setClips(videoClips);
    setIsConverting(false);
  };

  // All segments with global timestamps
  const allSegments = useMemo(() => {
    const segments: TranscriptSegment[] = [];
    let timeOffset = 0;

    clips.forEach((clip, clipIndex) => {
      if (clip.segments) {
        clip.segments.forEach((seg) => {
          segments.push({
            ...seg,
            start: seg.start + timeOffset,
            end: seg.end + timeOffset,
            clipIndex,
          });
        });
      }
      timeOffset += clip.duration;
    });

    return segments;
  }, [clips]);

  return (
    <OverlayProvider>
      <Sidebar />
      <div className="min-h-screen flex flex-col bg-[#0A0A0A] pl-[72px]">
        <header className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-[#1C1C1E]">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Snip
            </h1>
          </div>
          {step === "edit" && (
            <button
              onClick={() => setStep("export")}
              className="btn-primary text-sm px-5 py-2.5"
            >
              Export
            </button>
          )}
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
          {step === "upload" && (
            <UploadStep onFilesSelected={handleFilesSelected} />
          )}
          {step === "edit" && (
            <EditStep
              clips={clips}
              setClips={setClips}
              deletedSegments={deletedSegments}
              setDeletedSegments={setDeletedSegments}
              isConverting={isConverting}
            />
          )}
          {step === "export" && (
            <ExportStep
              clips={clips}
              segments={allSegments}
              deletedSegmentIndices={Array.from(deletedSegments)}
              onBack={() => setStep("edit")}
            />
          )}
        </main>
      </div>
    </OverlayProvider>
  );
}

function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = () => resolve(0);
    video.src = url;
  });
}

function UploadStep({
  onFilesSelected,
}: {
  onFilesSelected: (files: File[]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith("video/")
    );
    if (files.length > 0) onFilesSelected(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div className="w-full max-w-lg text-center px-4 animate-fade-in-up">
      <p className="label mb-5">Get Started</p>
      <h2 className="text-3xl font-bold mb-3 tracking-tight text-white">Drop your clips</h2>
      <p className="text-[#8E8E93] mb-10 text-base">
        Upload your video clips to begin editing
      </p>

      <label
        className={`card-glow flex flex-col items-center justify-center w-full h-72 cursor-pointer border-2 border-dashed transition-all duration-300 ${
          isDragging
            ? "border-[#4A8FE7] bg-[#4A8FE7]/10 scale-[1.02]"
            : "border-[#2C2C2E] hover:border-[#4A8FE7]/50 hover:bg-[#181818]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <div className={`w-16 h-16 rounded-full bg-[#4A8FE7]/15 flex items-center justify-center mb-5 transition-all duration-300 ${isDragging ? "scale-110 bg-[#4A8FE7]/25" : ""}`}>
          <svg
            className="w-7 h-7 text-[#4A8FE7]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <p className="text-white font-semibold text-lg mb-1">Click or drag to upload</p>
        <p className="text-[#636366] text-sm">MOV, MP4, and more</p>
      </label>
    </div>
  );
}

function EditStep({
  clips,
  setClips,
  deletedSegments,
  setDeletedSegments,
  isConverting,
}: {
  clips: VideoClip[];
  setClips: React.Dispatch<React.SetStateAction<VideoClip[]>>;
  deletedSegments: Set<number>;
  setDeletedSegments: React.Dispatch<React.SetStateAction<Set<number>>>;
  isConverting: boolean;
}) {
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Overlay drawer states
  const [textDrawerOpen, setTextDrawerOpen] = useState(false);
  const [stickerDrawerOpen, setStickerDrawerOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const { state: overlayState } = useOverlay();

  const activeClip = clips[activeClipIndex];

  const totalDuration = useMemo(
    () => clips.reduce((acc, clip) => acc + clip.duration, 0),
    [clips]
  );

  // Merged transcript from all clips
  const fullTranscript = useMemo(() => {
    return clips
      .map((clip) => clip.transcript || "")
      .filter(Boolean)
      .join("\n\n");
  }, [clips]);

  // All segments with global timestamps
  const allSegments = useMemo(() => {
    const segments: TranscriptSegment[] = [];
    let timeOffset = 0;

    clips.forEach((clip, clipIndex) => {
      if (clip.segments) {
        clip.segments.forEach((seg) => {
          segments.push({
            ...seg,
            start: seg.start + timeOffset,
            end: seg.end + timeOffset,
            clipIndex,
          });
        });
      }
      timeOffset += clip.duration;
    });

    return segments;
  }, [clips]);

  // Duration excluding deleted segments
  const activeDuration = useMemo(() => {
    if (deletedSegments.size === 0) return totalDuration;

    const deletedTime = allSegments
      .filter((_, i) => deletedSegments.has(i))
      .reduce((acc, seg) => acc + (seg.end - seg.start), 0);

    return totalDuration - deletedTime;
  }, [totalDuration, allSegments, deletedSegments]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const previousClipsDuration = clips
        .slice(0, activeClipIndex)
        .reduce((acc, clip) => acc + clip.duration, 0);
      const globalTime = previousClipsDuration + videoRef.current.currentTime;
      setCurrentTime(globalTime);

      // Skip deleted segments during playback
      if (isPlaying && deletedSegments.size > 0) {
        const currentSegmentIndex = allSegments.findIndex(
          (seg) => globalTime >= seg.start && globalTime < seg.end
        );

        if (currentSegmentIndex !== -1 && deletedSegments.has(currentSegmentIndex)) {
          // Find next non-deleted segment
          let nextSegmentIndex = currentSegmentIndex + 1;
          while (nextSegmentIndex < allSegments.length && deletedSegments.has(nextSegmentIndex)) {
            nextSegmentIndex++;
          }

          if (nextSegmentIndex < allSegments.length) {
            const nextSegment = allSegments[nextSegmentIndex];
            // Jump to next segment
            if (nextSegment.clipIndex !== activeClipIndex) {
              setActiveClipIndex(nextSegment.clipIndex);
            }
            const clipStartTime = clips
              .slice(0, nextSegment.clipIndex)
              .reduce((acc, clip) => acc + clip.duration, 0);
            videoRef.current.currentTime = nextSegment.start - clipStartTime;
          } else {
            // No more segments, end playback
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      }
    }
  }, [clips, activeClipIndex, isPlaying, deletedSegments, allSegments]);

  const handleVideoEnded = () => {
    if (activeClipIndex < clips.length - 1) {
      setActiveClipIndex(activeClipIndex + 1);
    } else {
      setIsPlaying(false);
      setActiveClipIndex(0);
    }
  };

  useEffect(() => {
    if (isPlaying && videoRef.current) {
      videoRef.current.play();
    }
  }, [activeClipIndex, isPlaying]);

  // Keyboard handler for Delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedSegmentIndex !== null) {
        // Prevent browser back navigation on Backspace
        e.preventDefault();
        setDeletedSegments((prev) => {
          const next = new Set(prev);
          if (next.has(selectedSegmentIndex)) {
            next.delete(selectedSegmentIndex);
          } else {
            next.add(selectedSegmentIndex);
          }
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSegmentIndex]);

  // Restore all deleted segments
  const handleRestoreAll = useCallback(() => {
    setDeletedSegments(new Set());
  }, []);

  // Handle video error (unsupported format)
  const handleVideoError = useCallback(() => {
    setVideoError("Video format not supported by browser. Transcription will still work.");
  }, []);

  // Reset video error when switching clips
  useEffect(() => {
    setVideoError(null);
  }, [activeClipIndex]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Transcribe all clips
  const handleTranscribe = useCallback(async () => {
    setIsTranscribing(true);
    setTranscribeProgress(0);

    const updatedClips = [...clips];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      setTranscribeProgress(((i) / clips.length) * 100);

      try {
        const formData = new FormData();
        formData.append("video", clip.file);

        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (response.ok) {
          updatedClips[i] = {
            ...updatedClips[i],
            transcript: data.transcript,
            segments: data.segments?.map((seg: TranscriptSegment) => ({
              ...seg,
              clipIndex: i,
            })),
          };
        } else {
          console.error(`Clip ${i + 1} error:`, data.error, data.details);
          alert(`Failed to transcribe clip ${i + 1}: ${data.details || data.error}`);
        }
      } catch (error) {
        console.error(`Failed to transcribe clip ${i + 1}:`, error);
        alert(`Failed to transcribe clip ${i + 1}: ${error}`);
      }

      setTranscribeProgress(((i + 1) / clips.length) * 100);
    }

    setClips(updatedClips);
    setIsTranscribing(false);
  }, [clips, setClips]);

  // Jump to segment when clicked and select it
  const handleSegmentClick = (segment: TranscriptSegment, index: number) => {
    setSelectedSegmentIndex(index);
    setActiveClipIndex(segment.clipIndex);
    if (videoRef.current) {
      const clipStartTime = clips
        .slice(0, segment.clipIndex)
        .reduce((acc, clip) => acc + clip.duration, 0);
      videoRef.current.currentTime = segment.start - clipStartTime;
    }
  };

  // Find active segment based on current time
  const activeSegmentIndex = useMemo(() => {
    return allSegments.findIndex(
      (seg) => currentTime >= seg.start && currentTime < seg.end
    );
  }, [allSegments, currentTime]);

  // Get filter CSS for preview
  const filterStyle = overlayState.filterId
    ? getFilterById(overlayState.filterId)?.filter
    : undefined;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 sm:gap-8 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Preview Panel - Fixed width on desktop */}
        <div className="w-full lg:w-[340px] flex-shrink-0">
          <p className="label mb-4">Preview</p>
          <div className="card-glow overflow-hidden">
            <div className="aspect-[9/16] bg-[#0A0A0A] relative">
              {activeClip && (
                <video
                  ref={videoRef}
                  src={activeClip.previewUrl || activeClip.url}
                  className="w-full h-full object-cover"
                  style={{ filter: filterStyle && filterStyle !== 'none' ? filterStyle : undefined }}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleVideoEnded}
                  onError={handleVideoError}
                  playsInline
                />
              )}
              {isConverting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center">
                  <div className="w-10 h-10 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-[#8E8E93] text-sm">Converting for preview...</p>
                </div>
              )}
              {!isConverting && videoError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center">
                  <svg className="w-12 h-12 text-[#636366] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-[#8E8E93] text-sm mb-1">Preview unavailable</p>
                  <p className="text-[#636366] text-xs">{videoError}</p>
                </div>
              )}
              <button
                onClick={handlePlayPause}
                disabled={!!videoError}
                className={`absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent transition-all duration-300 ${videoError ? "hidden" : "opacity-0 hover:opacity-100"}`}
              >
                <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 transition-transform hover:scale-105">
                  {isPlaying ? (
                    <svg
                      className="w-6 h-6 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6 text-white ml-1"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Overlay Toolbar */}
              {!isConverting && !videoError && (
                <OverlayToolbar
                  onOpenTextDrawer={() => setTextDrawerOpen(true)}
                  onOpenStickerDrawer={() => setStickerDrawerOpen(true)}
                  onOpenFilterDrawer={() => setFilterDrawerOpen(true)}
                />
              )}
            </div>
            <div className="p-4 text-center text-sm text-[#8E8E93] bg-[#111111]">
              {formatTime(currentTime)} / {formatTime(activeDuration)}
              {deletedSegments.size > 0 && (
                <span className="text-[#636366] ml-1">
                  ({formatTime(totalDuration - activeDuration)} removed)
                </span>
              )}
            </div>
          </div>

          {/* Active Overlays List */}
          <ActiveOverlayList />
        </div>

        {/* Transcript Panel - Takes remaining space */}
        <div className="flex-1 min-w-0 lg:min-w-[400px]">
          <div className="flex items-center justify-between mb-4 gap-4">
            <p className="label">Transcript</p>
            <div className="flex gap-3">
              {deletedSegments.size > 0 && (
                <button
                  onClick={handleRestoreAll}
                  className="btn-secondary text-xs py-2 px-4 whitespace-nowrap"
                >
                  Restore All ({deletedSegments.size})
                </button>
              )}
              {!fullTranscript && (
                <button
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className="btn-primary text-xs py-2.5 px-5 disabled:opacity-50 whitespace-nowrap"
                >
                  {isTranscribing
                    ? `Transcribing... ${Math.round(transcribeProgress)}%`
                    : "Generate Transcript"}
                </button>
              )}
            </div>
          </div>

          <div className="card p-5 h-[520px] overflow-y-auto">
            {isTranscribing ? (
              <div className="flex flex-col items-center justify-center h-full gap-5">
                <div className="w-14 h-14 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-white text-base mb-1">Transcribing...</p>
                  <p className="text-[#636366] text-sm">
                    Clip {Math.ceil((transcribeProgress / 100) * clips.length)} of {clips.length}
                  </p>
                </div>
              </div>
            ) : allSegments.length > 0 ? (
              <div className="space-y-1" ref={transcriptRef}>
                {allSegments.map((segment, i) => {
                  const isDeleted = deletedSegments.has(i);
                  const isSelected = selectedSegmentIndex === i;
                  const isActive = activeSegmentIndex === i;

                  return (
                    <button
                      key={i}
                      onClick={() => handleSegmentClick(segment, i)}
                      className={`block w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        isSelected
                          ? "ring-2 ring-[#4A8FE7] ring-offset-2 ring-offset-[#181818]"
                          : ""
                      } ${
                        isDeleted
                          ? "bg-red-950/30 text-[#636366]"
                          : isActive
                          ? "bg-[#4A8FE7]/15 text-white"
                          : "text-[#8E8E93] hover:bg-[#242430] hover:text-white"
                      }`}
                    >
                      <span className={`text-[11px] font-medium mr-3 ${isDeleted ? "text-[#45454F]" : "text-[#4A8FE7]"}`}>
                        {formatTime(segment.start)}
                      </span>
                      <span className={`${isDeleted ? "line-through opacity-60" : ""}`}>
                        {segment.text}
                      </span>
                      {isDeleted && (
                        <span className="ml-2 text-[10px] text-red-400/80 font-medium">(removed)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-16 h-16 rounded-full bg-[#181818] flex items-center justify-center mb-5">
                  <svg className="w-7 h-7 text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-white font-medium mb-2">No transcript yet</p>
                <p className="text-[#636366] text-sm leading-relaxed">
                  Click &quot;Generate Transcript&quot; to extract speech from your clips
                </p>
              </div>
            )}
          </div>
          <p className="text-[#45454F] text-xs mt-4 text-center">
            Click to select • Delete to remove • Removed segments are skipped during playback
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <p className="label mb-4">Timeline</p>
        <div className="card p-4 sm:p-5">
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
            {clips.map((clip, i) => (
              <button
                key={i}
                onClick={() => {
                  setActiveClipIndex(i);
                  setIsPlaying(false);
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                  }
                }}
                className={`flex-shrink-0 w-24 sm:w-28 h-16 sm:h-18 rounded-xl overflow-hidden relative transition-all duration-300 ${
                  activeClipIndex === i
                    ? "ring-2 ring-[#4A8FE7] ring-offset-2 ring-offset-[#181818] scale-[1.02]"
                    : "opacity-50 hover:opacity-90 hover:scale-[1.01]"
                }`}
              >
                <video src={clip.url} className="w-full h-full object-cover" muted />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-1.5 right-1.5 bg-black/70 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-white">
                  {formatTime(clip.duration)}
                </div>
                {clip.transcript && (
                  <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full bg-[#4A8FE7] shadow-lg shadow-[#4A8FE7]/30" />
                )}
              </button>
            ))}
          </div>
          <div className="mt-4 sm:mt-5 h-1.5 bg-[#181818] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4A8FE7] to-[#5F7BFD] rounded-full transition-all duration-150 progress-glow"
              style={{ width: `${(currentTime / totalDuration) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Overlay Drawers */}
      <TextOverlayDrawer
        isOpen={textDrawerOpen}
        onClose={() => setTextDrawerOpen(false)}
        totalDurationMs={totalDuration * 1000}
        currentTimeMs={currentTime * 1000}
      />
      <StickerDrawer
        isOpen={stickerDrawerOpen}
        onClose={() => setStickerDrawerOpen(false)}
        totalDurationMs={totalDuration * 1000}
        currentTimeMs={currentTime * 1000}
      />
      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
      />
    </div>
  );
}

function ExportStep({
  clips,
  segments,
  deletedSegmentIndices,
  onBack,
}: {
  clips: VideoClip[];
  segments: TranscriptSegment[];
  deletedSegmentIndices: number[];
  onBack: () => void;
}) {
  const { state: overlayState } = useOverlay();
  const [selectedTemplate, setSelectedTemplate] = useState<CaptionTemplate>(captionTemplates[0]);
  const [renderState, setRenderState] = useState<"idle" | "rendering" | "done" | "error">("idle");
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll for render progress
  useEffect(() => {
    if (renderState !== "rendering" || !renderId) return;

    const pollProgress = async () => {
      try {
        const response = await fetch("/api/render/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ renderId }),
        });

        const data = await response.json();

        if (data.type === "done") {
          setRenderState("done");
          setRenderProgress(100);
          setDownloadUrl(data.url);
        } else if (data.type === "error") {
          setRenderState("error");
          setErrorMessage(data.message);
        } else if (data.type === "progress") {
          setRenderProgress(data.progress);
        }
      } catch (error) {
        console.error("Error polling progress:", error);
      }
    };

    const interval = setInterval(pollProgress, 1000);
    return () => clearInterval(interval);
  }, [renderState, renderId]);

  const handleExport = async () => {
    setRenderState("rendering");
    setRenderProgress(0);
    setErrorMessage(null);

    try {
      // Convert clips to base64 for sending to API
      const clipData = await Promise.all(
        clips.map(async (clip) => {
          const arrayBuffer = await clip.file.arrayBuffer();
          // Browser-compatible base64 encoding
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          return {
            data: base64,
            filename: clip.file.name,
            duration: clip.duration,
          };
        })
      );

      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clips: clipData,
          segments,
          deletedSegmentIndices,
          captionTemplateId: selectedTemplate.id,
          width: 1080,
          height: 1920,
          fps: 30,
          // Include overlay state
          filterId: overlayState.filterId,
          textOverlays: overlayState.textOverlays,
          stickers: overlayState.stickers,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRenderId(data.renderId);
      } else {
        setRenderState("error");
        setErrorMessage(data.error || "Failed to start render");
      }
    } catch (error) {
      setRenderState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to start render");
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.location.href = `/api/render/download/${renderId}`;
    }
  };

  // Overlay summary for export
  const overlayCount = overlayState.textOverlays.length + overlayState.stickers.length +
    (overlayState.filterId && overlayState.filterId !== 'none' ? 1 : 0);

  // Done state
  if (renderState === "done") {
    return (
      <div className="text-center px-4 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-3xl font-semibold mb-3 tracking-tight">Export complete</h2>
        <p className="text-[#8E8E93] mb-8 text-base">Your video is ready to download</p>
        <button onClick={handleDownload} className="btn-primary px-8 py-3">
          Download Video
        </button>
      </div>
    );
  }

  // Error state
  if (renderState === "error") {
    return (
      <div className="text-center px-4 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-red-400"
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
        </div>
        <h2 className="text-3xl font-semibold mb-3 tracking-tight">Export failed</h2>
        <p className="text-[#8E8E93] mb-8 text-base">{errorMessage || "An error occurred"}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={onBack} className="btn-secondary">
            Back to edit
          </button>
          <button onClick={() => setRenderState("idle")} className="btn-primary">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Rendering state
  if (renderState === "rendering") {
    return (
      <div className="text-center px-4 max-w-md mx-auto animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-[#4A8FE7]/15 flex items-center justify-center mx-auto mb-6">
          <div className="w-10 h-10 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-3xl font-semibold mb-3 tracking-tight">Rendering video</h2>
        <p className="text-[#8E8E93] mb-8 text-base">
          {renderProgress < 15
            ? "Preparing composition..."
            : `Rendering frames (${Math.round(renderProgress)}%)`}
        </p>
        <div className="w-full h-2 bg-[#181818] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-[#4A8FE7] to-[#5F7BFD] rounded-full transition-all duration-300 progress-glow"
            style={{ width: `${renderProgress}%` }}
          />
        </div>
        <p className="text-[#45454F] text-sm">This may take a few minutes</p>
      </div>
    );
  }

  // Idle state - show template picker
  return (
    <div className="text-center px-4 max-w-2xl mx-auto animate-fade-in">
      <p className="label mb-5">Export</p>
      <h2 className="text-3xl font-semibold mb-3 tracking-tight">Choose caption style</h2>
      <p className="text-[#8E8E93] mb-10 text-base">
        Select a style for your burned-in captions
      </p>

      {/* Caption Template Picker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {captionTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => setSelectedTemplate(template)}
            className={`card p-4 text-left transition-all duration-300 ${
              selectedTemplate.id === template.id
                ? "ring-2 ring-[#4A8FE7] ring-offset-2 ring-offset-[#0A0A0A] scale-[1.02]"
                : "hover:bg-[#242430] hover:scale-[1.01]"
            }`}
          >
            <div
              className="h-14 rounded-xl mb-3 flex items-center justify-center text-base font-semibold"
              style={{
                backgroundColor: template.styles.highlightStyle?.backgroundColor || "#3B82F6",
                color: template.styles.highlightStyle?.color || "#FFF",
                fontFamily: template.styles.fontFamily,
                textShadow: template.styles.textShadow,
              }}
            >
              Aa
            </div>
            <p className="font-medium text-sm mb-0.5">{template.name}</p>
            <p className="text-[#636366] text-xs">{template.preview}</p>
          </button>
        ))}
      </div>

      {/* Export summary */}
      <div className="card p-5 mb-10 text-left">
        <p className="label mb-3">Summary</p>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-[#636366]">Clips:</span>{" "}
            <span className="text-white font-medium">{clips.length}</span>
          </div>
          <div>
            <span className="text-[#636366]">Segments:</span>{" "}
            <span className="text-white font-medium">
              {segments.length - deletedSegmentIndices.length} active
            </span>
          </div>
          <div>
            <span className="text-[#636366]">Removed:</span>{" "}
            <span className="text-white font-medium">{deletedSegmentIndices.length}</span>
          </div>
          <div>
            <span className="text-[#636366]">Style:</span>{" "}
            <span className="text-white font-medium">{selectedTemplate.name}</span>
          </div>
          {overlayCount > 0 && (
            <div>
              <span className="text-[#636366]">Overlays:</span>{" "}
              <span className="text-white font-medium">{overlayCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button onClick={onBack} className="btn-secondary">
          Back to edit
        </button>
        <button onClick={handleExport} className="btn-primary px-8">
          Export video
        </button>
      </div>
    </div>
  );
}
