"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { captionTemplates } from "@/lib/caption-templates";
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
import { useUser, useSignOut } from "@/lib/supabase/hooks";
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
import { extractAudioFromVideo, isFFmpegSupported } from "@/lib/audio/extract-audio";

type AppView = "feed" | "editor";
type EditorStep = "upload" | "edit" | "export";

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  clipIndex: number;
}

interface VideoClip {
  file: File | null;           // null until blob downloaded for loaded projects
  url: string;                 // signed URL initially, then blob URL
  signedUrl?: string;          // keep signed URL for fallback
  duration: number;
  transcript?: string;
  segments?: TranscriptSegment[];
  words?: Omit<TranscriptWord, 'clipIndex'>[];  // Words from API (without clipIndex)
  blobReady: boolean;          // track if blob is downloaded
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
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isEditingName, setIsEditingName] = useState(false);
  const [autoCutEnabled, setAutoCutEnabled] = useState(false);

  // Save/Load state
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const savedClipNames = useRef<Set<string>>(new Set());

  // Background clip download progress (for loaded projects)
  const [clipDownloadProgress, setClipDownloadProgress] = useState<{
    total: number;
    completed: number;
    downloading: boolean;
  }>({ total: 0, completed: 0, downloading: false });

  // Background export state
  const [exportState, setExportState] = useState<{
    status: 'idle' | 'preparing' | 'converting' | 'rendering' | 'done' | 'error';
    progress: number;
    renderId: string | null;
    downloadUrl: string | null;
    error: string | null;
  }>({ status: 'idle', progress: 0, renderId: null, downloadUrl: null, error: null });

  const { createProject, updateProject, projects, refreshProjects } = useProjects();
  const { state: overlayState, loadState: loadOverlayState, resetOverlays } = useOverlay();
  const { user } = useUser();
  const signOut = useSignOut();
  const router = useRouter();

  // Track changes
  useEffect(() => {
    if (view === "editor" && (clips.length > 0 || deletedWordIds.size > 0 || deletedPauseIds.size > 0)) {
      setHasUnsavedChanges(true);
    }
  }, [clips.length, deletedWordIds.size, deletedPauseIds.size, view]);

  // Handle creating a new project
  const handleCreateProject = useCallback(async () => {
    // Redirect to login if not authenticated
    if (!user) {
      router.push('/login');
      return;
    }

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
  }, [user, router, createProject, resetOverlays]);

  // Background download blobs for loaded project clips
  const downloadClipBlobs = useCallback(async (
    initialClips: VideoClip[],
    clipInfos: Array<{ signedUrl: string; filename: string }>
  ) => {
    setClipDownloadProgress({ total: initialClips.length, completed: 0, downloading: true });

    for (let i = 0; i < clipInfos.length; i++) {
      try {
        const blobResponse = await fetch(clipInfos[i].signedUrl);
        const blob = await blobResponse.blob();

        // Ensure valid MIME type for iOS Safari compatibility
        const filename = clipInfos[i].filename;
        let mimeType = blob.type;
        if (!mimeType || mimeType === 'application/octet-stream') {
          // Infer from filename extension
          const ext = filename.split('.').pop()?.toLowerCase();
          const mimeMap: Record<string, string> = {
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'webm': 'video/webm',
            'm4v': 'video/x-m4v',
          };
          mimeType = mimeMap[ext || ''] || 'video/mp4';
        }

        const file = new File([blob], filename, { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        // Update clip with blob data
        setClips(prev => prev.map((clip, idx) =>
          idx === i ? { ...clip, file, url: blobUrl, blobReady: true } : clip
        ));

        // Mark as saved so it won't be re-uploaded
        savedClipNames.current.add(clipInfos[i].filename);

        setClipDownloadProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
      } catch (error) {
        console.error(`Failed to download clip ${i}:`, error);
        // Continue with other clips even if one fails
        setClipDownloadProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
      }
    }

    setClipDownloadProgress(prev => ({ ...prev, downloading: false }));
  }, []);

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
    setClipDownloadProgress({ total: 0, completed: 0, downloading: false });
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

      // Phase 1: Load clips instantly with signed URLs (no blob download)
      if (clipsResponse.ok && clipsJson.clips && clipsJson.clips.length > 0) {
        const clipInfos = clipsJson.clips.map((clip: {
          id: string;
          filename: string;
          signedUrl: string;
          duration: number;
          orderIndex: number;
          transcript?: string;
          segments?: { text: string; start: number; end: number }[];
          words?: { id: string; word: string; start: number; end: number }[];
        }) => ({
          signedUrl: clip.signedUrl,
          filename: clip.filename,
        }));

        // Create clips with signed URLs immediately (no blob yet)
        const loadedClips: VideoClip[] = clipsJson.clips.map((clip: {
          id: string;
          filename: string;
          signedUrl: string;
          duration: number;
          orderIndex: number;
          transcript?: string;
          segments?: { text: string; start: number; end: number }[];
          words?: { id: string; word: string; start: number; end: number }[];
        }) => ({
          file: null, // Blob not downloaded yet
          url: clip.signedUrl, // Use signed URL for immediate preview
          signedUrl: clip.signedUrl, // Keep for reference
          duration: clip.duration,
          transcript: clip.transcript,
          segments: clip.segments?.map((seg) => ({
            ...seg,
            clipIndex: clip.orderIndex,
          })),
          words: clip.words,
          blobReady: false, // Mark as not ready
        }));

        setClips(loadedClips);
        setStep("edit");
        setIsLoadingProject(false); // Hide loading overlay immediately

        // Phase 2: Start background blob downloads
        downloadClipBlobs(loadedClips, clipInfos);
      } else {
        setIsLoadingProject(false);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      setIsLoadingProject(false);
    }
  }, [loadOverlayState, resetOverlays, downloadClipBlobs]);

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

      // Find clips that haven't been saved yet (skip re-uploads and clips without blobs)
      const unsavedClips = clips.filter(clip =>
        clip.file && clip.blobReady && !savedClipNames.current.has(clip.file.name)
      );

      // Only upload new clips that have blobs downloaded
      let clipsPromise: Promise<Response> | null = null;
      if (unsavedClips.length > 0) {
        const clipData = await Promise.all(
          unsavedClips.map(async (clip) => {
            const index = clips.indexOf(clip);
            const arrayBuffer = await clip.file!.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            return {
              data: base64,
              filename: clip.file!.name,
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
          unsavedClips.forEach(clip => savedClipNames.current.add(clip.file!.name));
        }
      }

      // Show success animation
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
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
      refreshProjects(); // Refresh to get updated thumbnails
      setView("feed");
      setCurrentProjectId(null);
    }
  }, [hasUnsavedChanges, refreshProjects]);

  // Save and exit
  const handleSaveAndExit = useCallback(async () => {
    await saveProject();
    setShowExitDialog(false);
    refreshProjects(); // Refresh to get updated thumbnails
    setView("feed");
    setCurrentProjectId(null);
  }, [saveProject, refreshProjects]);

  // Discard and exit
  const handleDiscardAndExit = useCallback(() => {
    setShowExitDialog(false);
    setHasUnsavedChanges(false);
    refreshProjects(); // Refresh to get updated thumbnails
    setView("feed");
    setCurrentProjectId(null);
  }, [refreshProjects]);

  // Background export - start rendering without blocking UI
  const startBackgroundExport = useCallback(async () => {
    // Filter clips that have files
    const clipsWithFiles = clips.filter(clip => clip.file);
    if (clipsWithFiles.length === 0) {
      setExportState({
        status: 'error',
        progress: 0,
        renderId: null,
        downloadUrl: null,
        error: 'No clips available for export',
      });
      return;
    }

    // Check if any clips need conversion
    const clipsNeedingConversion = clipsWithFiles.filter(clip => {
      const filename = clip.file!.name.toLowerCase();
      const type = clip.file!.type;
      return filename.endsWith('.mov') || filename.endsWith('.hevc') || type === 'video/quicktime';
    });
    const needsConversion = clipsNeedingConversion.length > 0;

    setExportState({
      status: needsConversion ? 'converting' : 'preparing',
      progress: 0,
      renderId: null,
      downloadUrl: null,
      error: null,
    });

    try {
      // Convert clips to base64
      const clipData = await Promise.all(
        clipsWithFiles.map(async (clip) => {
          const arrayBuffer = await clip.file!.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          return {
            data: base64,
            filename: clip.file!.name,
            duration: clip.duration,
          };
        })
      );

      // Get all words and segments - transform IDs to match deletedPauseIds format
      const allWords = clips.flatMap((clip, idx) =>
        (clip.words || []).map(w => ({
          ...w,
          id: `clip-${idx}-${w.id}`,  // Match the ID format used in deletedPauseIds
          clipIndex: idx,
        }))
      );
      const allSegments = clips.flatMap((clip, idx) =>
        (clip.segments || []).map(s => ({ ...s, clipIndex: idx }))
      );

      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clips: clipData,
          segments: allSegments,
          deletedSegmentIndices: Array.from(deletedSegments),
          words: allWords,
          deletedWordIds: Array.from(deletedWordIds),
          deletedPauseIds: Array.from(deletedPauseIds),
          captionTemplateId: overlayState.captionTemplateId || 'classic',
          width: 1080,
          height: 1920,
          fps: 30,
          filterId: overlayState.filterId,
          textOverlays: overlayState.textOverlays,
          stickers: overlayState.stickers,
          captionPositionY: overlayState.captionPositionY,
          clipTransitions: overlayState.clipTransitions,
          userId: user?.id,
          convertIfNeeded: needsConversion,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setExportState(prev => ({
          ...prev,
          status: needsConversion ? 'converting' : 'rendering',
          renderId: data.renderId,
        }));
      } else {
        setExportState(prev => ({
          ...prev,
          status: 'error',
          error: data.error || "Failed to start render",
        }));
      }
    } catch (error) {
      setExportState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : "Failed to start render",
      }));
    }
  }, [clips, deletedSegments, deletedWordIds, deletedPauseIds, overlayState, user?.id]);

  // Poll for export progress
  useEffect(() => {
    if ((exportState.status !== 'rendering' && exportState.status !== 'converting') || !exportState.renderId) return;

    const pollProgress = async () => {
      try {
        const response = await fetch("/api/render/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ renderId: exportState.renderId }),
        });

        const data = await response.json();

        if (data.type === "done") {
          setExportState(prev => ({
            ...prev,
            status: 'done',
            progress: 100,
            downloadUrl: data.url,
          }));
        } else if (data.type === "error") {
          setExportState(prev => ({
            ...prev,
            status: 'error',
            error: data.message,
          }));
        } else if (data.type === "progress") {
          // Switch from converting to rendering once we pass 5%
          const newStatus = exportState.status === 'converting' && data.progress > 5 ? 'rendering' : exportState.status;
          setExportState(prev => ({
            ...prev,
            status: newStatus,
            progress: data.progress,
          }));
        }
      } catch (error) {
        console.error("Error polling progress:", error);
      }
    };

    const interval = setInterval(pollProgress, 1000);
    return () => clearInterval(interval);
  }, [exportState.status, exportState.renderId]);

  // Handle export download
  const handleExportDownload = useCallback(() => {
    if (exportState.downloadUrl) {
      if (exportState.downloadUrl.startsWith('http')) {
        window.open(exportState.downloadUrl, '_blank');
      } else {
        window.location.href = `/api/render/download/${exportState.renderId}`;
      }
    }
  }, [exportState.downloadUrl, exportState.renderId]);

  // Dismiss export notification
  const dismissExport = useCallback(() => {
    setExportState({ status: 'idle', progress: 0, renderId: null, downloadUrl: null, error: null });
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
        blobReady: true, // Local file upload has blob immediately
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

  const handleFilesSelected = async (files: File[], autoCut: boolean = false) => {
    setStep("edit");
    setAutoCutEnabled(autoCut);

    const videoClips: VideoClip[] = await Promise.all(
      files.map(async (file) => {
        // Ensure valid MIME type for iOS Safari compatibility
        let processedFile = file;
        if (!file.type || file.type === 'application/octet-stream') {
          const ext = file.name.split('.').pop()?.toLowerCase();
          const mimeMap: Record<string, string> = {
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'webm': 'video/webm',
            'm4v': 'video/x-m4v',
            'hevc': 'video/mp4',
          };
          const mimeType = mimeMap[ext || ''] || 'video/mp4';
          processedFile = new File([file], file.name, { type: mimeType });
        }

        const url = URL.createObjectURL(processedFile);
        const duration = await getVideoDuration(url);
        return { file: processedFile, url, duration, blobReady: true };
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

  // Auto remove silent pauses - removes all pauses above threshold
  const handleAutoRemoveSilence = useCallback(() => {
    const PAUSE_THRESHOLD = 0.3; // Match timeline constant
    const pausesToDelete = new Set<string>();

    // Find all pauses between consecutive words
    for (let i = 0; i < allWords.length - 1; i++) {
      const word = allWords[i];
      const nextWord = allWords[i + 1];

      // Only consider pauses within the same clip
      if (word.clipIndex !== nextWord.clipIndex) continue;

      const gap = nextWord.start - word.end;
      if (gap >= PAUSE_THRESHOLD) {
        pausesToDelete.add(`pause-after-${word.id}`);
      }
    }

    // Also handle leading pauses (before first word of each clip)
    const clipIndices = new Set(allWords.map(w => w.clipIndex));
    clipIndices.forEach(clipIndex => {
      const clipWords = allWords.filter(w => w.clipIndex === clipIndex);
      if (clipWords.length > 0) {
        const firstWord = clipWords[0];
        if (firstWord.start >= PAUSE_THRESHOLD) {
          pausesToDelete.add(`pause-before-clip-${clipIndex}`);
        }
      }
    });

    if (pausesToDelete.size > 0) {
      setDeletedPauseIds(prev => new Set([...prev, ...pausesToDelete]));
    }

    return pausesToDelete.size;
  }, [allWords]);

  // Feed view
  if (view === "feed") {
    return (
      <MediaLibraryProvider>
        <Sidebar
          view="feed"
          onOpenUploads={() => setShowUploads(true)}
          onNavigateHome={() => setView("feed")}
          onCreateProject={handleCreateProject}
        />
        <MediaLibraryPanel
          isOpen={showUploads}
          onClose={() => setShowUploads(false)}
          onSelectMedia={handleAddMediaToTimeline}
        />
        <div className="min-h-screen flex flex-col bg-[var(--background-content)] md:pl-[72px] pb-24 md:pb-0">
          {/* Mobile gradient header background */}
          <div className="md:hidden absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-[#4A8FE7]/30 via-[#4A8FE7]/10 to-transparent pointer-events-none" />

          {/* Header with logo and create button */}
          <header className="relative flex items-center justify-between px-5 sm:px-8 py-4 border-b border-[var(--border-subtle)] md:border-b">
            <div className="flex items-center gap-2">
              {/* Film strip S logo */}
              <Image
                src="/branding/snip-logo-white.svg"
                alt="Snip"
                width={100}
                height={30}
                className="h-7 w-auto"
                priority
              />
            </div>
            {/* Mobile create button */}
            <button
              onClick={handleCreateProject}
              className="md:hidden w-10 h-10 flex items-center justify-center text-white"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </header>

          {/* Mobile-only profile row below header */}
          <div className="md:hidden relative flex items-center gap-3 px-5 py-3">
            <button
              onClick={() => user ? setShowProfilePanel(true) : router.push('/login')}
              className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#4A8FE7] to-[#5F7BFD] flex items-center justify-center flex-shrink-0"
            >
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {user?.email?.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </button>
            <button
              onClick={() => user ? setShowProfilePanel(true) : router.push('/login')}
              className="text-white font-medium truncate text-left"
            >
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest'}
            </button>
          </div>

          {/* Mobile Profile Panel (Canva-style) */}
          <AnimatePresence>
            {showProfilePanel && (
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="md:hidden fixed inset-0 z-[100] bg-[#0A0A0A]"
              >
                {/* Gradient background */}
                <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-[#4A8FE7]/30 via-[#4A8FE7]/10 to-transparent pointer-events-none" />

                {/* Header */}
                <div className="relative flex items-center justify-between px-4 py-4">
                  <button
                    onClick={() => setShowProfilePanel(false)}
                    className="w-10 h-10 flex items-center justify-center text-white"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>

                {/* Account Section */}
                <div className="px-5 pb-4">
                  <h2 className="text-2xl font-bold text-white mb-4">Account</h2>
                  <div className="bg-[#1C1C1E] rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-[#4A8FE7] to-[#5F7BFD] flex items-center justify-center flex-shrink-0">
                      {user?.user_metadata?.avatar_url ? (
                        <img
                          src={user.user_metadata.avatar_url}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-xl font-semibold">
                          {user?.email?.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-lg truncate">
                        {user?.user_metadata?.full_name || 'User'}
                      </p>
                      <p className="text-[#8E8E93] text-sm truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="px-5 pt-4">
                  <div className="space-y-1">
                    {/* Settings */}
                    <button
                      onClick={() => {
                        setShowProfilePanel(false);
                        // router.push('/settings');
                      }}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-[#1C1C1E] transition-colors"
                    >
                      <svg className="w-6 h-6 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-white font-medium">Settings</span>
                      <svg className="w-5 h-5 text-[#636366] ml-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Help */}
                    <button
                      onClick={() => {
                        setShowProfilePanel(false);
                        window.open('https://github.com/anthropics/claude-code/issues', '_blank');
                      }}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-[#1C1C1E] transition-colors"
                    >
                      <svg className="w-6 h-6 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                      <span className="text-white font-medium">Help & Support</span>
                      <svg className="w-5 h-5 text-[#636366] ml-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Divider */}
                    <div className="my-2 border-t border-[#2C2C2E]" />

                    {/* Sign Out */}
                    <button
                      onClick={() => {
                        setShowProfilePanel(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-[#1C1C1E] transition-colors"
                    >
                      <svg className="w-6 h-6 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                      <span className="text-white font-medium">Sign Out</span>
                      <svg className="w-5 h-5 text-[#636366] ml-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
        view="editor"
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

      {/* Background clip download progress indicator */}
      {clipDownloadProgress.downloading && (
        <div className="fixed bottom-4 right-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-3 shadow-lg z-50">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#8E8E93]">
              Preparing clips... {clipDownloadProgress.completed}/{clipDownloadProgress.total}
            </span>
          </div>
          <div className="mt-2 h-1 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4A8FE7] transition-all duration-300"
              style={{ width: `${(clipDownloadProgress.completed / clipDownloadProgress.total) * 100}%` }}
            />
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

        <div className="min-h-screen flex flex-col bg-[var(--background-content)] md:pl-[72px] pb-24 md:pb-0">
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
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Auto Cut Button - removes silent pauses */}
              <button
                onClick={() => {
                  const count = handleAutoRemoveSilence();
                  if (count === 0) {
                    // Could show a toast, but for now just log
                    console.log('No pauses to remove');
                  }
                }}
                disabled={allWords.length === 0}
                className="text-sm px-4 py-2.5 rounded-full bg-amber-500/10 backdrop-blur-xl border border-amber-500/30 text-amber-400 font-medium disabled:opacity-50 flex items-center gap-2 transition-all duration-300 hover:bg-amber-500/20 hover:border-amber-500/50"
                title="Auto remove silent pauses"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                </svg>
                <span className="hidden sm:inline">Auto Cut</span>
              </button>
              <button
                onClick={saveProject}
                disabled={isSaving || !hasUnsavedChanges}
                className={`text-sm px-5 py-2.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 font-medium disabled:opacity-50 flex items-center gap-2 transition-all duration-300 hover:bg-white/10 ${
                  showSaveSuccess ? 'text-green-400 border-green-400/30' : 'text-white'
                }`}
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : showSaveSuccess ? (
                  <>
                    <svg
                      className="w-4 h-4 text-green-400 animate-scale-in"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Saved
                  </>
                ) : (
                  <>
                    {hasUnsavedChanges ? "Save" : "Saved"}
                  </>
                )}
              </button>
              <button
                onClick={startBackgroundExport}
                disabled={exportState.status !== 'idle' && exportState.status !== 'done' && exportState.status !== 'error'}
                className="text-sm px-6 py-2.5 rounded-full bg-[#4A8FE7]/90 backdrop-blur-xl text-white font-medium border border-[#4A8FE7]/50 shadow-lg shadow-[#4A8FE7]/25 hover:bg-[#4A8FE7] hover:shadow-[#4A8FE7]/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportState.status !== 'idle' && exportState.status !== 'done' && exportState.status !== 'error'
                  ? 'Exporting...'
                  : 'Export'}
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
              autoCutEnabled={autoCutEnabled}
              setAutoCutEnabled={setAutoCutEnabled}
            />
          )}
        </main>

        {/* Floating Export Progress Indicator */}
        {exportState.status !== 'idle' && (
          <ExportProgressIndicator
            status={exportState.status}
            progress={exportState.progress}
            error={exportState.error}
            onDownload={handleExportDownload}
            onDismiss={dismissExport}
            onRetry={startBackgroundExport}
          />
        )}
      </div>
    </MediaLibraryProvider>
  );
}

// Floating Export Progress Indicator Component
function ExportProgressIndicator({
  status,
  progress,
  error,
  onDownload,
  onDismiss,
  onRetry,
}: {
  status: 'idle' | 'preparing' | 'converting' | 'rendering' | 'done' | 'error';
  progress: number;
  error: string | null;
  onDownload: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const getStatusText = () => {
    switch (status) {
      case 'preparing': return 'Preparing export...';
      case 'converting': return 'Converting video formats...';
      case 'rendering': return `Rendering video (${Math.round(progress)}%)`;
      case 'done': return 'Export complete!';
      case 'error': return 'Export failed';
      default: return '';
    }
  };

  const getStatusIcon = () => {
    if (status === 'done') {
      return (
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-[#4A8FE7]/20 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[60] animate-slide-up">
      <div className="bg-[#1C1C1E]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-4 min-w-[300px] max-w-[360px]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{getStatusText()}</p>
            {status === 'error' && error && (
              <p className="text-red-400 text-xs truncate">{error}</p>
            )}
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar (only during conversion/rendering) */}
        {(status === 'preparing' || status === 'converting' || status === 'rendering') && (
          <div className="mb-3">
            <div className="w-full h-2 bg-[#2C2C2E] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  status === 'converting'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-gradient-to-r from-[#4A8FE7] to-[#5F7BFD]'
                }`}
                style={{ width: `${Math.max(status === 'preparing' ? 5 : progress, 2)}%` }}
              />
            </div>
            <p className="text-[#636366] text-[10px] mt-1.5 text-center">
              {status === 'preparing'
                ? 'Processing clips...'
                : status === 'converting'
                  ? 'Converting MOV/HEVC to MP4...'
                  : 'This may take a few minutes'}
            </p>
          </div>
        )}

        {/* Actions */}
        {status === 'done' && (
          <button
            onClick={onDownload}
            className="w-full py-2.5 rounded-xl bg-[#4A8FE7] text-white text-sm font-medium hover:bg-[#3A7FD7] transition-colors"
          >
            Download Video
          </button>
        )}
        {status === 'error' && (
          <button
            onClick={onRetry}
            className="w-full py-2.5 rounded-xl bg-[#4A8FE7] text-white text-sm font-medium hover:bg-[#3A7FD7] transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
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

interface SelectedFile {
  file: File;
  thumbnail: string;
  duration: number;
}

function UploadStep({
  onFilesSelected,
}: {
  onFilesSelected: (files: File[], autoCut?: boolean) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate thumbnail and get duration for a video file
  const processFile = async (file: File): Promise<SelectedFile> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.src = url;
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        video.currentTime = 1; // Seek to 1 second for thumbnail
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(url);
        resolve({
          file,
          thumbnail,
          duration: video.duration,
        });
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({
          file,
          thumbnail: '',
          duration: 0,
        });
      };
    });
  };

  const handleFilesAdded = async (files: File[]) => {
    setIsProcessing(true);
    const processed = await Promise.all(files.map(processFile));
    setSelectedFiles((prev) => [...prev, ...processed]);
    setIsProcessing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith("video/")
    );
    if (files.length > 0) handleFilesAdded(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesAdded(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNext = () => {
    onFilesSelected(selectedFiles.map((f) => f.file), false);
  };

  const handleAutoCut = () => {
    onFilesSelected(selectedFiles.map((f) => f.file), true);
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

      {/* Selected Files Preview */}
      {(selectedFiles.length > 0 || isProcessing) && (
        <div className="mt-8 animate-fade-in">
          {/* Thumbnail row */}
          <div className="flex items-center gap-3 justify-center mb-6 overflow-x-auto pb-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative flex-shrink-0 group">
                <div className="w-20 h-28 rounded-lg overflow-hidden bg-[#2C2C2E] border border-[#3C3C3E]">
                  {file.thumbnail ? (
                    <img
                      src={file.thumbnail}
                      alt={file.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Duration badge */}
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                    {formatDuration(file.duration)}
                  </div>
                </div>
                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    removeFile(index);
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-[#FF3B30] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {isProcessing && (
              <div className="w-20 h-28 rounded-lg bg-[#2C2C2E] border border-[#3C3C3E] flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Action buttons - TikTok style */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleAutoCut}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-3 bg-[#2C2C2E] hover:bg-[#3C3C3E] border border-[#3C3C3E] rounded-full text-white font-medium transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5 text-[#FF3B30]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9l-7 7-7-7" />
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              AutoCut
            </button>
            <button
              onClick={handleNext}
              disabled={isProcessing}
              className="px-8 py-3 bg-[#FF2D55] hover:bg-[#FF375F] rounded-full text-white font-medium transition-all disabled:opacity-50"
            >
              Next ({selectedFiles.length})
            </button>
          </div>
        </div>
      )}
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
  autoCutEnabled,
  setAutoCutEnabled,
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
  autoCutEnabled: boolean;
  setAutoCutEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const desktopVideoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Helper to get the currently visible video element
  const getActiveVideoRef = useCallback(() => {
    // lg breakpoint is 1024px
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      return desktopVideoRef.current;
    }
    return mobileVideoRef.current;
  }, []);

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

  const { state: overlayState, updateTextOverlay, updateSticker, removeTextOverlay, removeSticker, setCaptionPosition, setTransitions, setFilter, toggleCaptionPreview } = useOverlay();

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
        const video = getActiveVideoRef();
        if (video) {
          if (isPlaying) {
            video.pause();
            setIsPlaying(false);
          } else {
            video.play().catch((err) => {
              if (err.name !== 'AbortError') console.error('Video play error:', err);
            });
            setIsPlaying(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, getActiveVideoRef]);

  // Auto-cut effect: apply creative effects after transcription completes
  useEffect(() => {
    if (!autoCutEnabled) return;

    // Check if all clips have been transcribed (have words)
    const allTranscribed = clips.length > 0 && clips.every(clip => clip.words && clip.words.length > 0);
    if (!allTranscribed) return;

    // Apply auto-cut effects once
    setAutoCutEnabled(false); // Disable to prevent re-triggering

    // 1. Auto-delete long pauses (>0.5s) - creates jump cuts
    const pauseThreshold = 0.5; // seconds
    const pausesToDelete = new Set<string>();

    clips.forEach((clip, clipIndex) => {
      if (!clip.words) return;
      for (let i = 0; i < clip.words.length - 1; i++) {
        const currentWord = clip.words[i];
        const nextWord = clip.words[i + 1];
        const gap = nextWord.start - currentWord.end;
        if (gap > pauseThreshold) {
          // Create a pause ID to mark for deletion
          pausesToDelete.add(`pause-clip-${clipIndex}-${currentWord.id}-${nextWord.id}`);
        }
      }
    });

    if (pausesToDelete.size > 0) {
      setDeletedPauseIds(prev => new Set([...prev, ...pausesToDelete]));
    }

    // 2. Apply a creative filter (random selection from good options)
    const creativeFilters = ['cinematic', 'vibrant', 'retro', 'moody', 'fade'];
    const randomFilter = creativeFilters[Math.floor(Math.random() * creativeFilters.length)];
    setFilter(randomFilter);

    // 3. Apply varied transitions if multiple clips
    if (clips.length >= 2) {
      const clipInfos = clips.map((clip, i) => ({
        duration: clip.duration,
        index: i,
      }));
      const autoTransitions = generateAutoTransitions(clipInfos, 'varied');
      setTransitions(autoTransitions);
    }

    console.log('AutoCut applied:', {
      pausesDeleted: pausesToDelete.size,
      filter: randomFilter,
      transitionsApplied: clips.length >= 2,
    });
  }, [autoCutEnabled, clips, setAutoCutEnabled, setDeletedPauseIds, setFilter, setTransitions]);

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
          label: (clip.file?.name || `Clip ${i + 1}`).slice(0, 15),
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
          clips: clips.map(c => ({ duration: c.duration })),
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

    // Immediately update state for smooth playhead (don't wait for timeupdate)
    setCurrentTime(newTime);

    // Find which clip this time falls into
    let accumulatedTime = 0;
    for (let i = 0; i < clips.length; i++) {
      if (newTime < accumulatedTime + clips[i].duration) {
        setActiveClipIndex(i);
        const video = getActiveVideoRef();
        if (video) {
          video.currentTime = newTime - accumulatedTime;
        }
        return;
      }
      accumulatedTime += clips[i].duration;
    }
  }, [clips, getActiveVideoRef]);

  const handlePlayPause = () => {
    const video = getActiveVideoRef();
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch((e) => {
          if (e.name !== 'AbortError') console.error('Video play error:', e);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = useCallback(() => {
    const video = getActiveVideoRef();
    if (video) {
      const previousClipsDuration = clips
        .slice(0, activeClipIndex)
        .reduce((acc, clip) => acc + clip.duration, 0);
      const globalTime = previousClipsDuration + video.currentTime;
      setCurrentTime(globalTime);

      // Skip deleted pauses during playback (jump cuts)
      if (isPlaying && deletedPauseIds.size > 0 && allWords.length > 0) {
        const pauseThreshold = 0.3; // Same threshold as generate-script-track

        // Group words by clip for boundary detection
        const wordsByClip = new Map<number, TranscriptWord[]>();
        for (const word of allWords) {
          const clipWords = wordsByClip.get(word.clipIndex) || [];
          clipWords.push(word);
          wordsByClip.set(word.clipIndex, clipWords);
        }

        // Check for leading pause at clip start (before first word)
        const clipStartTime = clips
          .slice(0, activeClipIndex)
          .reduce((acc, clip) => acc + clip.duration, 0);
        const clipWords = wordsByClip.get(activeClipIndex);
        if (clipWords && clipWords.length > 0) {
          const firstWord = clipWords[0];
          const leadingGap = firstWord.start - clipStartTime;
          if (leadingGap >= pauseThreshold) {
            const leadingPauseId = `pause-before-clip-${activeClipIndex}-first-word`;
            if (deletedPauseIds.has(leadingPauseId) && globalTime >= clipStartTime && globalTime < firstWord.start) {
              // Jump to first word
              video.currentTime = firstWord.start - clipStartTime;
              return;
            }
          }
        }

        // Check for inter-word pauses
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
              const nextClipStartTime = clips
                .slice(0, nextWord.clipIndex)
                .reduce((acc, clip) => acc + clip.duration, 0);
              video.currentTime = nextWord.start - nextClipStartTime;
              return; // Exit early to avoid duplicate processing
            }
          }
        }

        // Check for trailing pause at clip end (after last word)
        if (clipWords && clipWords.length > 0) {
          const lastWord = clipWords[clipWords.length - 1];
          const clipEndTime = clipStartTime + clips[activeClipIndex].duration;
          const trailingGap = clipEndTime - lastWord.end;
          if (trailingGap >= pauseThreshold) {
            const trailingPauseId = `pause-after-clip-${activeClipIndex}-last-word`;
            if (deletedPauseIds.has(trailingPauseId) && globalTime >= lastWord.end && globalTime < clipEndTime) {
              // Jump to next clip or end
              if (activeClipIndex < clips.length - 1) {
                setActiveClipIndex(activeClipIndex + 1);
                const nextClipWords = wordsByClip.get(activeClipIndex + 1);
                if (nextClipWords && nextClipWords.length > 0) {
                  // Jump to first word of next clip
                  const nextClipStartTime = clipEndTime;
                  video.currentTime = nextClipWords[0].start - nextClipStartTime;
                } else {
                  video.currentTime = 0;
                }
              }
              return;
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
            video.currentTime = nextWord.start - clipStartTime;
          } else {
            // No more words, end playback
            video.pause();
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
            video.currentTime = nextSegment.start - clipStartTime;
          } else {
            // No more segments, end playback
            video.pause();
            setIsPlaying(false);
          }
        }
      }
    }
  }, [clips, activeClipIndex, isPlaying, deletedSegments, allSegments, deletedWordIds, deletedPauseIds, allWords, getActiveVideoRef]);

  const handleVideoEnded = () => {
    if (activeClipIndex < clips.length - 1) {
      setActiveClipIndex(activeClipIndex + 1);
    } else {
      setIsPlaying(false);
      setActiveClipIndex(0);
    }
  };

  useEffect(() => {
    const video = getActiveVideoRef();
    if (isPlaying && video) {
      video.play().catch((e) => {
        // Ignore AbortError - happens when play() is interrupted by pause()
        if (e.name !== 'AbortError') {
          console.error('Video play error:', e);
        }
      });
    }
  }, [activeClipIndex, isPlaying, getActiveVideoRef]);

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
    const useClientExtraction = isFFmpegSupported();

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const baseProgress = (i / clips.length) * 100;
      setTranscribeProgress(baseProgress);

      // Skip clips that don't have blobs downloaded yet
      if (!clip.file) {
        console.warn(`Skipping clip ${i} - blob not yet downloaded`);
        continue;
      }

      try {
        let fileToUpload: File;

        // Extract audio client-side if supported (much smaller file size)
        if (useClientExtraction) {
          console.log(`[Transcribe] Extracting audio from clip ${i + 1} client-side...`);
          try {
            fileToUpload = await extractAudioFromVideo(clip.file, (progress) => {
              // Progress for extraction (first half of clip progress)
              setTranscribeProgress(baseProgress + (progress / clips.length) * 0.5);
            });
            console.log(`[Transcribe] Audio extracted: ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
          } catch (extractError) {
            console.warn(`[Transcribe] Client-side extraction failed, falling back to server:`, extractError);
            // Fall back to sending full video
            fileToUpload = clip.file;
          }
        } else {
          // Re-create File with guaranteed valid MIME type for iOS Safari compatibility
          fileToUpload = clip.file;
          if (!clip.file.type || clip.file.type === 'application/octet-stream') {
            const ext = clip.file.name.split('.').pop()?.toLowerCase();
            const mimeMap: Record<string, string> = {
              'mp4': 'video/mp4',
              'mov': 'video/quicktime',
              'webm': 'video/webm',
              'm4v': 'video/x-m4v',
              'hevc': 'video/mp4',
            };
            const mimeType = mimeMap[ext || ''] || 'video/mp4';
            fileToUpload = new File([clip.file], clip.file.name, { type: mimeType });
          }
        }

        const formData = new FormData();
        // Use "audio" key if we extracted audio, "video" if sending full video
        const fileKey = fileToUpload.type.startsWith('audio/') ? 'audio' : 'video';
        formData.append(fileKey, fileToUpload);

        // Add audio enhancement settings (only if sending video - audio is already clean)
        if (fileKey === 'video' && audioSettings.enhanceAudio) {
          formData.append("enhanceAudio", "true");
          formData.append("noiseReduction", String(audioSettings.noiseReduction));
          formData.append("noiseReductionStrength", audioSettings.noiseReductionStrength);
          formData.append("loudnessNormalization", String(audioSettings.loudnessNormalization));
        }

        setTranscribeProgress(baseProgress + (100 / clips.length) * 0.6);

        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        // Handle 413 (file too large) specifically
        if (response.status === 413) {
          const fileSizeMB = fileToUpload.size / (1024 * 1024);
          alert(`Clip ${i + 1} is too large (${fileSizeMB.toFixed(1)}MB). Try using a shorter clip.`);
          continue;
        }

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
        // Provide user-friendly error message
        let errorMsg = 'Unknown error';
        if (error instanceof Error) {
          // Safari-specific pattern matching error
          if (error.message.includes('did not match the expected pattern')) {
            errorMsg = 'Video format not supported. Try converting to MP4.';
          } else if (error.message.includes('Unexpected token') || error.message.includes('not valid JSON')) {
            errorMsg = 'Video file too large. Try compressing or using shorter clips.';
          } else {
            errorMsg = error.message;
          }
        }
        alert(`Failed to transcribe clip ${i + 1}: ${errorMsg}`);
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
    const video = getActiveVideoRef();
    if (video) {
      const clipStartTime = clips
        .slice(0, segment.clipIndex)
        .reduce((acc, clip) => acc + clip.duration, 0);
      video.currentTime = segment.start - clipStartTime;
    }
  };

  // Jump to word when clicked (for ScriptEditor)
  const handleWordClick = useCallback((word: TranscriptWord) => {
    setActiveClipIndex(word.clipIndex);
    const video = getActiveVideoRef();
    if (video) {
      const clipStartTime = clips
        .slice(0, word.clipIndex)
        .reduce((acc, clip) => acc + clip.duration, 0);
      video.currentTime = word.start - clipStartTime;
    }
  }, [clips, getActiveVideoRef]);

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
      <div className="lg:hidden flex items-center justify-center gap-1 bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-full mx-4 shadow-lg">
        <button
          onClick={() => setMobileTab('video')}
          className="relative flex-1 py-2.5 px-6 rounded-full text-sm font-medium transition-colors duration-200"
        >
          {mobileTab === 'video' && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-[#4A8FE7]/90 rounded-full shadow-lg shadow-[#4A8FE7]/25"
              transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
            />
          )}
          <span className={`relative z-10 ${mobileTab === 'video' ? 'text-white' : 'text-[#8E8E93]'}`}>
            Video
          </span>
        </button>
        <button
          onClick={() => setMobileTab('transcript')}
          className="relative flex-1 py-2.5 px-6 rounded-full text-sm font-medium transition-colors duration-200"
        >
          {mobileTab === 'transcript' && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-[#4A8FE7]/90 rounded-full shadow-lg shadow-[#4A8FE7]/25"
              transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
            />
          )}
          <span className={`relative z-10 ${mobileTab === 'transcript' ? 'text-white' : 'text-[#8E8E93]'}`}>
            Transcript
          </span>
        </button>
      </div>

      {/* Mobile Swipe Indicator */}
      <div className="lg:hidden flex justify-center gap-2 pb-2">
        <motion.div
          className="w-2 h-2 rounded-full bg-[#3A3A3C]"
          animate={{
            backgroundColor: mobileTab === 'video' ? '#4A8FE7' : '#3A3A3C',
            scale: mobileTab === 'video' ? 1.2 : 1
          }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
        />
        <motion.div
          className="w-2 h-2 rounded-full bg-[#3A3A3C]"
          animate={{
            backgroundColor: mobileTab === 'transcript' ? '#4A8FE7' : '#3A3A3C',
            scale: mobileTab === 'transcript' ? 1.2 : 1
          }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
        />
      </div>

      {/* Mobile Swipeable Content */}
      <div
        className="lg:hidden relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <motion.div
          className="flex"
          animate={{ x: mobileTab === 'video' ? '0%' : '-100%' }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Mobile Video Tab */}
          <div className="w-full flex-shrink-0 px-4">
            <MobileVideoPanel
              activeClip={clips[activeClipIndex]}
              videoRef={mobileVideoRef}
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
              onToggleCaptions={toggleCaptionPreview}
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
        </motion.div>
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
                    ref={desktopVideoRef}
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
            const video = getActiveVideoRef();
            if (video) {
              video.play().catch((e) => {
                if (e.name !== 'AbortError') console.error('Video play error:', e);
              });
              setIsPlaying(true);
            }
          }}
          onPause={() => {
            const video = getActiveVideoRef();
            if (video) {
              video.pause();
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
  onOpenTextDrawer,
  onOpenStickerDrawer,
  onOpenFilterDrawer,
  onOpenCaptionsDrawer,
  onToggleCaptions,
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
  onOpenTextDrawer?: () => void;
  onOpenStickerDrawer?: () => void;
  onOpenFilterDrawer?: () => void;
  onOpenCaptionsDrawer?: () => void;
  onToggleCaptions?: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="overflow-hidden rounded-md border border-[var(--border-subtle)] relative">
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

        {/* TikTok-style floating icons on right side */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-4">
          {/* Text */}
          <button
            onClick={onOpenTextDrawer}
            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 active:scale-95 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M12 6v14M8 6v2M16 6v2" />
            </svg>
          </button>

          {/* Stickers */}
          <button
            onClick={onOpenStickerDrawer}
            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 active:scale-95 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
            </svg>
          </button>

          {/* Filters */}
          <button
            onClick={onOpenFilterDrawer}
            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 active:scale-95 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </button>

          {/* Captions Toggle */}
          <button
            onClick={onToggleCaptions}
            className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center hover:bg-black/40 active:scale-95 transition-all ${
              overlayState.showCaptionPreview
                ? 'bg-white/90 text-black'
                : 'bg-black/20 text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path strokeLinecap="round" d="M6 12h4M14 12h4M6 16h8" />
            </svg>
          </button>
        </div>
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
  clips: { file: File | null }[];
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
