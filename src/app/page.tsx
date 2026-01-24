"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { captionTemplates, CaptionTemplate } from "@/lib/caption-templates";
import {
  OverlayProvider,
  useOverlay,
  ActiveOverlayList,
} from "@/components/overlays";
import { getFilterById } from "@/lib/templates/filter-presets";
import { getTextStyleById } from "@/lib/templates/text-templates";
import { TextOverlay, StickerOverlay } from "@/types/overlays";
import { generateAutoTransitions } from "@/lib/transitions/auto-transitions";
import { Sidebar } from "@/components/Sidebar";
import { useUser } from "@/lib/supabase/hooks";
import { Timeline, TimelineTrack, TrackItemType } from "@/components/timeline";
import { generateScriptTrack } from "@/components/timeline/utils/generate-script-track";
import { ScriptEditor } from "@/components/script-editor";
import { TranscriptWord } from "@/lib/types/composition";
import { MediaLibraryPanel } from "@/components/media-library";
import { MediaLibraryProvider } from "@/contexts/MediaLibraryContext";
import { MediaFile } from "@/types/media";
import { CaptionPreview } from "@/components/CaptionPreview";
import { ProjectsProvider, useProjects } from "@/contexts/ProjectsContext";
import { ProjectFeed } from "@/components/projects";
import { ProjectData } from "@/types/project";
import { ResizableBottomPanel } from "@/components/ResizableBottomPanel";

type AppView = "feed" | "editor";
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
  duration: number;
  transcript?: string;
  segments?: TranscriptSegment[];
  words?: Omit<TranscriptWord, 'clipIndex'>[];  // Words from API (without clipIndex)
}

export default function Home() {
  return (
    <ProjectsProvider>
      <OverlayProvider>
        <HomeContent />
      </OverlayProvider>
    </ProjectsProvider>
  );
}

function HomeContent() {
  // View switching state
  const [view, setView] = useState<AppView>("feed");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Editor state
  const [step, setStep] = useState<EditorStep>("upload");
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [deletedSegments, setDeletedSegments] = useState<Set<number>>(new Set());
  const [deletedWordIds, setDeletedWordIds] = useState<Set<string>>(new Set());
  const [deletedPauseIds, setDeletedPauseIds] = useState<Set<string>>(new Set());
  const [showUploads, setShowUploads] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isEditingName, setIsEditingName] = useState(false);

  // Save/Load state
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const savedClipNames = useRef<Set<string>>(new Set());

  const { createProject, updateProject, projects } = useProjects();
  const { state: overlayState, loadState: loadOverlayState, resetOverlays } = useOverlay();

  // Track changes
  useEffect(() => {
    if (view === "editor" && (clips.length > 0 || deletedWordIds.size > 0 || deletedPauseIds.size > 0)) {
      setHasUnsavedChanges(true);
    }
  }, [clips.length, deletedWordIds.size, deletedPauseIds.size, view]);

  // Handle creating a new project
  const handleCreateProject = useCallback(async () => {
    const project = await createProject(`Untitled Project`);
    if (project) {
      setCurrentProjectId(project.id);
      setProjectName(project.name);
      setStep("upload");
      setClips([]);
      setDeletedSegments(new Set());
      setDeletedWordIds(new Set());
      setDeletedPauseIds(new Set());
      setHasUnsavedChanges(false);
      savedClipNames.current = new Set();
      resetOverlays();
      setView("editor");
    }
  }, [createProject, resetOverlays]);

  // Handle selecting a project from feed
  const handleSelectProject = useCallback(async (projectId: string) => {
    setCurrentProjectId(projectId);
    setIsLoadingProject(true);
    setStep("upload");
    setClips([]);
    setDeletedSegments(new Set());
    setDeletedWordIds(new Set());
    setDeletedPauseIds(new Set());
    setHasUnsavedChanges(false);
    savedClipNames.current = new Set();
    resetOverlays();
    setView("editor");

    try {
      // Load project data and clips in parallel
      const [projectResponse, clipsResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/clips`),
      ]);

      const projectJson = await projectResponse.json();
      const clipsJson = await clipsResponse.json();

      if (projectResponse.ok && projectJson.project) {
        setProjectName(projectJson.project.name || "Untitled Project");

        if (projectJson.project.data) {
          const projectData = projectJson.project.data as ProjectData;

          // Restore deleted word IDs
          if (projectData.deletedWordIds) {
            setDeletedWordIds(new Set(projectData.deletedWordIds));
          }

          // Restore deleted pause IDs
          if (projectData.deletedPauseIds) {
            setDeletedPauseIds(new Set(projectData.deletedPauseIds));
          }

          // Restore overlay state
          if (projectData.overlays) {
            loadOverlayState({
              textOverlays: projectData.overlays.textOverlays || [],
              stickers: projectData.overlays.stickers || [],
              filterId: projectData.overlays.filterId || null,
              captionPositionY: projectData.overlays.captionPositionY ?? 75,
              audioSettings: projectData.overlays.audioSettings,
              clipTransitions: projectData.overlays.clipTransitions || [],
              showCaptionPreview: projectData.overlays.showCaptionPreview ?? true,
            });
          }
        }
      }

      // Load clips from storage
      if (clipsResponse.ok && clipsJson.clips && clipsJson.clips.length > 0) {
        const loadedClips: VideoClip[] = await Promise.all(
          clipsJson.clips.map(async (clip: {
            id: string;
            filename: string;
            signedUrl: string;
            duration: number;
            orderIndex: number;
            transcript?: string;
            segments?: { text: string; start: number; end: number }[];
            words?: { id: string; word: string; start: number; end: number }[];
          }) => {
            // Fetch the video blob from signed URL
            const blobResponse = await fetch(clip.signedUrl);
            const blob = await blobResponse.blob();
            const file = new File([blob], clip.filename, { type: blob.type });
            const url = URL.createObjectURL(blob);

            return {
              file,
              url,
              duration: clip.duration,
              transcript: clip.transcript,
              segments: clip.segments?.map((seg, idx) => ({
                ...seg,
                clipIndex: clip.orderIndex,
              })),
              words: clip.words,
            };
          })
        );

        setClips(loadedClips);
        // Mark loaded clips as already saved (so they don't get re-uploaded)
        loadedClips.forEach(clip => savedClipNames.current.add(clip.file.name));
        setStep("edit");
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setIsLoadingProject(false);
    }
  }, [loadOverlayState, resetOverlays]);

  // Save project data (optimistic + background clip upload)
  const saveProject = useCallback(async () => {
    if (!currentProjectId) return;

    // Optimistic: mark as saved immediately
    setHasUnsavedChanges(false);
    setIsSaving(true);

    try {
      // Build project metadata (fast operation)
      const projectData: ProjectData = {
        overlays: {
          textOverlays: overlayState.textOverlays,
          stickers: overlayState.stickers,
          filterId: overlayState.filterId,
          captionPositionY: overlayState.captionPositionY,
          audioSettings: overlayState.audioSettings,
          clipTransitions: overlayState.clipTransitions,
          showCaptionPreview: overlayState.showCaptionPreview,
        },
        deletedWordIds: Array.from(deletedWordIds),
        deletedPauseIds: Array.from(deletedPauseIds),
        clipCount: clips.length,
      };

      // Save metadata first (fast) - don't await, let it run in parallel
      const metadataPromise = fetch(`/api/projects/${currentProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipCount: clips.length,
          data: projectData,
        }),
      });

      // Find clips that haven't been saved yet (skip re-uploads)
      const unsavedClips = clips.filter(clip => !savedClipNames.current.has(clip.file.name));

      // Only upload new clips
      let clipsPromise: Promise<Response> | null = null;
      if (unsavedClips.length > 0) {
        const clipData = await Promise.all(
          unsavedClips.map(async (clip) => {
            const index = clips.indexOf(clip);
            const arrayBuffer = await clip.file.arrayBuffer();
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
              orderIndex: index,
              transcript: clip.transcript,
              segments: clip.segments?.map(seg => ({
                text: seg.text,
                start: seg.start,
                end: seg.end,
              })),
              words: clip.words,
            };
          })
        );

        clipsPromise = fetch(`/api/projects/${currentProjectId}/clips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clips: clipData }),
        });
      }

      // Wait for both to complete
      await metadataPromise;
      if (clipsPromise) {
        const response = await clipsPromise;
        if (response.ok) {
          // Mark clips as saved to avoid re-uploading
          unsavedClips.forEach(clip => savedClipNames.current.add(clip.file.name));
        }
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      // Revert optimistic update on error
      setHasUnsavedChanges(true);
    } finally {
      setIsSaving(false);
    }
  }, [currentProjectId, clips, deletedWordIds, deletedPauseIds, overlayState]);

  // Handle going back to feed - show dialog if unsaved changes
  const handleBackToFeed = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowExitDialog(true);
    } else {
      setView("feed");
      setCurrentProjectId(null);
    }
  }, [hasUnsavedChanges]);

  // Save and exit
  const handleSaveAndExit = useCallback(async () => {
    await saveProject();
    setShowExitDialog(false);
    setView("feed");
    setCurrentProjectId(null);
  }, [saveProject]);

  // Discard and exit
  const handleDiscardAndExit = useCallback(() => {
    setShowExitDialog(false);
    setHasUnsavedChanges(false);
    setView("feed");
    setCurrentProjectId(null);
  }, []);

  // Save project name
  const handleSaveProjectName = useCallback(async (newName: string) => {
    const trimmedName = newName.trim() || "Untitled Project";
    setProjectName(trimmedName);
    setIsEditingName(false);

    if (currentProjectId) {
      try {
        await fetch(`/api/projects/${currentProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedName }),
        });
      } catch (error) {
        console.error('Failed to save project name:', error);
      }
    }
  }, [currentProjectId]);

  // Handle adding media from library to timeline
  const handleAddMediaToTimeline = useCallback(async (mediaFile: MediaFile) => {
    if (mediaFile.type !== 'video') {
      alert('Only videos can be added to the timeline');
      return;
    }

    try {
      // Fetch the video file from the URL
      const response = await fetch(mediaFile.url);
      const blob = await response.blob();
      const file = new File([blob], mediaFile.name, { type: blob.type });

      // Get video duration
      const url = URL.createObjectURL(blob);
      const duration = await getVideoDuration(url);

      // Add to clips
      const newClip: VideoClip = {
        file,
        url,
        duration,
      };

      setClips(prev => [...prev, newClip]);
      setShowUploads(false);

      // If we're on upload step, move to edit
      if (step === 'upload') {
        setStep('edit');
      }
    } catch (error) {
      console.error('Failed to add media to timeline:', error);
      alert('Failed to add video to timeline');
    }
  }, [step]);

  useEffect(() => {
    return () => {
      clips.forEach((clip) => URL.revokeObjectURL(clip.url));
    };
  }, [clips]);

  const handleFilesSelected = async (files: File[]) => {
    setStep("edit");

    const videoClips: VideoClip[] = await Promise.all(
      files.map(async (file) => {
        const url = URL.createObjectURL(file);
        const duration = await getVideoDuration(url);
        return { file, url, duration };
      })
    );

    setClips(videoClips);
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

  // All words with global timestamps
  const allWords = useMemo(() => {
    const words: TranscriptWord[] = [];
    let timeOffset = 0;

    clips.forEach((clip, clipIndex) => {
      if (clip.words) {
        clip.words.forEach((word) => {
          words.push({
            ...word,
            id: `clip-${clipIndex}-${word.id}`,  // Make ID globally unique across clips
            start: word.start + timeOffset,
            end: word.end + timeOffset,
            clipIndex,
          });
        });
      }
      timeOffset += clip.duration;
    });

    return words;
  }, [clips]);

  // Feed view
  if (view === "feed") {
    return (
      <MediaLibraryProvider>
        <Sidebar
          onOpenUploads={() => setShowUploads(true)}
          onNavigateHome={() => setView("feed")}
          onCreateProject={handleCreateProject}
        />
        <MediaLibraryPanel
          isOpen={showUploads}
          onClose={() => setShowUploads(false)}
          onSelectMedia={handleAddMediaToTimeline}
        />
        <div className="min-h-screen flex flex-col bg-[var(--background)] md:pl-[72px] pb-24 md:pb-0">
          <header className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Snip
              </h1>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">
            <ProjectFeed
              onSelectProject={handleSelectProject}
              onCreateProject={handleCreateProject}
            />
          </main>
        </div>
      </MediaLibraryProvider>
    );
  }

  // Editor view
  return (
    <MediaLibraryProvider>
      <Sidebar
        onOpenUploads={() => setShowUploads(true)}
        onNavigateHome={handleBackToFeed}
        onCreateProject={handleCreateProject}
        clipCount={clips.length}
      />
      <MediaLibraryPanel
        isOpen={showUploads}
        onClose={() => setShowUploads(false)}
        onSelectMedia={handleAddMediaToTimeline}
      />

      {/* Loading project overlay */}
      {isLoadingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-6">
            {/* Multi-ring spinner with glow */}
            <div className="relative w-20 h-20">
              {/* Outer glow */}
              <div className="absolute inset-0 rounded-full bg-[#4A8FE7]/20 blur-xl animate-pulse" />
              {/* Outer ring - slow */}
              <div className="absolute inset-0 border-2 border-[#4A8FE7]/30 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
              {/* Middle ring - medium */}
              <div className="absolute inset-2 border-2 border-[#4A8FE7]/50 border-t-[#4A8FE7] rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
              {/* Inner ring - fast */}
              <div className="absolute inset-4 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
              {/* Center icon - scissors */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#4A8FE7] animate-pulse" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863l2.077-1.199m0-3.328a4.323 4.323 0 012.068-1.379l5.325-1.628a4.5 4.5 0 012.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.331 4.331 0 0010.607 12m3.736 0l7.794 4.5-.802.215a4.5 4.5 0 01-2.48-.043l-5.326-1.629a4.324 4.324 0 01-2.068-1.379M14.343 12l-2.882 1.664" />
                </svg>
              </div>
            </div>
            {/* Text with subtle animation */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-white font-medium text-lg">Loading project</p>
              <p className="text-[#8E8E93] text-sm">Fetching your clips...</p>
            </div>
          </div>
        </div>
      )}

      {/* Exit confirmation dialog */}
      {showExitDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
              <h3 className="text-lg font-semibold text-white mb-2">Save changes?</h3>
              <p className="text-[#8E8E93] text-sm mb-6">
                You have unsaved changes to this project. Would you like to save them before leaving?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSaveAndExit}
                  disabled={isSaving}
                  className="btn-primary w-full py-2.5 disabled:opacity-50"
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save & Exit"
                  )}
                </button>
                <button
                  onClick={handleDiscardAndExit}
                  className="w-full py-2.5 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                >
                  Discard Changes
                </button>
                <button
                  onClick={() => setShowExitDialog(false)}
                  className="w-full py-2.5 text-[#8E8E93] hover:bg-[#2A2A2A] rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="min-h-screen flex flex-col bg-[var(--background)] md:pl-[72px] pb-24 md:pb-0">
        <header className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={handleBackToFeed}
              className="p-2 -ml-2 rounded-lg text-[#8E8E93] hover:text-white hover:bg-[#1C1C1E] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {/* Editable project name */}
            {isEditingName ? (
              <input
                type="text"
                defaultValue={projectName}
                autoFocus
                onBlur={(e) => handleSaveProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveProjectName(e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    setIsEditingName(false);
                  }
                }}
                className="text-xl font-semibold tracking-tight text-white bg-transparent border-b-2 border-[#4A8FE7] outline-none px-1 max-w-[200px]"
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-xl font-semibold tracking-tight text-white hover:text-[#4A8FE7] transition-colors flex items-center gap-2 group"
              >
                {projectName}
                <svg className="w-4 h-4 text-[#636366] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          {step === "edit" && (
            <div className="flex items-center gap-3">
              <button
                onClick={saveProject}
                disabled={isSaving || !hasUnsavedChanges}
                className="btn-secondary text-sm px-4 py-2.5 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    {hasUnsavedChanges ? "Save" : "Saved"}
                  </>
                )}
              </button>
              <button
                onClick={() => setStep("export")}
                className="btn-primary text-sm px-5 py-2.5"
              >
                Export
              </button>
            </div>
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
              deletedWordIds={deletedWordIds}
              setDeletedWordIds={setDeletedWordIds}
              deletedPauseIds={deletedPauseIds}
              setDeletedPauseIds={setDeletedPauseIds}
              allWords={allWords}
            />
          )}
          {step === "export" && (
            <ExportStep
              clips={clips}
              segments={allSegments}
              deletedSegmentIndices={Array.from(deletedSegments)}
              words={allWords}
              deletedWordIds={Array.from(deletedWordIds)}
              deletedPauseIds={Array.from(deletedPauseIds)}
              onBack={() => setStep("edit")}
            />
          )}
        </main>
      </div>
    </MediaLibraryProvider>
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
  deletedWordIds,
  setDeletedWordIds,
  deletedPauseIds,
  setDeletedPauseIds,
  allWords,
}: {
  clips: VideoClip[];
  setClips: React.Dispatch<React.SetStateAction<VideoClip[]>>;
  deletedSegments: Set<number>;
  setDeletedSegments: React.Dispatch<React.SetStateAction<Set<number>>>;
  deletedWordIds: Set<string>;
  setDeletedWordIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  deletedPauseIds: Set<string>;
  setDeletedPauseIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  allWords: TranscriptWord[];
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

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'video' | 'transcript'>('video');
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Handle swipe gestures for mobile tabs
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;

    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0 && mobileTab === 'video') {
        // Swiped left - go to transcript
        setMobileTab('transcript');
      } else if (distance < 0 && mobileTab === 'transcript') {
        // Swiped right - go to video
        setMobileTab('video');
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Timeline selection state
  const [selectedTimelineItems, setSelectedTimelineItems] = useState<string[]>([]);

  const { state: overlayState, updateTextOverlay, updateSticker, removeTextOverlay, removeSticker, setCaptionPosition, setTransitions } = useOverlay();

  const activeClip = clips[activeClipIndex];

  const totalDuration = useMemo(
    () => clips.reduce((acc, clip) => acc + clip.duration, 0),
    [clips]
  );

  // Auto-apply transitions when multiple clips are loaded
  useEffect(() => {
    if (clips.length >= 2 && overlayState.clipTransitions.length === 0) {
      const clipInfos = clips.map((clip, i) => ({
        duration: clip.duration,
        index: i,
      }));
      const autoTransitions = generateAutoTransitions(clipInfos);
      setTransitions(autoTransitions);
    }
  }, [clips.length]); // Only run when clip count changes

  // Spacebar to toggle play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if spacebar and not typing in an input/textarea
      if (e.code === 'Space' &&
          !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        if (videoRef.current) {
          if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
          } else {
            videoRef.current.play().catch((err) => {
              if (err.name !== 'AbortError') console.error('Video play error:', err);
            });
            setIsPlaying(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

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

  // Convert overlays to timeline tracks
  const timelineTracks: TimelineTrack[] = useMemo(() => {
    // Video track
    const videoTrack: TimelineTrack = {
      id: 'video-track',
      name: 'Video',
      items: clips.map((clip, i) => {
        const clipStartTime = clips.slice(0, i).reduce((acc, c) => acc + c.duration, 0);
        return {
          id: `clip-${i}`,
          trackId: 'video-track',
          start: clipStartTime,
          end: clipStartTime + clip.duration,
          type: TrackItemType.VIDEO,
          label: clip.file.name.slice(0, 15),
          data: { clipIndex: i, url: clip.url },
        };
      }),
    };

    // Script track (words from transcript)
    const scriptTrack = allWords.length > 0
      ? generateScriptTrack({
          words: allWords,
          deletedWordIds,
          deletedPauseIds,
        })
      : { id: 'script-track', name: 'Script', items: [] };

    // Text track
    const textTrack: TimelineTrack = {
      id: 'text-track',
      name: 'Text',
      items: overlayState.textOverlays.map((overlay) => ({
        id: overlay.id,
        trackId: 'text-track',
        start: overlay.startMs / 1000,
        end: (overlay.startMs + overlay.durationMs) / 1000,
        type: TrackItemType.TEXT,
        label: overlay.content.slice(0, 15) || 'Text',
        data: overlay,
      })),
    };

    // Sticker track
    const stickerTrack: TimelineTrack = {
      id: 'sticker-track',
      name: 'Stickers',
      items: overlayState.stickers.map((sticker) => ({
        id: sticker.id,
        trackId: 'sticker-track',
        start: sticker.startMs / 1000,
        end: (sticker.startMs + sticker.durationMs) / 1000,
        type: TrackItemType.STICKER,
        label: sticker.stickerId,
        data: sticker,
      })),
    };

    return [videoTrack, scriptTrack, textTrack, stickerTrack];
  }, [clips, allWords, deletedWordIds, deletedPauseIds, overlayState.textOverlays, overlayState.stickers]);

  // Handle timeline item move
  const handleTimelineItemMove = useCallback((itemId: string, newStart: number, newEnd: number, trackId: string) => {
    if (trackId === 'text-track') {
      updateTextOverlay(itemId, {
        startMs: newStart * 1000,
        durationMs: (newEnd - newStart) * 1000,
      });
    } else if (trackId === 'sticker-track') {
      updateSticker(itemId, {
        startMs: newStart * 1000,
        durationMs: (newEnd - newStart) * 1000,
      });
    }
    // Video clips are not moveable (yet)
  }, [updateTextOverlay, updateSticker]);

  // Handle timeline item resize
  const handleTimelineItemResize = useCallback((itemId: string, newStart: number, newEnd: number) => {
    // Find the track containing this item
    const textItem = overlayState.textOverlays.find(o => o.id === itemId);
    if (textItem) {
      updateTextOverlay(itemId, {
        startMs: newStart * 1000,
        durationMs: (newEnd - newStart) * 1000,
      });
      return;
    }

    const stickerItem = overlayState.stickers.find(s => s.id === itemId);
    if (stickerItem) {
      updateSticker(itemId, {
        startMs: newStart * 1000,
        durationMs: (newEnd - newStart) * 1000,
      });
    }
  }, [overlayState.textOverlays, overlayState.stickers, updateTextOverlay, updateSticker]);

  // Handle timeline item delete
  const handleTimelineItemDelete = useCallback((itemIds: string[]) => {
    // Check for pause deletions (IDs start with "pause-after-")
    const pauseIds = itemIds.filter(id => id.startsWith('pause-after-'));
    if (pauseIds.length > 0) {
      setDeletedPauseIds(prev => {
        const next = new Set(prev);
        pauseIds.forEach(id => {
          // Toggle deletion state
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        });
        return next;
      });
    }

    // Check for script word deletions
    const wordIds = itemIds.filter(id => allWords.some(w => w.id === id));
    if (wordIds.length > 0) {
      setDeletedWordIds(prev => {
        const next = new Set(prev);
        wordIds.forEach(id => {
          // Toggle deletion state
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        });
        return next;
      });
    }

    // Handle overlay deletions
    itemIds.forEach(itemId => {
      const textItem = overlayState.textOverlays.find(o => o.id === itemId);
      if (textItem) {
        removeTextOverlay(itemId);
        return;
      }

      const stickerItem = overlayState.stickers.find(s => s.id === itemId);
      if (stickerItem) {
        removeSticker(itemId);
      }
    });
    setSelectedTimelineItems([]);
  }, [allWords, overlayState.textOverlays, overlayState.stickers, removeTextOverlay, removeSticker, setDeletedWordIds, setDeletedPauseIds]);

  // Handle timeline frame change (seek)
  const handleTimelineFrameChange = useCallback((frame: number) => {
    const newTime = frame / 30; // fps = 30

    // Find which clip this time falls into
    let accumulatedTime = 0;
    for (let i = 0; i < clips.length; i++) {
      if (newTime < accumulatedTime + clips[i].duration) {
        setActiveClipIndex(i);
        if (videoRef.current) {
          videoRef.current.currentTime = newTime - accumulatedTime;
        }
        return;
      }
      accumulatedTime += clips[i].duration;
    }
  }, [clips]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch((e) => {
          if (e.name !== 'AbortError') console.error('Video play error:', e);
        });
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

      // Skip deleted pauses during playback (jump cuts)
      if (isPlaying && deletedPauseIds.size > 0 && allWords.length > 0) {
        // Check if we're in a deleted pause
        const pauseThreshold = 0.3; // Same threshold as generate-script-track
        for (let i = 0; i < allWords.length - 1; i++) {
          const word = allWords[i];
          const nextWord = allWords[i + 1];
          const gap = nextWord.start - word.end;

          if (gap >= pauseThreshold) {
            const pauseId = `pause-after-${word.id}`;
            // Check if current time is within this pause and it's deleted
            if (deletedPauseIds.has(pauseId) && globalTime >= word.end && globalTime < nextWord.start) {
              // Jump to the next word (end of pause)
              if (nextWord.clipIndex !== activeClipIndex) {
                setActiveClipIndex(nextWord.clipIndex);
              }
              const clipStartTime = clips
                .slice(0, nextWord.clipIndex)
                .reduce((acc, clip) => acc + clip.duration, 0);
              videoRef.current.currentTime = nextWord.start - clipStartTime;
              return; // Exit early to avoid duplicate processing
            }
          }
        }
      }

      // Skip deleted words during playback (word-level granularity)
      if (isPlaying && deletedWordIds.size > 0 && allWords.length > 0) {
        const currentWord = allWords.find(
          (w) => globalTime >= w.start && globalTime < w.end
        );

        if (currentWord && deletedWordIds.has(currentWord.id)) {
          // Find next non-deleted word
          const currentWordIndex = allWords.indexOf(currentWord);
          let nextWord: TranscriptWord | undefined;

          for (let i = currentWordIndex + 1; i < allWords.length; i++) {
            if (!deletedWordIds.has(allWords[i].id)) {
              nextWord = allWords[i];
              break;
            }
          }

          if (nextWord) {
            // Jump to next non-deleted word
            if (nextWord.clipIndex !== activeClipIndex) {
              setActiveClipIndex(nextWord.clipIndex);
            }
            const clipStartTime = clips
              .slice(0, nextWord.clipIndex)
              .reduce((acc, clip) => acc + clip.duration, 0);
            videoRef.current.currentTime = nextWord.start - clipStartTime;
          } else {
            // No more words, end playback
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      }
      // Fallback: Skip deleted segments during playback (if no words available)
      else if (isPlaying && deletedSegments.size > 0 && allWords.length === 0) {
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
  }, [clips, activeClipIndex, isPlaying, deletedSegments, allSegments, deletedWordIds, deletedPauseIds, allWords]);

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
      videoRef.current.play().catch((e) => {
        // Ignore AbortError - happens when play() is interrupted by pause()
        if (e.name !== 'AbortError') {
          console.error('Video play error:', e);
        }
      });
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

  // Restore all deleted segments and words
  const handleRestoreAll = useCallback(() => {
    setDeletedSegments(new Set());
    setDeletedWordIds(new Set());
    setDeletedPauseIds(new Set());
  }, [setDeletedWordIds, setDeletedPauseIds]);

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
    const { audioSettings } = overlayState;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      setTranscribeProgress(((i) / clips.length) * 100);

      try {
        const formData = new FormData();
        formData.append("video", clip.file);

        // Add audio enhancement settings
        if (audioSettings.enhanceAudio) {
          formData.append("enhanceAudio", "true");
          formData.append("noiseReduction", String(audioSettings.noiseReduction));
          formData.append("noiseReductionStrength", audioSettings.noiseReductionStrength);
          formData.append("loudnessNormalization", String(audioSettings.loudnessNormalization));
        }

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
            words: data.words,  // Word-level timestamps for script-driven editing
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
  }, [clips, setClips, overlayState.audioSettings]);

  // Auto-transcribe clips that don't have transcripts yet
  useEffect(() => {
    const hasUntranscribedClips = clips.some(clip => !clip.transcript && !clip.words);
    if (clips.length > 0 && hasUntranscribedClips && !isTranscribing) {
      handleTranscribe();
    }
  }, [clips.length]); // Only trigger when clip count changes, not on every clips update

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

  // Jump to word when clicked (for ScriptEditor)
  const handleWordClick = useCallback((word: TranscriptWord) => {
    setActiveClipIndex(word.clipIndex);
    if (videoRef.current) {
      const clipStartTime = clips
        .slice(0, word.clipIndex)
        .reduce((acc, clip) => acc + clip.duration, 0);
      videoRef.current.currentTime = word.start - clipStartTime;
    }
  }, [clips]);

  // Handle timeline item select (for seeking on script items)
  const handleTimelineItemSelect = useCallback((itemId: string) => {
    // Check if it's a script word - if so, seek to it
    const word = allWords.find(w => w.id === itemId);
    if (word) {
      handleWordClick(word);
    }
  }, [allWords, handleWordClick]);

  // Handle deleted words change from ScriptEditor
  const handleDeletedWordsChange = useCallback((newDeletedWordIds: Set<string>) => {
    setDeletedWordIds(newDeletedWordIds);
  }, [setDeletedWordIds]);

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
    <>
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 sm:gap-8 animate-fade-in-up pb-[220px]">
      {/* Mobile Tab Header */}
      <div className="lg:hidden flex items-center justify-center gap-1 bg-[#1C1C1E] p-1 rounded-xl mx-4">
        <button
          onClick={() => setMobileTab('video')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            mobileTab === 'video'
              ? 'bg-[#4A8FE7] text-white'
              : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          Video
        </button>
        <button
          onClick={() => setMobileTab('transcript')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            mobileTab === 'transcript'
              ? 'bg-[#4A8FE7] text-white'
              : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          Transcript
        </button>
      </div>

      {/* Mobile Swipe Indicator */}
      <div className="lg:hidden flex justify-center gap-2 pb-2">
        <div className={`w-2 h-2 rounded-full transition-colors ${mobileTab === 'video' ? 'bg-[#4A8FE7]' : 'bg-[#3A3A3C]'}`} />
        <div className={`w-2 h-2 rounded-full transition-colors ${mobileTab === 'transcript' ? 'bg-[#4A8FE7]' : 'bg-[#3A3A3C]'}`} />
      </div>

      {/* Mobile Swipeable Content */}
      <div
        className="lg:hidden relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: mobileTab === 'video' ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          {/* Mobile Video Tab */}
          <div className="w-full flex-shrink-0 px-4">
            <MobileVideoPanel
              activeClip={clips[activeClipIndex]}
              videoRef={videoRef}
              filterStyle={overlayState.filterId ? getFilterById(overlayState.filterId)?.filter : undefined}
              handleTimeUpdate={handleTimeUpdate}
              handleVideoEnded={handleVideoEnded}
              handleVideoError={handleVideoError}
              videoError={videoError}
              handlePlayPause={handlePlayPause}
              isPlaying={isPlaying}
              allWords={allWords}
              deletedWordIds={deletedWordIds}
              currentTime={currentTime}
              overlayState={overlayState}
              setCaptionPosition={setCaptionPosition}
              formatTime={formatTime}
              activeDuration={activeDuration}
              deletedSegments={deletedSegments}
              totalDuration={totalDuration}
            />
          </div>

          {/* Mobile Transcript Tab */}
          <div className="w-full flex-shrink-0 px-4">
            <MobileTranscriptPanel
              isTranscribing={isTranscribing}
              transcribeProgress={transcribeProgress}
              clips={clips}
              allWords={allWords}
              currentTime={currentTime}
              handleWordClick={handleWordClick}
              handleDeletedWordsChange={handleDeletedWordsChange}
              allSegments={allSegments}
              deletedSegments={deletedSegments}
              selectedSegmentIndex={selectedSegmentIndex}
              activeSegmentIndex={activeSegmentIndex}
              handleSegmentClick={handleSegmentClick}
              formatTime={formatTime}
              deletedWordIds={deletedWordIds}
              deletedPauseIds={deletedPauseIds}
              handleRestoreAll={handleRestoreAll}
            />
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex flex-col lg:flex-row gap-8">
        {/* Preview Panel - Fixed width on desktop */}
        <div className="w-full lg:w-[340px] flex-shrink-0">
          <p className="label mb-4">Preview</p>
          <div className="card-glow overflow-hidden">
            <div className="aspect-[9/16] bg-black relative">
              {activeClip && (
                <>
                  <video
                    ref={videoRef}
                    src={activeClip.url}
                    className="w-full h-full object-cover"
                    style={{ filter: filterStyle && filterStyle !== 'none' ? filterStyle : undefined }}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnded}
                    onError={handleVideoError}
                    playsInline
                  />
                  {/* Real-time caption preview */}
                  <CaptionPreview
                    words={allWords}
                    deletedWordIds={deletedWordIds}
                    currentTime={currentTime}
                    showCaptions={overlayState.showCaptionPreview}
                    positionY={overlayState.captionPositionY}
                    onPositionChange={setCaptionPosition}
                  />
                </>
              )}
              {videoError && (
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

              {/* Overlay Toolbar - moved to sidebar (TODO) */}
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
              {(deletedSegments.size > 0 || deletedWordIds.size > 0 || deletedPauseIds.size > 0) && (
                <button
                  onClick={handleRestoreAll}
                  className="btn-secondary text-xs py-2 px-4 whitespace-nowrap"
                >
                  Restore All ({deletedWordIds.size + deletedPauseIds.size || deletedSegments.size})
                </button>
              )}
            </div>
          </div>

          <div className="card p-5 h-[520px]">
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
            ) : allWords.length > 0 ? (
              <ScriptEditor
                words={allWords}
                currentTime={currentTime}
                onWordClick={handleWordClick}
                onDeletedWordsChange={handleDeletedWordsChange}
              />
            ) : allSegments.length > 0 ? (
              /* Fallback: segment-based editing if no words available */
              <div className="space-y-1 overflow-y-auto h-full" ref={transcriptRef}>
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
                <p className="text-white font-medium mb-2">Preparing transcript...</p>
                <p className="text-[#636366] text-sm leading-relaxed">
                  Transcription will begin automatically
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay panels are now in the Sidebar */}
    </div>

    {/* Fixed Bottom Timeline - Descript Style */}
    <ResizableBottomPanel
      minHeight={120}
      maxHeight={400}
      defaultHeight={180}
    >
      <div className="h-full px-4">
        <Timeline
          tracks={timelineTracks}
          totalDuration={totalDuration}
          currentFrame={Math.round(currentTime * 30)}
          fps={30}
          onFrameChange={handleTimelineFrameChange}
          onItemMove={handleTimelineItemMove}
          onItemResize={handleTimelineItemResize}
          onItemSelect={handleTimelineItemSelect}
          onDeleteItems={handleTimelineItemDelete}
          selectedItemIds={selectedTimelineItems}
          onSelectedItemsChange={setSelectedTimelineItems}
          showZoomControls
          showPlaybackControls
          isPlaying={isPlaying}
          onPlay={() => {
            if (videoRef.current) {
              videoRef.current.play().catch((e) => {
                if (e.name !== 'AbortError') console.error('Video play error:', e);
              });
              setIsPlaying(true);
            }
          }}
          onPause={() => {
            if (videoRef.current) {
              videoRef.current.pause();
              setIsPlaying(false);
            }
          }}
          onAddContent={() => {
            // TODO: Open add content menu (clips, text, stickers, etc.)
            console.log('Add content clicked');
          }}
        />
      </div>
    </ResizableBottomPanel>
    </>
  );
}

function ExportStep({
  clips,
  segments,
  deletedSegmentIndices,
  words,
  deletedWordIds,
  deletedPauseIds,
  onBack,
}: {
  clips: VideoClip[];
  segments: TranscriptSegment[];
  deletedSegmentIndices: number[];
  words: TranscriptWord[];
  deletedWordIds: string[];
  deletedPauseIds: string[];
  onBack: () => void;
}) {
  const { state: overlayState } = useOverlay();
  const { user } = useUser();
  const [selectedTemplate, setSelectedTemplate] = useState<CaptionTemplate>(captionTemplates[0]);
  const [renderState, setRenderState] = useState<"idle" | "converting" | "rendering" | "done" | "error">("idle");
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if any clips need conversion (MOV/HEVC formats)
  const clipsNeedingConversion = useMemo(() => {
    return clips.filter(clip => {
      const filename = clip.file.name.toLowerCase();
      const type = clip.file.type;
      return filename.endsWith('.mov') ||
             filename.endsWith('.hevc') ||
             type === 'video/quicktime';
    });
  }, [clips]);

  const needsConversion = clipsNeedingConversion.length > 0;

  // Poll for render progress
  useEffect(() => {
    // Poll during both converting and rendering states
    if ((renderState !== "rendering" && renderState !== "converting") || !renderId) return;

    const isConverting = renderState === "converting";

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
          // Switch from converting to rendering once we pass the conversion phase (progress > 5%)
          if (isConverting && data.progress > 5) {
            setRenderState("rendering");
          }
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
    // Show converting state if needed
    if (needsConversion) {
      setRenderState("converting");
    } else {
      setRenderState("rendering");
    }
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
          words,  // Word-level timestamps for accurate captions
          deletedWordIds,  // Word-level deletions
          deletedPauseIds,  // Pause deletions (jump cuts)
          captionTemplateId: selectedTemplate.id,
          width: 1080,
          height: 1920,
          fps: 30,
          // Include overlay state
          filterId: overlayState.filterId,
          textOverlays: overlayState.textOverlays,
          stickers: overlayState.stickers,
          captionPositionY: overlayState.captionPositionY,
          clipTransitions: overlayState.clipTransitions,
          // Include userId for Supabase storage
          userId: user?.id,
          // Request conversion for MOV/HEVC files
          convertIfNeeded: needsConversion,
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
      // If downloadUrl is a Supabase signed URL (starts with http), open directly
      // Otherwise use the local download API
      if (downloadUrl.startsWith('http')) {
        window.open(downloadUrl, '_blank');
      } else {
        window.location.href = `/api/render/download/${renderId}`;
      }
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

  // Converting state (for MOV/HEVC files)
  if (renderState === "converting") {
    return (
      <div className="text-center px-4 max-w-md mx-auto animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-6">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-3xl font-semibold mb-3 tracking-tight">Converting video</h2>
        <p className="text-[#8E8E93] mb-8 text-base">
          Converting MOV/HEVC to MP4 for rendering...
        </p>
        <div className="w-full h-2 bg-[#181818] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(renderProgress * 2, 100)}%` }}
          />
        </div>
        <p className="text-[#45454F] text-sm">This ensures compatibility with the renderer</p>
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
                ? "ring-2 ring-[#4A8FE7] ring-offset-2 ring-offset-[var(--background)] scale-[1.02]"
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

      {/* MOV/HEVC conversion notice */}
      {needsConversion && (
        <div className="card p-4 mb-6 text-left border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-amber-500 font-medium text-sm mb-1">Format conversion required</p>
              <p className="text-[#8E8E93] text-xs leading-relaxed">
                {clipsNeedingConversion.length} clip{clipsNeedingConversion.length > 1 ? 's' : ''} (MOV/HEVC) will be converted to MP4 for rendering. This may add extra processing time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Export summary */}
      <div className="card p-5 mb-10 text-left">
        <p className="label mb-3">Summary</p>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-[#636366]">Clips:</span>{" "}
            <span className="text-white font-medium">{clips.length}</span>
          </div>
          {words.length > 0 ? (
            <>
              <div>
                <span className="text-[#636366]">Words:</span>{" "}
                <span className="text-white font-medium">
                  {words.length - deletedWordIds.length} active
                </span>
              </div>
              {deletedWordIds.length > 0 && (
                <div>
                  <span className="text-[#636366]">Removed:</span>{" "}
                  <span className="text-white font-medium">{deletedWordIds.length} words</span>
                </div>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
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

// Mobile Video Panel Component
function MobileVideoPanel({
  activeClip,
  videoRef,
  filterStyle,
  handleTimeUpdate,
  handleVideoEnded,
  handleVideoError,
  videoError,
  handlePlayPause,
  isPlaying,
  allWords,
  deletedWordIds,
  currentTime,
  overlayState,
  setCaptionPosition,
  formatTime,
  activeDuration,
  deletedSegments,
  totalDuration,
}: {
  activeClip: { url: string } | undefined;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  filterStyle: string | undefined;
  handleTimeUpdate: () => void;
  handleVideoEnded: () => void;
  handleVideoError: () => void;
  videoError: string | null;
  handlePlayPause: () => void;
  isPlaying: boolean;
  allWords: TranscriptWord[];
  deletedWordIds: Set<string>;
  currentTime: number;
  overlayState: { showCaptionPreview: boolean; captionPositionY: number };
  setCaptionPosition: (y: number) => void;
  formatTime: (seconds: number) => string;
  activeDuration: number;
  deletedSegments: Set<number>;
  totalDuration: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="overflow-hidden rounded-md border border-[var(--border-subtle)]">
        <div className="aspect-[9/16] bg-black relative max-h-[55vh]">
          {activeClip && (
          <>
            <video
              ref={videoRef}
              src={activeClip.url}
              className="w-full h-full object-cover"
              style={{ filter: filterStyle && filterStyle !== 'none' ? filterStyle : undefined }}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              playsInline
            />
            <CaptionPreview
              words={allWords}
              deletedWordIds={deletedWordIds}
              currentTime={currentTime}
              showCaptions={overlayState.showCaptionPreview}
              positionY={overlayState.captionPositionY}
              onPositionChange={setCaptionPosition}
            />
          </>
        )}
        {videoError && (
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
          className={`absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent transition-all duration-300 ${videoError ? "hidden" : "opacity-0 hover:opacity-100 active:opacity-100"}`}
        >
          <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 transition-transform hover:scale-105">
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </button>
        </div>
        <div className="p-3 text-center text-sm text-[#8E8E93] bg-[#111111]">
          {formatTime(currentTime)} / {formatTime(activeDuration)}
          {deletedSegments.size > 0 && (
            <span className="text-[#636366] ml-1">
              ({formatTime(totalDuration - activeDuration)} removed)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Mobile Transcript Panel Component
function MobileTranscriptPanel({
  isTranscribing,
  transcribeProgress,
  clips,
  allWords,
  currentTime,
  handleWordClick,
  handleDeletedWordsChange,
  allSegments,
  deletedSegments,
  selectedSegmentIndex,
  activeSegmentIndex,
  handleSegmentClick,
  formatTime,
  deletedWordIds,
  deletedPauseIds,
  handleRestoreAll,
}: {
  isTranscribing: boolean;
  transcribeProgress: number;
  clips: { file: File }[];
  allWords: TranscriptWord[];
  currentTime: number;
  handleWordClick: (word: TranscriptWord) => void;
  handleDeletedWordsChange: (ids: Set<string>) => void;
  allSegments: { text: string; start: number; end: number; clipIndex: number }[];
  deletedSegments: Set<number>;
  selectedSegmentIndex: number | null;
  activeSegmentIndex: number;
  handleSegmentClick: (segment: { text: string; start: number; end: number; clipIndex: number }, index: number) => void;
  formatTime: (seconds: number) => string;
  deletedWordIds: Set<string>;
  deletedPauseIds: Set<string>;
  handleRestoreAll: () => void;
}) {
  return (
    <div className="h-[60vh] flex flex-col">
      {/* Header with restore button */}
      <div className="flex items-center justify-between mb-3">
        <p className="label">Transcript</p>
        {(deletedSegments.size > 0 || deletedWordIds.size > 0 || deletedPauseIds.size > 0) && (
          <button
            onClick={handleRestoreAll}
            className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap"
          >
            Restore All ({deletedWordIds.size + deletedPauseIds.size || deletedSegments.size})
          </button>
        )}
      </div>

      <div className="card p-4 flex-1 overflow-hidden">
        {isTranscribing ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-12 h-12 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-white text-sm mb-1">Transcribing...</p>
              <p className="text-[#636366] text-xs">
                Clip {Math.ceil((transcribeProgress / 100) * clips.length)} of {clips.length}
              </p>
            </div>
          </div>
        ) : allWords.length > 0 ? (
          <ScriptEditor
            words={allWords}
            currentTime={currentTime}
            onWordClick={handleWordClick}
            onDeletedWordsChange={handleDeletedWordsChange}
          />
        ) : allSegments.length > 0 ? (
          <div className="space-y-1 overflow-y-auto h-full">
            {allSegments.map((segment, i) => {
              const isDeleted = deletedSegments.has(i);
              const isSelected = selectedSegmentIndex === i;
              const isActive = activeSegmentIndex === i;

              return (
                <button
                  key={i}
                  onClick={() => handleSegmentClick(segment, i)}
                  className={`block w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                    isSelected ? "ring-2 ring-[#4A8FE7]" : ""
                  } ${
                    isDeleted
                      ? "bg-red-950/30 text-[#636366]"
                      : isActive
                      ? "bg-[#4A8FE7]/15 text-white"
                      : "text-[#8E8E93] hover:bg-[#242430]"
                  }`}
                >
                  <span className={`text-[10px] font-medium mr-2 ${isDeleted ? "text-[#45454F]" : "text-[#4A8FE7]"}`}>
                    {formatTime(segment.start)}
                  </span>
                  <span className={`${isDeleted ? "line-through opacity-60" : ""}`}>
                    {segment.text}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[#181818] flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-white font-medium text-sm mb-1">Preparing transcript...</p>
            <p className="text-[#636366] text-xs">Transcription will begin automatically</p>
          </div>
        )}
      </div>
    </div>
  );
}
