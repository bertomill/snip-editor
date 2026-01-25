"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { captionTemplates } from "@/lib/caption-templates";
import {
  OverlayProvider,
  useOverlay,
  ActiveOverlayList,
} from "@/components/overlays";
import { getFilterById } from "@/lib/templates/filter-presets";
import { getTextStyleById } from "@/lib/templates/text-templates";
import { TextOverlay, StickerOverlay } from "@/types/overlays";
import { generateAutoTransitions, generateInternalCutTransitions, CutPoint } from "@/lib/transitions/auto-transitions";
import { useUser, useSignOut } from "@/lib/supabase/hooks";
import { Timeline, TimelineTrack, TrackItemType } from "@/components/timeline";
import { generateScriptTrack } from "@/components/timeline/utils/generate-script-track";
import { generateCollapsedTracks } from "@/components/timeline/utils/generate-collapsed-tracks";
import { ScriptEditor } from "@/components/script-editor";
import { TranscriptWord } from "@/lib/types/composition";
import { MediaLibraryPanel } from "@/components/media-library";
import { MediaLibraryProvider } from "@/contexts/MediaLibraryContext";
import { MediaFile } from "@/types/media";
import { CaptionPreview } from "@/components/CaptionPreview";
import { TextOverlayPreview } from "@/components/TextOverlayPreview";
import { StickerOverlayPreview } from "@/components/StickerOverlayPreview";
import { ProjectsProvider, useProjects } from "@/contexts/ProjectsContext";
import { ProjectFeed } from "@/components/projects";
import { ProjectData } from "@/types/project";
import { ResizableBottomPanel } from "@/components/ResizableBottomPanel";
import VideoProcessingLoader, { VideoProcessingLoaderCompact } from "@/components/VideoProcessingLoader";
import { Sidebar } from "@/components/Sidebar";
import { AIChatInput } from "@/components/AIChatInput";
import { VapiVoiceButton } from "@/components/VapiVoiceButton";
import { extractAudioFromVideo, isFFmpegSupported } from "@/lib/audio/extract-audio";
import { SilenceSegment, SilenceDetectionOptions } from "@/types/silence";

type AppView = "feed" | "editor";
type EditorStep = "upload" | "edit" | "export";

// Generate a smart project name from video filename
function generateProjectName(filename: string): string {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

  // Clean up common patterns
  const cleaned = nameWithoutExt
    // Replace underscores and dashes with spaces
    .replace(/[_-]/g, ' ')
    // Remove common video prefixes/suffixes
    .replace(/^(vid|video|clip|mov|img|dsc|dcim|screen.?record(ing)?)\s*/i, '')
    .replace(/\s*(final|edit|v\d+|copy|hd|4k|1080p|720p)$/i, '')
    // Remove timestamps like 2024-01-15 or 20240115
    .replace(/\d{4}[-_]?\d{2}[-_]?\d{2}/g, '')
    // Remove time patterns like 10-30-45 or 103045
    .replace(/\d{2}[-_]?\d{2}[-_]?\d{2}/g, '')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  // If result is empty or just numbers, use date-based name
  if (!cleaned || /^\d*$/.test(cleaned)) {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'short' });
    const day = now.getDate();
    return `Project ${month} ${day}`;
  }

  // Capitalize first letter of each word
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

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
  storagePath?: string;        // path in Supabase storage for transcription
  uploadStatus?: 'pending' | 'uploading' | 'complete' | 'error';  // storage upload status
  // Silence detection data for AutoCut
  silenceSegments?: SilenceSegment[];
  totalSilenceDuration?: number;
  audioDuration?: number;
  volume?: number;             // Audio volume (0-1, default 1)
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
  // View switching state - default to editor (upload screen)
  const [view, setView] = useState<AppView>("editor");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showProjectsDrawer, setShowProjectsDrawer] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Social connections state
  const [xConnection, setXConnection] = useState<{ connected: boolean; username?: string } | null>(null);
  const [xPosts, setXPosts] = useState<Array<{ id: string; text: string; likes: number }>>([]);
  const [youtubeConnection, setYoutubeConnection] = useState<{ connected: boolean; channelName?: string } | null>(null);
  const [youtubeVideos, setYoutubeVideos] = useState<Array<{ id: string; title: string; views: number; likes: number; engagementRate: number }>>([]);
  const [instagramConnection, setInstagramConnection] = useState<{ connected: boolean; username?: string } | null>(null);
  const [showPlatformRequest, setShowPlatformRequest] = useState(false);
  const [platformRequestInput, setPlatformRequestInput] = useState('');
  const [platformRequestSubmitting, setPlatformRequestSubmitting] = useState(false);
  const [showXConnectedModal, setShowXConnectedModal] = useState(false);

  // Editor state
  const [step, setStep] = useState<EditorStep>("upload");
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [deletedSegments, setDeletedSegments] = useState<Set<number>>(new Set());
  const [deletedWordIds, setDeletedWordIds] = useState<Set<string>>(new Set());
  const [deletedPauseIds, setDeletedPauseIds] = useState<Set<string>>(new Set());
  const [showUploads, setShowUploads] = useState(false);
  const [autoTriggerUpload, setAutoTriggerUpload] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isEditingName, setIsEditingName] = useState(false);
  const [autoCutEnabled, setAutoCutEnabled] = useState(false);
  const [silenceAggressiveness, setSilenceAggressiveness] = useState<SilenceDetectionOptions['aggressiveness']>('natural');
  const [customInstructions, setCustomInstructions] = useState("");

  // AutoCut processing state for loading overlay
  const [autoCutProcessing, setAutoCutProcessing] = useState<{
    active: boolean;
    status: 'preparing' | 'converting' | 'transcribing' | 'detecting' | 'applying' | 'done';
    currentClip: number;
    totalClips: number;
    message: string;
  } | null>(null);

  // Video loading state - shows loading animation while video buffers
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  // Mobile transcript drawer state (hoisted from EditStep for Sidebar access)
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false);

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

  // Export drawer state
  const [showExportDrawer, setShowExportDrawer] = useState(false);
  const [exportSettings, setExportSettings] = useState<{
    resolution: '720p' | '1080p' | '4k';
    destination: 'device' | 'tiktok' | 'instagram' | 'youtube';
  }>({ resolution: '1080p', destination: 'device' });

  const { createProject, updateProject, projects, refreshProjects } = useProjects();
  const { state: overlayState, loadState: loadOverlayState, resetOverlays, addTextOverlay, addSticker } = useOverlay();
  const { user } = useUser();
  const signOut = useSignOut();
  const router = useRouter();

  // Track changes
  useEffect(() => {
    if (view === "editor" && (clips.length > 0 || deletedWordIds.size > 0 || deletedPauseIds.size > 0)) {
      setHasUnsavedChanges(true);
    }
  }, [clips.length, deletedWordIds.size, deletedPauseIds.size, view]);

  // Fetch X connection status and posts
  useEffect(() => {
    if (user) {
      fetch('/api/auth/x/status')
        .then(res => res.json())
        .then(data => {
          setXConnection(data);
          // If connected, fetch their posts for AI context
          if (data.connected) {
            fetch('/api/x/posts')
              .then(res => res.json())
              .then(postsData => {
                if (postsData.posts) {
                  setXPosts(postsData.posts);
                }
              })
              .catch(() => setXPosts([]));
          }
        })
        .catch(() => setXConnection({ connected: false }));
    }
  }, [user]);

  // Detect social connection success from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const socialConnected = params.get('social_connected');
    if (socialConnected === 'x') {
      setShowXConnectedModal(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Fetch YouTube connection status and videos
  useEffect(() => {
    if (user) {
      fetch('/api/auth/youtube/status')
        .then(res => res.json())
        .then(data => {
          setYoutubeConnection(data);
          // If connected, fetch their videos for AI context
          if (data.connected) {
            fetch('/api/youtube/videos')
              .then(res => res.json())
              .then(videosData => {
                if (videosData.topPerforming) {
                  setYoutubeVideos(videosData.topPerforming);
                }
              })
              .catch(() => setYoutubeVideos([]));
          }
        })
        .catch(() => setYoutubeConnection({ connected: false }));
    }
  }, [user]);

  // Fetch Instagram connection status
  useEffect(() => {
    if (user) {
      fetch('/api/auth/instagram/status')
        .then(res => res.json())
        .then(data => {
          setInstagramConnection(data);
        })
        .catch(() => setInstagramConnection({ connected: false }));
    }
  }, [user]);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('snip-theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.add('light-mode');
    }
  }, []);

  // Toggle theme function
  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.remove('light-mode');
      localStorage.setItem('snip-theme', 'dark');
    } else {
      document.documentElement.classList.add('light-mode');
      localStorage.setItem('snip-theme', 'light');
    }
  };

  // Handle X connection
  const handleConnectX = async () => {
    try {
      const res = await fetch('/api/auth/x');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to connect X:', error);
    }
  };

  // Handle X disconnect
  const handleDisconnectX = async () => {
    try {
      await fetch('/api/auth/x/status', { method: 'DELETE' });
      setXConnection({ connected: false });
    } catch (error) {
      console.error('Failed to disconnect X:', error);
    }
  };

  // Handle YouTube connection
  const handleConnectYouTube = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      const res = await fetch('/api/auth/youtube');
      const data = await res.json();
      if (data.error === 'Unauthorized') {
        router.push('/login');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to connect YouTube:', error);
    }
  };

  // Handle YouTube disconnect
  const handleDisconnectYouTube = async () => {
    try {
      await fetch('/api/auth/youtube/status', { method: 'DELETE' });
      setYoutubeConnection({ connected: false });
      setYoutubeVideos([]);
    } catch (error) {
      console.error('Failed to disconnect YouTube:', error);
    }
  };

  // Handle Instagram connection
  const handleConnectInstagram = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      const res = await fetch('/api/auth/instagram');
      const data = await res.json();
      if (data.error === 'Unauthorized') {
        router.push('/login');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to connect Instagram:', error);
    }
  };

  // Handle Instagram disconnect
  const handleDisconnectInstagram = async () => {
    try {
      await fetch('/api/auth/instagram/status', { method: 'DELETE' });
      setInstagramConnection({ connected: false });
    } catch (error) {
      console.error('Failed to disconnect Instagram:', error);
    }
  };

  // Handle platform request submission
  const handlePlatformRequest = async () => {
    if (!platformRequestInput.trim()) return;

    setPlatformRequestSubmitting(true);
    try {
      const res = await fetch('/api/platform-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platformRequestInput.trim() }),
      });

      if (res.ok) {
        setPlatformRequestInput('');
        setShowPlatformRequest(false);
      }
    } catch (error) {
      console.error('Failed to submit platform request:', error);
    } finally {
      setPlatformRequestSubmitting(false);
    }
  };

  // Handle creating a new project (local only - not saved to DB until user saves)
  const handleCreateProject = useCallback(async () => {
    // Redirect to login if not authenticated
    if (!user) {
      router.push('/login');
      return;
    }

    // Don't create in database yet - just set up local state
    // Project will be created when user explicitly saves
    setCurrentProjectId(null); // No DB record yet
    setProjectName('Untitled Project');
    setStep("upload");
    setAutoTriggerUpload(true);
    setClips([]);
    setDeletedSegments(new Set());
    setDeletedWordIds(new Set());
    setDeletedPauseIds(new Set());
    setHasUnsavedChanges(false);
    savedClipNames.current = new Set();
    resetOverlays();
    setView("editor");
  }, [user, router, resetOverlays]);

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
    setAutoTriggerUpload(false);
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
    // Optimistic: mark as saved immediately
    setHasUnsavedChanges(false);
    setIsSaving(true);

    try {
      // If no project exists in DB yet, create it first
      let projectId = currentProjectId;
      if (!projectId) {
        const project = await createProject(projectName || 'Untitled Project');
        if (!project) {
          throw new Error('Failed to create project');
        }
        projectId = project.id;
        setCurrentProjectId(projectId);
      }

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
      const metadataPromise = fetch(`/api/projects/${projectId}`, {
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

        clipsPromise = fetch(`/api/projects/${projectId}/clips`, {
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
  }, [currentProjectId, projectName, createProject, clips, deletedWordIds, deletedPauseIds, overlayState]);

  // Handle starting a new project - reset to upload step
  const handleNewProject = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowExitDialog(true);
    } else {
      refreshProjects(); // Refresh to get updated thumbnails
      // Reset to upload step
      setStep("upload");
      setClips([]);
      setDeletedSegments(new Set());
      setDeletedWordIds(new Set());
      setDeletedPauseIds(new Set());
      setProjectName("Untitled Project");
      setCurrentProjectId(null);
      setAutoTriggerUpload(false);
    }
  }, [hasUnsavedChanges, refreshProjects]);

  // Save and exit
  const handleSaveAndExit = useCallback(async () => {
    await saveProject();
    setShowExitDialog(false);
    refreshProjects(); // Refresh to get updated thumbnails
    // Reset to upload step
    setStep("upload");
    setClips([]);
    setDeletedSegments(new Set());
    setDeletedWordIds(new Set());
    setDeletedPauseIds(new Set());
    setProjectName("Untitled Project");
    setCurrentProjectId(null);
  }, [saveProject, refreshProjects]);

  // Discard and exit
  const handleDiscardAndExit = useCallback(() => {
    setShowExitDialog(false);
    setHasUnsavedChanges(false);
    refreshProjects(); // Refresh to get updated thumbnails
    // Reset to upload step
    setStep("upload");
    setClips([]);
    setDeletedSegments(new Set());
    setDeletedWordIds(new Set());
    setDeletedPauseIds(new Set());
    setProjectName("Untitled Project");
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
            volume: clip.volume ?? 1,
            silenceSegments: clip.silenceSegments || [],
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

  // Upload a video using presigned URL (bypasses Vercel's 4.5MB API limit completely)
  const uploadVideoToStorage = useCallback(async (clipIndex: number, file: File) => {
    try {
      // Update status to uploading
      setClips(prev => prev.map((clip, idx) =>
        idx === clipIndex ? { ...clip, uploadStatus: 'uploading' as const } : clip
      ));

      console.log(`[Upload] Getting presigned URL for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // Step 1: Get presigned upload URL from server (tiny request)
      const presignedResponse = await fetch('/api/storage/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'video/mp4',
          folder: 'transcribe',
        }),
      });

      if (!presignedResponse.ok) {
        const error = await presignedResponse.json();
        throw new Error(`Failed to get upload URL: ${error.error || presignedResponse.statusText}`);
      }

      const { uploadUrl, storagePath } = await presignedResponse.json();
      console.log(`[Upload] Got presigned URL, uploading to: ${storagePath}`);

      // Step 2: Upload directly to Supabase using presigned URL (bypasses Vercel)
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'video/mp4',
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Storage upload failed: ${uploadResponse.statusText}`);
      }

      // Update clip with storage path
      setClips(prev => prev.map((clip, idx) =>
        idx === clipIndex ? {
          ...clip,
          storagePath: storagePath,
          uploadStatus: 'complete' as const
        } : clip
      ));

      console.log(`[Upload] Clip ${clipIndex} uploaded to storage: ${storagePath}`);
    } catch (error) {
      console.error(`[Upload] Failed to upload clip ${clipIndex}:`, error);
      // Mark as error but don't block - fallback to direct upload
      setClips(prev => prev.map((clip, idx) =>
        idx === clipIndex ? { ...clip, uploadStatus: 'error' as const } : clip
      ));
    }
  }, []);

  const handleFilesSelected = async (files: File[], autoCut: boolean = false) => {
    setAutoTriggerUpload(false);
    setStep("edit");
    setAutoCutEnabled(autoCut);

    // Check which files need conversion upfront
    const filesNeedingConversion = files.filter(file => {
      const filename = file.name.toLowerCase();
      return filename.endsWith('.mov') || filename.endsWith('.hevc') || file.type === 'video/quicktime';
    });
    const hasConversions = filesNeedingConversion.length > 0;

    // Initialize AutoCut processing overlay if enabled
    if (autoCut) {
      setAutoCutProcessing({
        active: true,
        status: hasConversions ? 'converting' : 'preparing',
        currentClip: hasConversions ? 1 : 0,
        totalClips: hasConversions ? filesNeedingConversion.length : files.length,
        message: hasConversions
          ? `Converting video for preview (1/${filesNeedingConversion.length})...`
          : 'Preparing your clips...'
      });
    }

    // Process files sequentially if conversion needed (for progress updates)
    const videoClips: VideoClip[] = [];
    let conversionCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

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

      // Check if file needs conversion for browser preview (MOV/HEVC)
      const filename = processedFile.name.toLowerCase();
      const needsConversion = filename.endsWith('.mov') || filename.endsWith('.hevc') || processedFile.type === 'video/quicktime';

      let url: string;
      if (needsConversion) {
        conversionCount++;
        // Update progress for conversion
        if (autoCut) {
          setAutoCutProcessing(prev => prev ? {
            ...prev,
            status: 'converting',
            currentClip: conversionCount,
            totalClips: filesNeedingConversion.length,
            message: `Converting video for preview (${conversionCount}/${filesNeedingConversion.length})...`
          } : null);
        }

        // Convert for browser preview
        try {
          const formData = new FormData();
          formData.append('video', processedFile);
          const response = await fetch('/api/convert-preview', {
            method: 'POST',
            body: formData,
          });
          if (response.ok) {
            const data = await response.json();
            url = data.url;
          } else {
            // Fallback to blob URL (will show error but transcription still works)
            url = URL.createObjectURL(processedFile);
          }
        } catch {
          // Fallback to blob URL
          url = URL.createObjectURL(processedFile);
        }
      } else {
        url = URL.createObjectURL(processedFile);
      }

      const duration = await getVideoDuration(url);
      // Initialize with pending upload status for large files
      const shouldUploadToStorage = processedFile.size > 4 * 1024 * 1024; // >4MB
      videoClips.push({
        file: processedFile,
        url,
        duration,
        blobReady: true,
        uploadStatus: shouldUploadToStorage ? 'pending' as const : undefined,
      });
    }

    // Update status after conversion is done
    if (autoCut && hasConversions) {
      setAutoCutProcessing(prev => prev ? {
        ...prev,
        status: 'preparing',
        currentClip: 0,
        totalClips: files.length,
        message: 'Preparing your clips...'
      } : null);
    }

    setClips(videoClips);

    // Auto-generate project name from first video filename if still untitled
    if (projectName === "Untitled Project" && files.length > 0) {
      const suggestedName = generateProjectName(files[0].name);
      setProjectName(suggestedName);
      // Also update the project in the database if we have one
      if (currentProjectId) {
        fetch(`/api/projects/${currentProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: suggestedName }),
        }).catch(console.error);
      }
    }

    // Start background upload for large files
    videoClips.forEach((clip, index) => {
      if (clip.uploadStatus === 'pending' && clip.file) {
        uploadVideoToStorage(index, clip.file);
      }
    });
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

  // Main editor view (upload is the landing page)
  return (
    <MediaLibraryProvider>
      <MediaLibraryPanel
        isOpen={showUploads}
        onClose={() => setShowUploads(false)}
        onSelectMedia={handleAddMediaToTimeline}
      />

      {/* Projects Drawer */}
      <AnimatePresence>
        {showProjectsDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowProjectsDrawer(false); setShowAccountMenu(false); }}
              className="fixed inset-0 z-[90] bg-black/40"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 z-[95] w-80 max-w-[85vw] bg-[var(--background-card)] border-r border-[var(--border)] overflow-hidden flex flex-col"
            >
              {/* Drawer Header with Snip Logo and Close Button */}
              <div className="flex items-center justify-between px-5 py-4">
                {/* Snip Mascot and Logo */}
                <div className="flex items-center gap-2">
                  <div className="w-[60px] h-[60px] rounded-full bg-[#1e2536] flex items-center justify-center">
                    <img
                      src="/snip-removebg.png"
                      alt="Snip mascot"
                      className="w-[50px] h-[50px] object-contain"
                    />
                  </div>
                  <motion.div
                    className="cursor-pointer font-bold text-3xl tracking-widest text-white italic leading-none flex items-center"
                    style={{
                      textShadow: `
                        2px 2px 0px #07bccc,
                        4px 4px 0px #e601c0,
                        6px 6px 0px #e9019a,
                        8px 8px 0px #f40468,
                        12px 12px 6px rgba(244, 4, 104, 0.3)
                      `,
                    }}
                    whileHover={{
                      textShadow: "none",
                    }}
                    transition={{
                      duration: 0.2,
                      ease: "easeOut",
                    }}
                  >
                    snip
                  </motion.div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => { setShowProjectsDrawer(false); setShowAccountMenu(false); }}
                  className="p-1.5 -mr-1.5 rounded-lg hover:bg-[var(--background-elevated)] transition-colors"
                >
                  <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Projects List */}
              <div className="flex-1 overflow-y-auto">
                <ProjectFeed
                  onSelectProject={(project) => {
                    handleSelectProject(project);
                    setShowProjectsDrawer(false);
                  }}
                  onCreateProject={() => {
                    handleCreateProject();
                    setShowProjectsDrawer(false);
                  }}
                  searchQuery=""
                  onSearchChange={() => {}}
                  viewMode="list"
                  isSelectMode={false}
                  selectedProjectIds={new Set()}
                  onToggleSelectProject={() => {}}
                  onCancelSelection={() => {}}
                  onBulkDelete={async () => {}}
                  compact
                />
              </div>

              {/* Let Snip get to know you Section */}
              <div className="px-4 py-4 border-t border-[var(--border)]">
                <p className="text-[#636366] text-xs font-medium uppercase tracking-wider mb-3">Let Snip get to know you</p>
                <div className="space-y-1">
                  {/* YouTube */}
                  <button
                    onClick={youtubeConnection?.connected ? handleDisconnectYouTube : handleConnectYouTube}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--background-elevated)] transition-colors group"
                  >
                    <div className="relative w-8 h-8 rounded-lg bg-[#FF0000] flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      {/* Green checkmark badge when connected */}
                      {youtubeConnection?.connected && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-[var(--background-card)]">
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-white text-sm font-medium">YouTube</span>
                      {youtubeConnection?.connected && youtubeConnection.channelName && (
                        <p className="text-[#636366] text-xs">{youtubeConnection.channelName}</p>
                      )}
                    </div>
                    {youtubeConnection?.connected ? (
                      <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Connected
                      </span>
                    ) : (
                      <span className="ml-auto text-xs text-[#636366] group-hover:text-white">Connect</span>
                    )}
                  </button>
                  {/* Instagram */}
                  <button
                    onClick={instagramConnection?.connected ? handleDisconnectInstagram : handleConnectInstagram}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--background-elevated)] transition-colors group"
                  >
                    <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      {/* Green checkmark badge when connected */}
                      {instagramConnection?.connected && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-[var(--background-card)]">
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-white text-sm font-medium">Instagram</span>
                      {instagramConnection?.connected && instagramConnection.username && (
                        <p className="text-[#636366] text-xs">@{instagramConnection.username}</p>
                      )}
                    </div>
                    {instagramConnection?.connected ? (
                      <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Connected
                      </span>
                    ) : (
                      <span className="ml-auto text-xs text-[#636366] group-hover:text-white">Connect</span>
                    )}
                  </button>
                  {/* X (Twitter) */}
                  <button
                    onClick={xConnection?.connected ? handleDisconnectX : handleConnectX}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--background-elevated)] transition-colors group"
                  >
                    <div className="relative w-8 h-8 rounded-lg flex items-center justify-center bg-black">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      {/* Green checkmark badge when connected */}
                      {xConnection?.connected && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-[var(--background-card)]">
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-white text-sm font-medium">X</span>
                      {xConnection?.connected && xConnection.username && (
                        <p className="text-[#636366] text-xs">@{xConnection.username}</p>
                      )}
                    </div>
                    {xConnection?.connected ? (
                      <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Connected
                      </span>
                    ) : (
                      <span className="ml-auto text-xs text-[#636366] group-hover:text-white">Connect</span>
                    )}
                  </button>
                </div>

                {/* More coming soon & Request a platform */}
                <div className="mt-4 pt-3 border-t border-[var(--border)]/50">
                  <p className="text-[#636366] text-xs mb-2">More platforms coming soon</p>
                  {!showPlatformRequest ? (
                    <button
                      onClick={() => setShowPlatformRequest(true)}
                      className="text-[#4A8FE7] text-xs hover:text-[#6BA3EC] transition-colors"
                    >
                      Request a platform
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={platformRequestInput}
                        onChange={(e) => setPlatformRequestInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePlatformRequest()}
                        placeholder="e.g., Snapchat, LinkedIn..."
                        className="flex-1 px-2 py-1.5 text-xs bg-[var(--background-elevated)] border border-[var(--border)] rounded-md text-white placeholder-[#636366] focus:outline-none focus:border-[#4A8FE7]"
                        autoFocus
                      />
                      <button
                        onClick={handlePlatformRequest}
                        disabled={platformRequestSubmitting || !platformRequestInput.trim()}
                        className="px-2 py-1.5 text-xs bg-[#4A8FE7] text-white rounded-md hover:bg-[#6BA3EC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {platformRequestSubmitting ? '...' : 'Send'}
                      </button>
                      <button
                        onClick={() => {
                          setShowPlatformRequest(false);
                          setPlatformRequestInput('');
                        }}
                        className="px-2 py-1.5 text-xs text-[#636366] hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Settings Section - Feedback & Theme */}
              <div className="px-4 py-3 border-t border-[var(--border)]">
                <div className="space-y-1">
                  {/* Feedback */}
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--background-elevated)] transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#4A8FE7]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#4A8FE7]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <span className="text-white text-sm font-medium">Feedback</span>
                  </button>

                  {/* Light/Dark Mode Toggle */}
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--background-elevated)] transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#8E8E93]/10 flex items-center justify-center">
                      {isDarkMode ? (
                        <svg className="w-4 h-4 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-white text-sm font-medium">{isDarkMode ? 'Dark mode' : 'Light mode'}</span>
                  </button>
                </div>
              </div>

              {/* User Account Section */}
              {user && (
                <div className="border-t border-[var(--border)]">
                  <button
                    onClick={() => setShowAccountMenu(!showAccountMenu)}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[var(--background-elevated)] transition-colors group"
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a] flex items-center justify-center text-white font-semibold text-base flex-shrink-0">
                      {user.user_metadata?.avatar_url ? (
                        <img
                          src={user.user_metadata.avatar_url}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        user.email?.[0].toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-white font-medium text-base truncate">
                        {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                      </p>
                      <p className="text-[#8E8E93] text-sm truncate">
                        {user.email}
                      </p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-[#636366] group-hover:text-white transition-all flex-shrink-0 ${showAccountMenu ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Account Menu Options */}
                  {showAccountMenu && (
                    <div className="px-4 pb-3 space-y-1">
                      <button
                        onClick={() => {
                          signOut();
                          setShowProjectsDrawer(false);
                          setShowAccountMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9" />
                        </svg>
                        <span className="text-sm">Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Login Button - shown when not logged in */}
              {!user && (
                <div className="border-t border-[var(--border)]">
                  <a
                    href="/login"
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[var(--background-elevated)] transition-colors group"
                  >
                    <div className="w-11 h-11 rounded-full bg-[#4A8FE7]/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#4A8FE7]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium text-base">Sign in</p>
                      <p className="text-[#8E8E93] text-sm">Log in to save your projects</p>
                    </div>
                    <svg
                      className="w-4 h-4 text-[#636366] group-hover:text-white transition-all flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

        <div className="min-h-screen flex flex-col bg-canva-gradient pb-24 md:pb-0 relative">
        <header className="z-[200] flex items-center justify-between px-3 sm:px-8 pt-4 pb-2 sm:py-4 bg-transparent fixed top-0 left-0 right-0">
          <div className="flex items-center gap-1">
            {/* Hamburger menu for projects */}
            <button
              onClick={() => setShowProjectsDrawer(true)}
              className="p-2 -ml-2 rounded-lg text-white hover:bg-white/10 transition-colors"
              title="Projects"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* New Project button - only shown when editing */}
            {step === "edit" && (
              <button
                onClick={handleNewProject}
                className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                title="New Project"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
          {step === "edit" && (
            <div className="flex items-center gap-1.5 sm:gap-3">
              <button
                onClick={saveProject}
                disabled={isSaving || !hasUnsavedChanges}
                className={`text-xs sm:text-sm px-3 sm:px-5 py-2 sm:py-2.5 rounded-full backdrop-blur-xl font-medium disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 transition-all duration-300 ${
                  showSaveSuccess
                    ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30'
                    : 'bg-white/10 text-white border border-white/20 hover:bg-white/15 hover:border-[#00D4FF]/30'
                }`}
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
                    <span className="hidden sm:inline">Saving...</span>
                  </>
                ) : showSaveSuccess ? (
                  <>
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00D4FF] animate-scale-in"
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
                    <span className="hidden sm:inline">Saved</span>
                  </>
                ) : (
                  <>
                    {hasUnsavedChanges ? "Save" : "Saved"}
                  </>
                )}
              </button>
              <button
                onClick={() => setShowExportDrawer(true)}
                disabled={exportState.status !== 'idle' && exportState.status !== 'done' && exportState.status !== 'error'}
                className="relative text-xs sm:text-sm px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-[#FF0080] text-white font-semibold shadow-[0_0_20px_rgba(255,0,128,0.4),2px_2px_0px_#00D4FF] hover:shadow-[0_0_25px_rgba(255,0,128,0.5),3px_3px_0px_#00D4FF] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportState.status !== 'idle' && exportState.status !== 'done' && exportState.status !== 'error'
                  ? 'Exporting...'
                  : 'Export'}
              </button>
            </div>
          )}
        </header>

        <main className={`flex-1 flex flex-col relative z-0 ${step === "upload" ? "items-center justify-center p-4 sm:p-6" : "p-0"}`}>
          {step === "upload" && (
            <UploadStep
              onFilesSelected={handleFilesSelected}
              autoTrigger={autoTriggerUpload}
              silenceAggressiveness={silenceAggressiveness}
              setSilenceAggressiveness={setSilenceAggressiveness}
              customInstructions={customInstructions}
              setCustomInstructions={setCustomInstructions}
              user={user}
            />
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
              silenceAggressiveness={silenceAggressiveness}
              autoCutProcessing={autoCutProcessing}
              setAutoCutProcessing={setAutoCutProcessing}
              showTranscriptDrawer={showTranscriptDrawer}
              setShowTranscriptDrawer={setShowTranscriptDrawer}
              setHasUnsavedChanges={setHasUnsavedChanges}
              xPosts={xPosts}
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

        {/* Export Settings Drawer */}
        <ExportDrawer
          isOpen={showExportDrawer}
          onClose={() => setShowExportDrawer(false)}
          settings={exportSettings}
          onSettingsChange={setExportSettings}
          onExport={() => {
            setShowExportDrawer(false);
            startBackgroundExport();
          }}
          isExporting={exportState.status !== 'idle' && exportState.status !== 'done' && exportState.status !== 'error'}
        />

        {/* Feedback Modal */}
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          userEmail={user?.email}
        />

        {/* X Connected Success Modal */}
        <XConnectedModal
          isOpen={showXConnectedModal}
          onClose={() => setShowXConnectedModal(false)}
          username={xConnection?.username}
        />
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

// Export Settings Drawer Component
function ExportDrawer({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onExport,
  isExporting,
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: { resolution: '720p' | '1080p' | '4k'; destination: 'device' | 'tiktok' | 'instagram' | 'youtube' };
  onSettingsChange: (settings: { resolution: '720p' | '1080p' | '4k'; destination: 'device' | 'tiktok' | 'instagram' | 'youtube' }) => void;
  onExport: () => void;
  isExporting: boolean;
}) {
  const [showResolutionPicker, setShowResolutionPicker] = useState(false);

  const resolutionOptions = [
    { value: '720p', label: '720p HD', description: 'Smaller file size' },
    { value: '1080p', label: '1080p Full HD', description: 'Recommended' },
    { value: '4k', label: '4K Ultra HD', description: 'Best quality' },
  ] as const;

  const destinationOptions = [
    {
      value: 'device',
      label: 'Save to device',
      description: 'Download to your device',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      ),
      comingSoon: false
    },
    {
      value: 'tiktok',
      label: 'Share to TikTok',
      description: 'Optimized for TikTok',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
        </svg>
      ),
      comingSoon: true
    },
    {
      value: 'instagram',
      label: 'Share to Instagram',
      description: 'Optimized for Reels',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      comingSoon: true
    },
    {
      value: 'youtube',
      label: 'Share to YouTube',
      description: 'Optimized for Shorts',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
      comingSoon: true
    },
  ] as const;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#1C1C1E] rounded-t-3xl animate-slide-up safe-area-bottom max-h-[85vh] overflow-hidden flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4 border-b border-[#2C2C2E] flex-shrink-0">
          {/* Resolution Picker */}
          <button
            onClick={() => setShowResolutionPicker(!showResolutionPicker)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2C2C2E] rounded-full text-white text-sm font-medium hover:bg-[#3C3C3E] transition-colors"
          >
            {settings.resolution}
            <svg className={`w-4 h-4 transition-transform ${showResolutionPicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <h2 className="text-white font-semibold text-lg">Export settings</h2>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Resolution Picker Dropdown */}
        {showResolutionPicker && (
          <div className="absolute top-20 left-4 w-56 bg-[#2C2C2E] border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden animate-scale-in">
            {resolutionOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSettingsChange({ ...settings, resolution: option.value });
                  setShowResolutionPicker(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                  settings.resolution === option.value
                    ? 'bg-[#4A8FE7]/20 text-[#4A8FE7]'
                    : 'text-white hover:bg-white/5'
                }`}
              >
                <div>
                  <p className="font-medium text-sm">{option.label}</p>
                  <p className="text-xs text-[#8E8E93]">{option.description}</p>
                </div>
                {settings.resolution === option.value && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Destination Options */}
          <div className="space-y-3">
            {destinationOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => !option.comingSoon && onSettingsChange({ ...settings, destination: option.value })}
                disabled={option.comingSoon}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                  settings.destination === option.value && !option.comingSoon
                    ? 'bg-white text-black'
                    : option.comingSoon
                      ? 'bg-[#2C2C2E] text-white/50 cursor-not-allowed'
                      : 'bg-[#2C2C2E] text-white hover:bg-[#3C3C3E]'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  settings.destination === option.value && !option.comingSoon
                    ? 'bg-black/10'
                    : 'bg-white/10'
                }`}>
                  {option.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{option.label}</p>
                  <p className={`text-sm ${
                    settings.destination === option.value && !option.comingSoon
                      ? 'text-black/60'
                      : 'text-[#8E8E93]'
                  }`}>
                    {option.comingSoon ? 'Coming soon' : option.description}
                  </p>
                </div>
                {settings.destination === option.value && !option.comingSoon && (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Info text */}
          <p className="text-[#636366] text-xs mt-4 text-center">
            Video will be exported in 9:16 vertical format
          </p>
        </div>

        {/* Export Button */}
        <div className="px-4 pb-6 pt-4 border-t border-[#2C2C2E] flex-shrink-0">
          <button
            onClick={onExport}
            disabled={isExporting}
            className="w-full py-4 rounded-xl bg-[#4A8FE7] text-white text-base font-semibold hover:bg-[#3A7FD7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Export Video
              </>
            )}
          </button>
        </div>
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
  autoTrigger = false,
  silenceAggressiveness,
  setSilenceAggressiveness,
  customInstructions,
  setCustomInstructions,
  user,
}: {
  onFilesSelected: (files: File[], autoCut?: boolean) => void;
  autoTrigger?: boolean;
  silenceAggressiveness: SilenceDetectionOptions['aggressiveness'];
  setSilenceAggressiveness: (value: SilenceDetectionOptions['aggressiveness']) => void;
  customInstructions: string;
  setCustomInstructions: (value: string) => void;
  user: import('@supabase/supabase-js').User | null;
}) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasTriggered = useRef(false);
  const clipsScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll clips to the right when files change
  useEffect(() => {
    if (clipsScrollRef.current && selectedFiles.length > 0) {
      setTimeout(() => {
        clipsScrollRef.current?.scrollTo({
          left: clipsScrollRef.current.scrollWidth,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [selectedFiles.length]);

  // Auto-trigger file picker on mount when autoTrigger is true
  useEffect(() => {
    if (autoTrigger && !hasTriggered.current && fileInputRef.current) {
      hasTriggered.current = true;
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    }
  }, [autoTrigger]);

  // Handle upload button click - require authentication
  const handleUploadClick = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    fileInputRef.current?.click();
  };

  // Generate thumbnail and get duration for a video file
  const processFile = async (file: File): Promise<SelectedFile> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.src = url;
      video.preload = 'auto'; // Load more data for better compatibility
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      let resolved = false;
      let seekAttempt = 0;
      const seekTimes = [0.5, 1.0, 0.1, 0]; // Try multiple seek positions

      const captureFrame = (): string => {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');

        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          const videoAspect = video.videoWidth / video.videoHeight;
          const canvasAspect = canvas.width / canvas.height;
          let sourceX = 0, sourceY = 0;
          let sourceWidth = video.videoWidth, sourceHeight = video.videoHeight;

          if (videoAspect > canvasAspect) {
            sourceWidth = video.videoHeight * canvasAspect;
            sourceX = (video.videoWidth - sourceWidth) / 2;
          } else {
            sourceHeight = video.videoWidth / canvasAspect;
            sourceY = (video.videoHeight - sourceHeight) / 2;
          }

          ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

          // Check if image is mostly black (failed capture)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          let totalBrightness = 0;
          for (let i = 0; i < data.length; i += 4) {
            totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
          }
          const avgBrightness = totalBrightness / (data.length / 4);

          // If image is too dark (avg brightness < 10), return empty to try again
          if (avgBrightness < 10) {
            return '';
          }

          return canvas.toDataURL('image/jpeg', 0.7);
        }
        return '';
      };

      const tryCapture = () => {
        if (resolved) return;

        const thumbnail = captureFrame();

        // If capture failed and we have more seek positions to try
        if (!thumbnail && seekAttempt < seekTimes.length - 1) {
          seekAttempt++;
          const nextTime = Math.min(seekTimes[seekAttempt], video.duration * 0.5);
          video.currentTime = nextTime;
          return; // Will trigger onseeked again
        }

        // Final attempt or successful capture
        resolved = true;
        URL.revokeObjectURL(url);
        resolve({ file, thumbnail, duration: video.duration || 0 });
      };

      video.onloadedmetadata = () => {
        // Start with first seek position, adjusted for video duration
        const targetTime = Math.min(seekTimes[0], video.duration * 0.3);
        video.currentTime = targetTime;
      };

      video.onseeked = tryCapture;

      // Fallback: try to capture on canplaythrough (video is fully buffered)
      video.oncanplaythrough = () => {
        setTimeout(() => { if (!resolved) tryCapture(); }, 200);
      };

      // Fallback: capture on loadeddata if seeking doesn't work
      video.onloadeddata = () => {
        setTimeout(() => { if (!resolved) tryCapture(); }, 500);
      };

      // Timeout fallback after 5s (increased for slower formats)
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(url);
          resolve({ file, thumbnail: '', duration: video.duration || 0 });
        }
      }, 5000);

      video.onerror = () => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(url);
          resolve({ file, thumbnail: '', duration: 0 });
        }
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
    <div className="w-full max-w-md text-center px-4 animate-fade-in-up">
      <h2
        className="text-4xl font-bold mb-3 tracking-tight text-white"
        style={{
          textShadow: '1px 1px 0px rgba(255, 0, 128, 0.5), -1px -1px 0px rgba(0, 212, 255, 0.5)',
        }}
      >
        Create something amazing
      </h2>
      <p className="text-[#8E8E93] mb-10 text-lg">
        Your next viral moment starts here
      </p>

      {/* Upload button - primary action with swoosh effect - hidden when files are selected */}
      {selectedFiles.length === 0 && (
      <div className="mb-6">
        <motion.button
          onClick={handleUploadClick}
          className="relative w-full max-w-xs px-8 py-4 bg-gradient-to-br from-[#FF6B9F] via-[#C44FE2] to-[#6B5BFF] text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-3 mx-auto cursor-pointer tracking-wide"
          initial={{
            boxShadow: `
              4px 4px 0px #07bccc,
              8px 8px 0px #e601c0,
              12px 12px 0px #e9019a,
              16px 16px 0px #f40468,
              20px 20px 15px rgba(244, 4, 104, 0.3)
            `,
          }}
          whileHover={{
            boxShadow: `
              0px 0px 0px #07bccc,
              0px 0px 0px #e601c0,
              0px 0px 0px #e9019a,
              0px 0px 0px #f40468,
              0px 0px 0px rgba(244, 4, 104, 0)
            `,
            scale: 1.02,
          }}
          whileTap={{
            scale: 0.98,
          }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
          }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Videos
        </motion.button>
        <p className="text-[#8E8E93] text-sm mt-6">
          or drag and drop
        </p>
      </div>
      )}

      {/* Hidden file input for auto-trigger */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Selected Files Preview */}
      {(selectedFiles.length > 0 || isProcessing) && (
        <div className="mt-8 animate-fade-in">
          {/* Thumbnail row */}
          <div ref={clipsScrollRef} className="flex items-center gap-3 justify-start mb-6 overflow-x-auto pb-2 pt-3 px-3 scroll-smooth">
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
            {/* Add more button */}
            {!isProcessing && (
              <button
                onClick={handleUploadClick}
                className="flex-shrink-0 w-20 h-28 rounded-lg bg-white/5 border border-dashed border-white/20 hover:bg-white/10 hover:border-white/30 transition-all flex flex-col items-center justify-center gap-1 group"
              >
                <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-[10px] text-white/40 group-hover:text-white/60 transition-colors">Add more</span>
              </button>
            )}
          </div>

          {/* Quick select chips */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center mb-4 px-2 sm:px-4">
            <button
              onClick={() => setAiPrompt('Compose clips into a cohesive video')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 border rounded-full text-xs sm:text-sm font-medium transition-all ${
                aiPrompt.includes('Compose')
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-[var(--background-card)] hover:bg-[var(--background-card-hover)] border-[var(--border)] text-white'
              }`}
            >
              <span className="text-sm sm:text-base">🎬</span>
              Compose
            </button>
            <button
              onClick={() => setAiPrompt('Create a flashy, attention-grabbing video with dynamic transitions')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 border rounded-full text-xs sm:text-sm font-medium transition-all ${
                aiPrompt.includes('flashy')
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-[var(--background-card)] hover:bg-[var(--background-card-hover)] border-[var(--border)] text-white'
              }`}
            >
              <span className="text-sm sm:text-base">✨</span>
              Flashy
            </button>
            <button
              onClick={() => setAiPrompt('Keep it simple and professional, minimal cuts')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 border rounded-full text-xs sm:text-sm font-medium transition-all ${
                aiPrompt.includes('simple')
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-[var(--background-card)] hover:bg-[var(--background-card-hover)] border-[var(--border)] text-white'
              }`}
            >
              <span className="text-sm sm:text-base">📋</span>
              Minimal
            </button>
            <button
              onClick={() => setAiPrompt('Extract the best highlights and key moments')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 border rounded-full text-xs sm:text-sm font-medium transition-all ${
                aiPrompt.includes('highlights')
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-[var(--background-card)] hover:bg-[var(--background-card-hover)] border-[var(--border)] text-white'
              }`}
            >
              <span className="text-sm sm:text-base">🎯</span>
              Highlights
            </button>
          </div>

          {/* Prompt input */}
          <div className="px-4 mb-6">
            <div className="flex items-center gap-2 px-4 py-3 bg-[var(--background-card)] border border-[var(--border)] rounded-full focus-within:border-[var(--border)]">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="What do you want to create?"
                className="flex-1 bg-transparent text-white placeholder-[#636366] text-sm outline-none border-none focus:ring-0 focus:outline-none"
              />
              <button className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                <svg className="w-5 h-5 text-[#636366]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>
          </div>

          {/* AutoCut button - Primary action */}
          <div className="flex justify-center pb-24 sm:pb-8">
            <button
              onClick={handleAutoCut}
              disabled={isProcessing}
              className="h-12 flex items-center gap-2 px-8 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-full text-white font-medium transition-all disabled:opacity-50 shadow-lg"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              AutoCut ({selectedFiles.length})
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
  silenceAggressiveness,
  autoCutProcessing,
  setAutoCutProcessing,
  showTranscriptDrawer,
  setShowTranscriptDrawer,
  setHasUnsavedChanges,
  xPosts,
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
  silenceAggressiveness: SilenceDetectionOptions['aggressiveness'];
  autoCutProcessing: {
    active: boolean;
    status: 'preparing' | 'converting' | 'transcribing' | 'detecting' | 'applying' | 'done';
    currentClip: number;
    totalClips: number;
    message: string;
  } | null;
  setAutoCutProcessing: React.Dispatch<React.SetStateAction<{
    active: boolean;
    status: 'preparing' | 'converting' | 'transcribing' | 'detecting' | 'applying' | 'done';
    currentClip: number;
    totalClips: number;
    message: string;
  } | null>>;
  showTranscriptDrawer: boolean;
  setShowTranscriptDrawer: React.Dispatch<React.SetStateAction<boolean>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  xPosts: Array<{ id: string; text: string; likes: number }>;
}) {
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  // Undo/Redo state for deleted words
  const [undoStack, setUndoStack] = useState<Set<string>[]>([]);
  const [redoStack, setRedoStack] = useState<Set<string>[]>([]);
  const lastDeletedWordIds = useRef<Set<string>>(new Set());

  const desktopVideoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const desktopPreviewContainerRef = useRef<HTMLDivElement>(null);
  const mobilePreviewContainerRef = useRef<HTMLDivElement>(null);

  // Helper to get the currently visible video element
  const getActiveVideoRef = useCallback(() => {
    // lg breakpoint is 1024px
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      return desktopVideoRef.current;
    }
    return mobileVideoRef.current;
  }, []);

  // Safe video play helper that handles various error states
  const safeVideoPlay = useCallback((video: HTMLVideoElement) => {
    if (!video || video.readyState < 2) return; // HAVE_CURRENT_DATA or higher

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        // Ignore common non-critical errors
        if (e.name !== 'AbortError' && e.name !== 'NotSupportedError') {
          console.error('Video play error:', e);
        }
      });
    }
  }, []);

  // Undo handler
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, deletedWordIds]);
    setUndoStack(prev => prev.slice(0, -1));
    setDeletedWordIds(previousState);
  }, [undoStack, deletedWordIds, setDeletedWordIds]);

  // Redo handler
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, deletedWordIds]);
    setRedoStack(prev => prev.slice(0, -1));
    setDeletedWordIds(nextState);
  }, [redoStack, deletedWordIds, setDeletedWordIds]);

  // Track deletedWordIds changes for undo stack
  useEffect(() => {
    // Skip if this is from an undo/redo operation
    if (lastDeletedWordIds.current.size !== deletedWordIds.size ||
        ![...lastDeletedWordIds.current].every(id => deletedWordIds.has(id))) {
      // Only push to undo stack if there was a real change (not from undo/redo)
      const lastSize = lastDeletedWordIds.current.size;
      const currentSize = deletedWordIds.size;
      if (lastSize !== currentSize || lastSize === 0) {
        // Don't add initial empty state
        if (lastDeletedWordIds.current.size > 0 || deletedWordIds.size > 0) {
          setUndoStack(prev => {
            // Avoid duplicate consecutive states
            const lastState = prev[prev.length - 1];
            if (lastState && lastState.size === lastDeletedWordIds.current.size &&
                [...lastState].every(id => lastDeletedWordIds.current.has(id))) {
              return prev;
            }
            return [...prev, new Set(lastDeletedWordIds.current)];
          });
          setRedoStack([]); // Clear redo on new action
        }
      }
      lastDeletedWordIds.current = new Set(deletedWordIds);
    }
  }, [deletedWordIds]);

  // Timeline selection state
  const [selectedTimelineItems, setSelectedTimelineItems] = useState<string[]>([]);

  const { state: overlayState, updateTextOverlay, updateSticker, removeTextOverlay, removeSticker, setCaptionPosition, setTransitions, setFilter, toggleCaptionPreview, addTextOverlay, addSticker, setCaptionTemplate, setAudioSettings } = useOverlay();

  
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

  // Keyboard shortcuts: Spacebar for play/pause, Cmd+Z for undo, Cmd+Shift+Z for redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Spacebar to toggle play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        const video = getActiveVideoRef();
        if (video) {
          if (isPlaying) {
            video.pause();
            setIsPlaying(false);
          } else {
            safeVideoPlay(video);
            setIsPlaying(true);
          }
        }
      }

      // Cmd/Ctrl + Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Cmd/Ctrl + Shift + Z for redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, getActiveVideoRef, safeVideoPlay, handleUndo, handleRedo]);

  // Apply clip volume to video element
  useEffect(() => {
    const video = getActiveVideoRef();
    if (video && activeClip) {
      video.volume = activeClip.volume ?? 1;
    }
  }, [activeClip, activeClip?.volume, getActiveVideoRef]);

  // Auto-cut effect: apply creative effects after transcription completes
  useEffect(() => {
    if (!autoCutEnabled) return;

    // Check if all clips have been transcribed (have words)
    const allTranscribed = clips.length > 0 && clips.every(clip => clip.words && clip.words.length > 0);
    if (!allTranscribed) return;

    // Update processing status to detecting
    if (autoCutProcessing?.active) {
      setAutoCutProcessing(prev => prev ? {
        ...prev,
        status: 'detecting',
        message: 'Detecting silence and pauses...'
      } : null);
    }

    // Apply auto-cut effects once
    setAutoCutEnabled(false); // Disable to prevent re-triggering

    // 1. Auto-delete silences using enhanced detection (FFmpeg + Whisper merged)
    // Also track cut points for internal transitions
    const pausesToDelete = new Set<string>();
    const allCutPoints: CutPoint[] = [];
    let totalSilenceRemoved = 0;

    // Calculate cumulative clip start times in output timeline
    let cumulativeStartMs = 0;

    clips.forEach((clip, clipIndex) => {
      const clipCutPoints: CutPoint[] = [];
      let clipSilenceRemoved = 0;

      // Use enhanced silence segments if available (from FFmpeg + Whisper merge)
      if (clip.silenceSegments && clip.silenceSegments.length > 0) {
        clip.silenceSegments.forEach((silence) => {
          // Only delete silences above the confidence threshold (already filtered by aggressiveness)
          pausesToDelete.add(`silence-${clipIndex}-${silence.id}`);
          totalSilenceRemoved += silence.duration;
          clipSilenceRemoved += silence.duration;

          // Track cut point for internal transition
          // Calculate where this cut will appear in the output video
          // (silence start time minus all previous silences removed in this clip)
          const previousSilencesInClip = clipCutPoints.reduce(
            (sum, cp) => sum + cp.silenceDuration,
            0
          );
          const cutTimeInClipMs = (silence.start - previousSilencesInClip) * 1000;
          const cutTimeMs = cumulativeStartMs + cutTimeInClipMs;

          clipCutPoints.push({
            clipIndex,
            cutTimeMs,
            silenceDuration: silence.duration,
          });
        });
        console.log(`[AutoCut] Clip ${clipIndex}: Found ${clip.silenceSegments.length} silence segments (${clip.totalSilenceDuration?.toFixed(1)}s total)`);
      } else if (clip.words) {
        // Fallback: Use word gap detection if no silence segments available
        const pauseThreshold = silenceAggressiveness === 'tight' ? 0.3 :
                               silenceAggressiveness === 'conservative' ? 0.8 : 0.5;
        for (let i = 0; i < clip.words.length - 1; i++) {
          const currentWord = clip.words[i];
          const nextWord = clip.words[i + 1];
          const gap = nextWord.start - currentWord.end;
          if (gap > pauseThreshold) {
            pausesToDelete.add(`pause-clip-${clipIndex}-${currentWord.id}-${nextWord.id}`);
            totalSilenceRemoved += gap;
            clipSilenceRemoved += gap;

            // Track cut point for internal transition
            const previousSilencesInClip = clipCutPoints.reduce(
              (sum, cp) => sum + cp.silenceDuration,
              0
            );
            const cutTimeInClipMs = (currentWord.end - previousSilencesInClip) * 1000;
            const cutTimeMs = cumulativeStartMs + cutTimeInClipMs;

            clipCutPoints.push({
              clipIndex,
              cutTimeMs,
              silenceDuration: gap,
            });
          }
        }
        console.log(`[AutoCut] Clip ${clipIndex}: Using fallback word gap detection`);
      }

      // Add this clip's cut points to the total
      allCutPoints.push(...clipCutPoints);

      // Update cumulative start for next clip (original duration minus silences removed)
      cumulativeStartMs += (clip.duration - clipSilenceRemoved) * 1000;
    });

    if (pausesToDelete.size > 0) {
      setDeletedPauseIds(prev => new Set([...prev, ...pausesToDelete]));
      console.log(`[AutoCut] Removed ${pausesToDelete.size} silence segments (${totalSilenceRemoved.toFixed(1)}s total)`);
    }

    // Update processing status to applying
    if (autoCutProcessing?.active) {
      setAutoCutProcessing(prev => prev ? {
        ...prev,
        status: 'applying',
        message: 'Removing silence and applying effects...'
      } : null);
    }

    // 2. Apply a creative filter (random selection from good options)
    const creativeFilters = ['cinematic', 'vibrant', 'retro', 'moody', 'fade'];
    const randomFilter = creativeFilters[Math.floor(Math.random() * creativeFilters.length)];
    setFilter(randomFilter);

    // 3. Apply transitions - both between clips AND at internal cut points
    const allTransitions = [];

    // 3a. Transitions between clips (if multiple clips)
    if (clips.length >= 2) {
      const clipInfos = clips.map((clip, i) => ({
        duration: clip.duration,
        index: i,
      }));
      const clipTransitions = generateAutoTransitions(clipInfos, 'varied');
      allTransitions.push(...clipTransitions);
    }

    // 3b. Transitions at internal cut points (silence removal locations)
    if (allCutPoints.length > 0) {
      const internalTransitions = generateInternalCutTransitions(allCutPoints, 'auto');
      allTransitions.push(...internalTransitions);
      console.log(`[AutoCut] Applied ${internalTransitions.length} internal cut transitions`);
    }

    // Set all transitions
    if (allTransitions.length > 0) {
      setTransitions(allTransitions);
    }

    console.log('AutoCut applied:', {
      pausesDeleted: pausesToDelete.size,
      filter: randomFilter,
      clipTransitions: clips.length >= 2 ? clips.length - 1 : 0,
      internalCutTransitions: allCutPoints.length,
    });

    // Update processing status to done and clear after delay
    if (autoCutProcessing?.active) {
      setAutoCutProcessing(prev => prev ? {
        ...prev,
        status: 'done',
        message: 'AutoCut complete!'
      } : null);

      // Clear overlay after short delay
      setTimeout(() => setAutoCutProcessing(null), 1500);
    }
  }, [autoCutEnabled, clips, setAutoCutEnabled, setDeletedPauseIds, setFilter, setTransitions, silenceAggressiveness, autoCutProcessing, setAutoCutProcessing]);

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

  // Convert overlays to timeline tracks with collapsed view (deleted content removed)
  const { timelineTracks, collapsedDuration } = useMemo(() => {
    // Use collapsed tracks - when words are deleted, the timeline shortens
    const hasWords = allWords.length > 0;
    const hasDeleted = deletedWordIds.size > 0 || deletedPauseIds.size > 0;

    let videoTrack: TimelineTrack;
    let scriptTrack: TimelineTrack;
    let effectiveDuration = totalDuration;

    if (hasWords && hasDeleted) {
      // Generate collapsed tracks where deleted content is removed
      const collapsed = generateCollapsedTracks({
        words: allWords,
        deletedWordIds,
        deletedPauseIds,
        clips: clips.map(c => ({ duration: c.duration, file: c.file, url: c.url })),
      });
      videoTrack = collapsed.videoTrack;
      scriptTrack = collapsed.scriptTrack;
      effectiveDuration = collapsed.totalDuration;
    } else {
      // No deletions - show original tracks
      // Add visual gap between clips for clear separation
      const CLIP_GAP = 0.3; // 300ms gap between clips for visual separation
      videoTrack = {
        id: 'video-track',
        name: 'Video',
        items: clips.map((clip, i) => {
          // Calculate start time with gaps between clips
          const clipStartTime = clips.slice(0, i).reduce((acc, c) => {
            return acc + c.duration + CLIP_GAP;
          }, 0);
          return {
            id: `clip-${i}`,
            trackId: 'video-track',
            start: clipStartTime,
            end: clipStartTime + clip.duration,
            type: TrackItemType.VIDEO,
            label: `${i + 1}. ${(clip.file?.name || `Clip`).replace(/\.[^/.]+$/, '').slice(0, 12)}`,
            data: {
              clipIndex: i,
              url: clip.url,
              videoSrc: clip.url,
              cacheKey: clip.file?.name || `clip-${i}`,
              volume: clip.volume ?? 1,
            },
          };
        }),
      };

      scriptTrack = hasWords
        ? generateScriptTrack({
            words: allWords,
            deletedWordIds,
            deletedPauseIds,
            clips: clips.map(c => ({ duration: c.duration })),
          })
        : { id: 'script-track', name: 'Script', items: [] };

      // Update duration to include gaps between clips
      effectiveDuration = totalDuration + (clips.length > 1 ? (clips.length - 1) * CLIP_GAP : 0);
    }

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

    return {
      timelineTracks: [videoTrack, textTrack, stickerTrack],
      collapsedDuration: effectiveDuration,
    };
  }, [clips, allWords, deletedWordIds, deletedPauseIds, overlayState.textOverlays, overlayState.stickers, totalDuration]);

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
    } else if (trackId === 'video-track' && itemId.startsWith('clip-')) {
      // Video clip reordering based on drag position
      const clipIndex = parseInt(itemId.replace('clip-', ''), 10);
      if (isNaN(clipIndex) || clipIndex < 0 || clipIndex >= clips.length) return;

      // Calculate cumulative start times for all clips
      const clipStarts: number[] = [];
      let cumulative = 0;
      clips.forEach((clip) => {
        clipStarts.push(cumulative);
        cumulative += clip.duration;
      });

      // Find the new position based on where the clip was dropped
      // The clip should be inserted where its new start time falls
      let newIndex = 0;
      const draggedClipDuration = clips[clipIndex].duration;

      // Find where this clip should go based on the drop position
      for (let i = 0; i < clips.length; i++) {
        if (i === clipIndex) continue; // Skip the dragged clip itself

        const clipMidpoint = clipStarts[i] + (clips[i].duration / 2);
        if (newStart < clipMidpoint) {
          newIndex = i;
          break;
        }
        newIndex = i + 1;
      }

      // Adjust index if moving after original position
      if (newIndex > clipIndex) {
        newIndex--;
      }

      // Only reorder if position changed
      if (newIndex !== clipIndex) {
        setClips(prevClips => {
          const newClips = [...prevClips];
          const [movedClip] = newClips.splice(clipIndex, 1);
          newClips.splice(newIndex, 0, movedClip);
          return newClips;
        });
      }
    }
  }, [updateTextOverlay, updateSticker, clips]);

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
        safeVideoPlay(video);
      }
      setIsPlaying(!isPlaying);
    }
  };

  // AI Chat command handler
  const handleChatCommand = useCallback((command: { name: string; input: Record<string, unknown> }) => {
    const { name, input } = command;

    switch (name) {
      case "add_text": {
        const position = input.position as string || "center";
        const positionMap = { top: { x: 50, y: 15 }, center: { x: 50, y: 50 }, bottom: { x: 50, y: 85 } };
        const styleMap: Record<string, string> = {
          bold: "bold-impact",
          minimal: "minimal-clean",
          outline: "outline-pop",
          neon: "neon-glow",
          handwritten: "handwritten",
          gradient: "gradient-flow",
          shadow: "shadow-depth",
          retro: "retro-vibe",
        };
        const templateId = styleMap[input.style as string] || "bold-impact";

        addTextOverlay({
          id: `text-${Date.now()}`,
          content: input.content as string,
          templateId,
          enterAnimation: "fade",
          exitAnimation: "fade",
          position: positionMap[position as keyof typeof positionMap] || positionMap.center,
          startMs: currentTime * 1000,
          durationMs: ((input.duration as number) || 3) * 1000,
        });
        break;
      }

      case "set_filter": {
        const filterMap: Record<string, string | null> = {
          none: null,
          cinematic: "cinematic",
          vibrant: "vibrant",
          vintage: "vintage",
          warm: "warm",
          cool: "cool",
          bw: "bw",
          sepia: "sepia",
          dramatic: "dramatic",
          soft: "soft",
          hdr: "hdr",
        };
        setFilter(filterMap[input.filter as string] ?? null);
        break;
      }

      case "toggle_captions": {
        const shouldEnable = input.enabled as boolean;
        if (shouldEnable !== overlayState.showCaptionPreview) {
          toggleCaptionPreview();
        }
        break;
      }

      case "set_caption_style": {
        setCaptionTemplate(input.style as string);
        if (!overlayState.showCaptionPreview) {
          toggleCaptionPreview();
        }
        break;
      }

      case "add_sticker": {
        const pos = input.position as { x?: number; y?: number } || {};
        addSticker({
          id: `sticker-${Date.now()}`,
          stickerId: input.emoji as string,
          position: { x: pos.x ?? 50, y: pos.y ?? 30 },
          startMs: currentTime * 1000,
          durationMs: 3000,
          scale: 1,
        });
        break;
      }

      case "seek_to_time": {
        const targetTime = input.seconds as number;
        let accumulatedTime = 0;
        for (let i = 0; i < clips.length; i++) {
          if (targetTime < accumulatedTime + clips[i].duration) {
            setActiveClipIndex(i);
            const video = getActiveVideoRef();
            if (video) {
              video.currentTime = targetTime - accumulatedTime;
            }
            setCurrentTime(targetTime);
            break;
          }
          accumulatedTime += clips[i].duration;
        }
        break;
      }

      case "set_audio_enhancement": {
        setAudioSettings({
          enhanceAudio: input.enabled as boolean,
          noiseReduction: input.noiseReduction as boolean ?? true,
        });
        break;
      }

      case "remove_silence": {
        // Trigger auto-cut functionality
        // This would need to be connected to the existing autocut logic
        console.log("Remove silence requested with aggressiveness:", input.aggressiveness);
        break;
      }

      case "export_video": {
        // Navigate to export step
        console.log("Export requested");
        break;
      }
    }
  }, [addTextOverlay, addSticker, setFilter, toggleCaptionPreview, setCaptionTemplate, setAudioSettings, currentTime, clips, getActiveVideoRef, overlayState.showCaptionPreview]);

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
        // Find current word or the next upcoming word
        const currentWord = allWords.find(
          (w) => globalTime >= w.start && globalTime < w.end
        );

        // Also check: are we in a gap approaching a deleted word?
        const upcomingWord = allWords.find(
          (w) => globalTime < w.start && w.start - globalTime < 0.1 // within 100ms
        );

        const wordToCheck = currentWord || (upcomingWord && deletedWordIds.has(upcomingWord.id) ? upcomingWord : null);

        if (wordToCheck && deletedWordIds.has(wordToCheck.id)) {
          // Find next non-deleted word
          const wordIndex = allWords.indexOf(wordToCheck);
          let nextWord: TranscriptWord | undefined;

          for (let i = wordIndex + 1; i < allWords.length; i++) {
            if (!deletedWordIds.has(allWords[i].id)) {
              nextWord = allWords[i];
              break;
            }
          }

          // If we're at the first deleted word, also search from beginning
          if (!nextWord && wordIndex > 0) {
            for (let i = wordIndex - 1; i >= 0; i--) {
              if (!deletedWordIds.has(allWords[i].id) && allWords[i].end <= globalTime) {
                // We're past this word, continue forward from wordIndex
                break;
              }
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
            // Ensure video keeps playing after seek
            safeVideoPlay(video);
            return; // Exit to avoid duplicate processing
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
            // Ensure video keeps playing after seek
            safeVideoPlay(video);
            return; // Exit to avoid duplicate processing
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
      safeVideoPlay(video);
    }
  }, [activeClipIndex, isPlaying, getActiveVideoRef, safeVideoPlay]);

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
    setIsVideoLoading(false);
  }, []);

  // Handle video ready to play
  const handleVideoCanPlay = useCallback(() => {
    setIsVideoLoading(false);
    // Auto-play next video if playback was in progress
    const video = getActiveVideoRef();
    if (isPlaying && video) {
      safeVideoPlay(video);
    }
  }, [isPlaying, getActiveVideoRef, safeVideoPlay]);

  // Reset video error and set loading when switching clips
  useEffect(() => {
    setVideoError(null);
    if (clips[activeClipIndex]) {
      setIsVideoLoading(true);
    }
  }, [activeClipIndex, clips]);

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

      // Update AutoCut processing status for transcription progress
      if (autoCutProcessing?.active) {
        setAutoCutProcessing(prev => prev ? {
          ...prev,
          status: 'transcribing',
          currentClip: i + 1,
          message: `Transcribing clip ${i + 1} of ${clips.length}...`
        } : null);
      }

      // Skip clips that don't have blobs downloaded yet
      if (!clip.file) {
        console.warn(`Skipping clip ${i} - blob not yet downloaded`);
        continue;
      }

      try {
        let response: Response;
        let fileToUpload: File;

        // Always extract audio client-side when FFmpeg.wasm is supported
        // This is required because server-side FFmpeg doesn't work on Vercel serverless
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

        // Create FormData and send to transcription API
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

        // Add silence detection settings
        formData.append("detectSilence", "true");
        formData.append("silenceAggressiveness", silenceAggressiveness);

        setTranscribeProgress(baseProgress + (100 / clips.length) * 0.6);

        response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        // Handle 413 (file too large for direct upload)
        if (response.status === 413) {
          const fileSizeMB = fileToUpload.size / (1024 * 1024);
          if (clip.uploadStatus === 'uploading') {
            alert(`Clip ${i + 1} is still uploading. Please wait and try again.`);
          } else if (clip.uploadStatus === 'error') {
            alert(`Clip ${i + 1} storage upload failed. Please check your connection and try again.`);
          } else {
            alert(`Clip ${i + 1} (${fileSizeMB.toFixed(1)}MB) exceeds the upload limit. Try using a shorter clip.`);
          }
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
            // Silence detection data for AutoCut
            silenceSegments: data.silenceSegments?.map((seg: SilenceSegment) => ({
              ...seg,
              clipIndex: i,  // Update clipIndex to match actual clip position
            })),
            totalSilenceDuration: data.totalSilenceDuration,
            audioDuration: data.audioDuration,
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
  }, [clips, setClips, overlayState.audioSettings, silenceAggressiveness, autoCutProcessing?.active, setAutoCutProcessing]);

  // Check if any clips are still uploading to storage
  const isUploading = useMemo(() => {
    return clips.some(clip => clip.uploadStatus === 'pending' || clip.uploadStatus === 'uploading');
  }, [clips]);

  // Calculate upload progress for UI
  const uploadProgress = useMemo(() => {
    const clipsNeedingUpload = clips.filter(clip => clip.uploadStatus !== undefined);
    if (clipsNeedingUpload.length === 0) return 100;
    const completed = clipsNeedingUpload.filter(clip => clip.uploadStatus === 'complete' || clip.uploadStatus === 'error').length;
    return Math.round((completed / clipsNeedingUpload.length) * 100);
  }, [clips]);

  // Auto-transcribe clips that don't have transcripts yet (wait for uploads to complete)
  useEffect(() => {
    const hasUntranscribedClips = clips.some(clip => !clip.transcript && !clip.words);
    if (clips.length > 0 && hasUntranscribedClips && !isTranscribing && !isUploading) {
      handleTranscribe();
    }
  }, [clips.length, isUploading]); // Trigger when clips change or upload completes

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
    // Update selection state for video clips
    setSelectedTimelineItems([itemId]);
  }, [allWords, handleWordClick]);

  // Handle clip volume change
  const handleClipVolumeChange = useCallback((clipIndex: number, volume: number) => {
    setClips(prev => prev.map((clip, i) =>
      i === clipIndex ? { ...clip, volume } : clip
    ));
  }, []);

  // Get currently selected video clip index (if any)
  const selectedClipIndex = useMemo(() => {
    const selectedId = selectedTimelineItems[0];
    if (!selectedId?.startsWith('clip-')) return null;
    return parseInt(selectedId.replace('clip-', ''), 10);
  }, [selectedTimelineItems]);

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
    {/* Bottom Toolbar */}
    <Sidebar
      view="editor"
      editorStep="edit"
      totalDurationMs={totalDuration * 1000}
      currentTimeMs={currentTime * 1000}
      clipCount={clips.length}
      onOpenTranscript={() => setShowTranscriptDrawer(true)}
    />

    <div className="w-full flex flex-col gap-0 lg:gap-6 animate-fade-in-up lg:px-6 isolate">

      {/* Mobile Video Panel */}
      <div className="lg:hidden pt-4">
        <MobileVideoPanel
          activeClip={clips[activeClipIndex]}
          videoRef={mobileVideoRef}
          previewContainerRef={mobilePreviewContainerRef}
          filterStyle={overlayState.filterId ? getFilterById(overlayState.filterId)?.filter : undefined}
          handleTimeUpdate={handleTimeUpdate}
          handleVideoEnded={handleVideoEnded}
          handleVideoError={handleVideoError}
          handleVideoCanPlay={handleVideoCanPlay}
          isVideoLoading={isVideoLoading}
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
          onOpenTranscript={() => setShowTranscriptDrawer(true)}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          autoCutProcessing={autoCutProcessing}
          updateTextOverlay={updateTextOverlay}
          updateSticker={updateSticker}
        />
      </div>

      {/* Mobile Transcript Drawer */}
      {showTranscriptDrawer && (
        <TranscriptDrawer
          isOpen={showTranscriptDrawer}
          onClose={() => setShowTranscriptDrawer(false)}
          isTranscribing={isTranscribing}
          transcribeProgress={transcribeProgress}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
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
      )}

      {/* Desktop Layout */}
      <div className="hidden lg:flex flex-col lg:flex-row gap-8 pt-16">
        {/* Preview Panel - Fixed width on desktop */}
        <div className="w-full lg:w-[340px] flex-shrink-0">
          <p className="label mb-4">Preview</p>
          <div className="card-glow overflow-hidden">
            <div ref={desktopPreviewContainerRef} className="aspect-[9/16] bg-black relative">
              {/* Upload Progress Overlay */}
              {isUploading && <UploadingOverlay progress={uploadProgress} />}
              {/* AutoCut Processing Overlay */}
              {autoCutProcessing?.active && !isUploading && (
                <AutoCutOverlay
                  status={autoCutProcessing.status}
                  message={autoCutProcessing.message}
                  currentClip={autoCutProcessing.currentClip}
                  totalClips={autoCutProcessing.totalClips}
                />
              )}
              {/* Video Loading Overlay */}
              {isVideoLoading && activeClip && !isUploading && !autoCutProcessing?.active && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                  <video
                    src="/loading video.mp4"
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                </div>
              )}
              {activeClip && !isUploading && !autoCutProcessing?.active && (
                <>
                  <video
                    ref={desktopVideoRef}
                    src={activeClip.url}
                    className="w-full h-full object-cover"
                    style={{ filter: filterStyle && filterStyle !== 'none' ? filterStyle : undefined }}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnded}
                    onError={handleVideoError}
                    onCanPlay={handleVideoCanPlay}
                    playsInline
                  />
                  {/* Real-time caption preview */}
                  <CaptionPreview
                    words={allWords}
                    deletedWordIds={deletedWordIds}
                    currentTime={currentTime}
                    templateId={overlayState.captionTemplateId}
                    showCaptions={overlayState.showCaptionPreview}
                    positionY={overlayState.captionPositionY}
                    onPositionChange={setCaptionPosition}
                  />
                  {/* Text overlay preview - draggable and editable */}
                  <TextOverlayPreview
                    textOverlays={overlayState.textOverlays}
                    currentTimeMs={currentTime * 1000}
                    onUpdatePosition={(id, position) => updateTextOverlay(id, { position })}
                    onUpdateContent={(id, content) => updateTextOverlay(id, { content })}
                    containerRef={desktopPreviewContainerRef}
                  />
                  {/* Sticker overlay preview - draggable */}
                  <StickerOverlayPreview
                    stickers={overlayState.stickers}
                    currentTimeMs={currentTime * 1000}
                    onUpdatePosition={(id, position) => updateSticker(id, { position })}
                    containerRef={desktopPreviewContainerRef}
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
          </div>

          {/* Active Overlays List */}
          <ActiveOverlayList />
        </div>

        {/* Transcript Panel - Visible on desktop */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 gap-4">
            <p className="label !text-white">Transcript</p>
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

          <div className="h-[520px]">
            {autoCutProcessing?.active ? (
              /* AutoCut skeleton - shows animated placeholder lines */
              <div className="space-y-3 h-full overflow-hidden">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="w-10 h-4 bg-[#2A2A2E] rounded" />
                    <div className="flex-1 space-y-2">
                      <div
                        className="h-4 bg-[#2A2A2E] rounded"
                        style={{ width: `${60 + Math.random() * 40}%` }}
                      />
                      {i % 3 === 0 && (
                        <div
                          className="h-4 bg-[#2A2A2E] rounded"
                          style={{ width: `${30 + Math.random() * 30}%` }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : isTranscribing ? (
              <div className="flex flex-col items-center justify-center h-full gap-5">
                <div className="w-14 h-14 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <RollingLoadingMessage />
                  <p className="text-[#636366] text-sm mt-1">
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
            ) : isUploading ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-16 h-16 rounded-full bg-[#181818] flex items-center justify-center mb-5 relative">
                  <svg className="w-16 h-16 absolute -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="#242430"
                      strokeWidth="4"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="#4A8FE7"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${uploadProgress * 1.76} 176`}
                      className="transition-all duration-300"
                    />
                  </svg>
                  <svg className="w-7 h-7 text-[#4A8FE7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <p className="text-white font-medium mb-2">Uploading video...</p>
                <p className="text-[#636366] text-sm leading-relaxed">
                  {uploadProgress}% complete • Transcription will begin automatically
                </p>
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
      defaultHeight={220}
    >
      <div className="h-full">
        {autoCutProcessing?.active ? (
          /* Timeline Skeleton - shows animated placeholder tracks */
          <div className="h-full bg-[#0A0A0A] p-4">
            {/* Toolbar skeleton */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#1A1A1A] rounded animate-pulse" />
                <div className="w-8 h-8 bg-[#1A1A1A] rounded animate-pulse" />
                <div className="w-px h-6 bg-[#2A2A2E] mx-1" />
                <div className="w-8 h-8 bg-[#1A1A1A] rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-6 bg-[#1A1A1A] rounded animate-pulse" />
                <div className="w-24 h-6 bg-[#1A1A1A] rounded animate-pulse" />
              </div>
            </div>
            {/* Time ruler skeleton */}
            <div className="h-6 bg-[#111] rounded mb-2 flex items-end px-2 gap-8">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-px h-3 bg-[#2A2A2E]" />
                  <div className="w-6 h-2 bg-[#1A1A1A] rounded mt-1 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                </div>
              ))}
            </div>
            {/* Track skeletons */}
            <div className="space-y-2">
              {/* Video track */}
              <div className="flex items-center gap-2">
                <div className="w-20 h-8 bg-[#1A1A1A] rounded flex items-center px-2 gap-1">
                  <div className="w-4 h-4 bg-[#2A2A2E] rounded animate-pulse" />
                  <div className="w-10 h-3 bg-[#2A2A2E] rounded animate-pulse" />
                </div>
                <div className="flex-1 h-16 bg-[#1A1A1A] rounded overflow-hidden">
                  <div className="h-full flex">
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="h-full bg-gradient-to-r from-[#2A2A2E] to-[#1F1F23] animate-pulse"
                        style={{
                          width: `${12 + Math.random() * 8}%`,
                          animationDelay: `${i * 100}ms`
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Audio track */}
              <div className="flex items-center gap-2">
                <div className="w-20 h-8 bg-[#1A1A1A] rounded flex items-center px-2 gap-1">
                  <div className="w-4 h-4 bg-[#2A2A2E] rounded animate-pulse" />
                  <div className="w-10 h-3 bg-[#2A2A2E] rounded animate-pulse" />
                </div>
                <div className="flex-1 h-10 bg-[#1A1A1A] rounded overflow-hidden flex items-center px-2">
                  {/* Waveform skeleton */}
                  {[...Array(50)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 mx-px bg-[#2A2A2E] rounded-full animate-pulse"
                      style={{
                        height: `${20 + Math.random() * 60}%`,
                        animationDelay: `${i * 30}ms`
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* Script track */}
              <div className="flex items-center gap-2">
                <div className="w-20 h-8 bg-[#1A1A1A] rounded flex items-center px-2 gap-1">
                  <div className="w-4 h-4 bg-[#2A2A2E] rounded animate-pulse" />
                  <div className="w-10 h-3 bg-[#2A2A2E] rounded animate-pulse" />
                </div>
                <div className="flex-1 h-8 bg-[#1A1A1A] rounded overflow-hidden flex items-center gap-1 px-2">
                  {[...Array(15)].map((_, i) => (
                    <div
                      key={i}
                      className="h-5 bg-[#2A2A2E] rounded animate-pulse"
                      style={{
                        width: `${30 + Math.random() * 50}px`,
                        animationDelay: `${i * 50}ms`
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
          {/* Clip Volume Control - shows when a video clip is selected */}
          {selectedClipIndex !== null && clips[selectedClipIndex] && (
            <div className="flex items-center gap-4 px-4 py-2 bg-[#1A1A1A] border-b border-[#282828]">
              <span className="text-xs text-gray-400 min-w-[60px]">
                {(clips[selectedClipIndex].file?.name || `Clip ${selectedClipIndex + 1}`).slice(0, 20)}
              </span>
              <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                <button
                  onClick={() => handleClipVolumeChange(selectedClipIndex, clips[selectedClipIndex].volume === 0 ? 1 : 0)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title={clips[selectedClipIndex].volume === 0 ? "Unmute" : "Mute"}
                >
                  {(clips[selectedClipIndex].volume ?? 1) === 0 ? (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={clips[selectedClipIndex].volume ?? 1}
                  onChange={(e) => handleClipVolumeChange(selectedClipIndex, parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#4A8FE7]"
                />
                <span className="text-xs text-gray-400 min-w-[32px] text-right">
                  {Math.round((clips[selectedClipIndex].volume ?? 1) * 100)}%
                </span>
              </div>
              <button
                onClick={() => setSelectedTimelineItems([])}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Deselect"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <Timeline
            tracks={timelineTracks}
            totalDuration={collapsedDuration}
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
                safeVideoPlay(video);
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
            onAddText={() => {
              const newTextOverlay: TextOverlay = {
                id: `text-${Date.now()}`,
                content: 'New Text',
                templateId: 'bold-white',
                enterAnimation: 'fade',
                exitAnimation: 'fade',
                position: { x: 50, y: 50 },
                startMs: currentTime * 1000,
                durationMs: Math.min(3000, (totalDuration - currentTime) * 1000),
              };
              addTextOverlay(newTextOverlay);
            }}
            onAddSticker={() => {
              const newSticker: StickerOverlay = {
                id: `sticker-${Date.now()}`,
                stickerId: 'star',
                position: { x: 50, y: 30 },
                scale: 1,
                startMs: currentTime * 1000,
                durationMs: Math.min(3000, (totalDuration - currentTime) * 1000),
              };
              addSticker(newSticker);
            }}
            onAddMedia={() => {
              // Trigger the file input for adding more video clips
              const fileInput = document.querySelector('input[type="file"][accept*="video"]') as HTMLInputElement;
              if (fileInput) {
                fileInput.click();
              }
            }}
            onOpenTranscript={() => setShowTranscriptDrawer(true)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
          />
          </>
        )}
      </div>
    </ResizableBottomPanel>

    {/* AI Chat Input + Voice - Floating */}
    <div className="fixed bottom-6 left-3 right-3 lg:left-[296px] lg:right-8 z-40 flex justify-center">
      <div className="flex items-center gap-2 lg:gap-3 w-full max-w-2xl">
        <div className="flex-1 min-w-0">
          <AIChatInput
            context={{
              duration: totalDuration,
              currentTime,
              captionsEnabled: overlayState.showCaptionPreview,
              currentFilter: overlayState.filterId,
              textOverlayCount: overlayState.textOverlays.length,
              stickerCount: overlayState.stickers.length,
              hasTranscript: allWords.length > 0,
            }}
            onCommand={handleChatCommand}
          />
        </div>
        <VapiVoiceButton
          transcript={fullTranscript}
          currentFilter={overlayState.filterId ?? undefined}
          textOverlayCount={overlayState.textOverlays.length}
          stickerCount={overlayState.stickers.length}
          xPosts={xPosts}
          hasVideo={clips.length > 0}
          isTranscribing={isTranscribing}
        />
      </div>
    </div>
    </>
  );
}

// Rolling Loading Message Component - now uses VideoProcessingLoader
function RollingLoadingMessage() {
  return <VideoProcessingLoader stage="transcribing" className="text-xl" />;
}

// Compact rolling message for mobile
function RollingLoadingMessageCompact() {
  return <VideoProcessingLoaderCompact stage="transcribing" className="text-sm text-white" />;
}

// Seamless looping video component
function SeamlessLoopVideo({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      // When video is within 0.1 seconds of ending, seek back to start
      if (video.duration - video.currentTime < 0.1) {
        video.currentTime = 0;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted
      playsInline
      className={className}
    />
  );
}

// Uploading Overlay Component - Eddie working animation
function UploadingOverlay({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e] z-10">
      {/* Loading video animation */}
      <div className="relative mb-6">
        <SeamlessLoopVideo
          src="/snip-loading-square.mp4"
          className="w-96 h-96 object-contain"
        />
      </div>

      {/* Animated progress text */}
      <VideoProcessingLoader
        stage="uploading"
        progress={progress}
        className="text-lg"
      />
    </div>
  );
}

// AutoCut Processing Overlay - Same style as UploadingOverlay but with scissors icon
function AutoCutOverlay({ status, message, currentClip, totalClips }: {
  status: 'preparing' | 'converting' | 'transcribing' | 'detecting' | 'applying' | 'done';
  message: string;
  currentClip: number;
  totalClips: number;
}) {
  // Calculate progress percentage based on status stages
  const getProgress = () => {
    switch (status) {
      case 'preparing':
        return 5;
      case 'converting':
        return 15;
      case 'transcribing':
        // 20-70% range, distributed across clips
        const clipProgress = totalClips > 0 ? (currentClip / totalClips) : 0;
        return 20 + (clipProgress * 50);
      case 'detecting':
        return 75;
      case 'applying':
        return 90;
      case 'done':
        return 100;
      default:
        return 0;
    }
  };

  const progress = getProgress();

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e] z-10">
      {/* Loading video animation */}
      <div className="relative mb-6">
        <SeamlessLoopVideo
          src="/snip-loading-square.mp4"
          className="w-96 h-96 object-contain"
        />
      </div>

      {/* Animated progress text */}
      <VideoProcessingLoader
        stage={status === 'detecting' || status === 'applying' ? 'analyzing' : status === 'done' ? 'processing' : status}
        clipCount={status === 'transcribing' && totalClips > 1 ? totalClips : undefined}
        currentClip={status === 'transcribing' && totalClips > 1 ? currentClip : undefined}
        className="text-lg"
      />

      {/* Progress bar */}
      <div className="w-48 h-1.5 bg-[#252A35] rounded-full overflow-hidden mt-6">
        <motion.div
          className="h-full bg-gradient-to-r from-[#4A8FE7] to-[#6366f1] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Progress percentage */}
      <p className="text-[#636366] text-xs mt-2">{Math.round(progress)}%</p>

      {/* Done state with checkmark */}
      {status === 'done' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-green-400 flex items-center gap-2 mt-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Ready to edit!
        </motion.div>
      )}
    </div>
  );
}

// Mobile Video Panel Component
function MobileVideoPanel({
  activeClip,
  videoRef,
  previewContainerRef,
  filterStyle,
  handleTimeUpdate,
  handleVideoEnded,
  handleVideoError,
  handleVideoCanPlay,
  isVideoLoading,
  videoError,
  handlePlayPause,
  isPlaying,
  allWords,
  deletedWordIds,
  currentTime,
  overlayState,
  setCaptionPosition,
  updateTextOverlay,
  updateSticker,
  formatTime,
  activeDuration,
  deletedSegments,
  totalDuration,
  onOpenTextDrawer,
  onOpenStickerDrawer,
  onOpenFilterDrawer,
  onOpenCaptionsDrawer,
  onToggleCaptions,
  onOpenTranscript,
  isUploading,
  uploadProgress,
  autoCutProcessing,
}: {
  activeClip: { url: string } | undefined;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
  filterStyle: string | undefined;
  handleTimeUpdate: () => void;
  handleVideoEnded: () => void;
  handleVideoError: () => void;
  handleVideoCanPlay: () => void;
  isVideoLoading: boolean;
  videoError: string | null;
  handlePlayPause: () => void;
  isPlaying: boolean;
  allWords: TranscriptWord[];
  deletedWordIds: Set<string>;
  currentTime: number;
  overlayState: { showCaptionPreview: boolean; captionPositionY: number; textOverlays: TextOverlay[]; stickers: StickerOverlay[]; captionTemplateId: string };
  setCaptionPosition: (y: number) => void;
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
  updateSticker: (id: string, updates: Partial<StickerOverlay>) => void;
  formatTime: (seconds: number) => string;
  activeDuration: number;
  deletedSegments: Set<number>;
  totalDuration: number;
  onOpenTextDrawer?: () => void;
  onOpenStickerDrawer?: () => void;
  onOpenFilterDrawer?: () => void;
  onOpenCaptionsDrawer?: () => void;
  onToggleCaptions?: () => void;
  onOpenTranscript?: () => void;
  isUploading?: boolean;
  uploadProgress?: number;
  autoCutProcessing?: {
    active: boolean;
    status: 'preparing' | 'converting' | 'transcribing' | 'detecting' | 'applying' | 'done';
    currentClip: number;
    totalClips: number;
    message: string;
  } | null;
}) {
  return (
    <div className="flex flex-col relative z-0 mt-0">
      <div className="overflow-hidden relative w-full">
        <div ref={previewContainerRef} className="aspect-[9/16] bg-black relative max-h-[80vh] mx-auto">
          {/* Upload Progress Overlay */}
          {isUploading && <UploadingOverlay progress={uploadProgress ?? 0} />}
          {/* AutoCut Processing Overlay */}
          {autoCutProcessing?.active && !isUploading && (
            <AutoCutOverlay
              status={autoCutProcessing.status}
              message={autoCutProcessing.message}
              currentClip={autoCutProcessing.currentClip}
              totalClips={autoCutProcessing.totalClips}
            />
          )}
          {/* Video Loading Overlay */}
          {isVideoLoading && activeClip && !isUploading && !autoCutProcessing?.active && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
              <video
                src="/loading video.mp4"
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            </div>
          )}
          {activeClip && !isUploading && !autoCutProcessing?.active && (
          <>
            <video
              ref={videoRef}
              src={activeClip.url}
              className="w-full h-full object-cover"
              style={{ filter: filterStyle && filterStyle !== 'none' ? filterStyle : undefined }}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              onCanPlay={handleVideoCanPlay}
              playsInline
            />
            <CaptionPreview
              words={allWords}
              deletedWordIds={deletedWordIds}
              currentTime={currentTime}
              templateId={overlayState.captionTemplateId}
              showCaptions={overlayState.showCaptionPreview}
              positionY={overlayState.captionPositionY}
              onPositionChange={setCaptionPosition}
            />
            {/* Text overlay preview - draggable and editable */}
            <TextOverlayPreview
              textOverlays={overlayState.textOverlays}
              currentTimeMs={currentTime * 1000}
              onUpdatePosition={(id, position) => updateTextOverlay(id, { position })}
              onUpdateContent={(id, content) => updateTextOverlay(id, { content })}
              containerRef={previewContainerRef}
            />
            {/* Sticker overlay preview - draggable */}
            <StickerOverlayPreview
              stickers={overlayState.stickers}
              currentTimeMs={currentTime * 1000}
              onUpdatePosition={(id, position) => updateSticker(id, { position })}
              containerRef={previewContainerRef}
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
      </div>
    </div>
  );
}

// Transcript Drawer Component (mobile)
function TranscriptDrawer({
  isOpen,
  onClose,
  isTranscribing,
  transcribeProgress,
  isUploading,
  uploadProgress,
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
  isOpen: boolean;
  onClose: () => void;
  isTranscribing: boolean;
  transcribeProgress: number;
  isUploading: boolean;
  uploadProgress: number;
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
  const [drawerHeight, setDrawerHeight] = useState(85); // percentage of viewport height - start fully expanded
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(50);

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    isDragging.current = true;
    startY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startHeight.current = drawerHeight;
    document.body.style.userSelect = 'none';
  };

  const handleDrag = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDragging.current) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = startY.current - clientY;
    const deltaPercent = (deltaY / window.innerHeight) * 100;
    const newHeight = Math.min(85, Math.max(30, startHeight.current + deltaPercent));
    setDrawerHeight(newHeight);
  }, []);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDrag);
      window.addEventListener('touchend', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDrag);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isOpen, handleDrag, handleDragEnd]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
      {/* Tap to dismiss area (above drawer) */}
      <div
        className="absolute inset-0"
        style={{ bottom: `${drawerHeight}vh` }}
        onClick={onClose}
      />

      {/* Semi-transparent drawer that slides up over video */}
      <div
        className="relative w-full bg-black/30 backdrop-blur-xl rounded-t-2xl p-4 overflow-hidden animate-slide-up flex flex-col"
        style={{
          boxShadow: '0 -4px 30px rgba(0,0,0,0.3)',
          height: `${drawerHeight}vh`,
          maxHeight: '85vh',
        }}
      >
        {/* Drag handle indicator - interactive */}
        <div
          className="absolute top-0 left-0 right-0 h-6 cursor-ns-resize flex items-center justify-center touch-none"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="w-10 h-1 bg-white/40 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-3 mt-2">
          <h3 className="text-base font-semibold text-white/90">Transcript</h3>
          <div className="flex items-center gap-3">
            {(deletedSegments.size > 0 || deletedWordIds.size > 0 || deletedPauseIds.size > 0) && (
              <button
                onClick={handleRestoreAll}
                className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap"
              >
                Restore All ({deletedWordIds.size + deletedPauseIds.size || deletedSegments.size})
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ height: `calc(${drawerHeight}vh - 70px)` }}>
          {isTranscribing ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <RollingLoadingMessageCompact />
                <p className="text-[#636366] text-xs mt-1">
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
            <div className="space-y-1">
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
                        : "text-white/80 hover:text-white hover:bg-[#242430]"
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
          ) : isUploading ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-full bg-[#181818] flex items-center justify-center mb-4 relative">
                <svg className="w-12 h-12 absolute -rotate-90">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#242430" strokeWidth="3" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="#4A8FE7"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${uploadProgress * 1.26} 126`}
                    className="transition-all duration-300"
                  />
                </svg>
                <svg className="w-5 h-5 text-[#4A8FE7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="text-white font-medium text-sm mb-1">Uploading video...</p>
              <p className="text-[#636366] text-xs">{uploadProgress}% - Transcription starts after upload</p>
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
    </div>
  );
}

// Feedback Modal Component
function FeedbackModal({
  isOpen,
  onClose,
  userEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}) {
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'general'>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: feedback.trim(),
          type: feedbackType,
          email: userEmail,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => {
          onClose();
          setFeedback('');
          setSubmitted(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#1C1C1E] rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2C2E]">
          <h2 className="text-lg font-semibold text-white">Send Feedback</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="p-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-medium">Thank you for your feedback!</p>
          </div>
        ) : (
          <>
            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Feedback Type */}
              <div>
                <label className="block text-xs text-[#8E8E93] mb-2">Feedback Type</label>
                <div className="flex gap-2">
                  {(['general', 'feature', 'bug'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFeedbackType(type)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all ${
                        feedbackType === type
                          ? 'bg-[#4A8FE7] text-white'
                          : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback Text */}
              <div>
                <label className="block text-xs text-[#8E8E93] mb-2">Your Feedback</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us what you think..."
                  rows={4}
                  className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#636366] focus:outline-none focus:border-[#4A8FE7] transition-colors resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#2C2C2E] flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#8E8E93] hover:bg-[#2C2C2E] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!feedback.trim() || isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#4A8FE7] text-white hover:bg-[#3A7FD7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// X Connected Success Modal
function XConnectedModal({
  isOpen,
  onClose,
  username,
}: {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
}) {
  if (!isOpen) return null;

  const features = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
      title: "AI-Powered Suggestions",
      description: "Snip analyzes your top posts to suggest video ideas that match your content style and what resonates with your audience.",
      available: true,
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
        </svg>
      ),
      title: "One-Click Sharing",
      description: "Export and share your videos directly to X without leaving Snip. Optimized for maximum engagement.",
      available: false,
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      title: "Performance Analytics",
      description: "Track how your videos perform on X. See views, engagement, and learn what works best.",
      available: false,
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
        </svg>
      ),
      title: "Repurpose Tweets",
      description: "Turn your best-performing tweets into engaging video content automatically.",
      available: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-[#1C1C1E] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        {/* Header with X branding */}
        <div className="relative px-6 pt-6 pb-4">
          {/* Success checkmark */}
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              {/* X logo badge */}
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white flex items-center justify-center">
                <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-bold text-white text-center">
            Connected to X!
          </h2>
          {username && (
            <p className="text-[#8E8E93] text-center mt-1">
              Signed in as <span className="text-white font-medium">@{username}</span>
            </p>
          )}
        </div>

        {/* Features list */}
        <div className="px-6 pb-4">
          <p className="text-sm text-[#8E8E93] mb-4 text-center">
            Here&apos;s what Snip can do with your X account:
          </p>
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                  feature.available
                    ? 'bg-[#4A8FE7]/10 border border-[#4A8FE7]/20'
                    : 'bg-[#2C2C2E]'
                }`}
              >
                <div className={`flex-shrink-0 ${feature.available ? 'text-[#4A8FE7]' : 'text-[#636366]'}`}>
                  {feature.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-medium text-sm ${feature.available ? 'text-white' : 'text-[#8E8E93]'}`}>
                      {feature.title}
                    </h3>
                    {!feature.available && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#3C3C3E] text-[#8E8E93] rounded">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${feature.available ? 'text-[#8E8E93]' : 'text-[#636366]'}`}>
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2C2C2E]">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-[#4A8FE7] text-white font-semibold hover:bg-[#3A7FD7] transition-colors"
          >
            Start Creating
          </button>
        </div>
      </motion.div>
    </div>
  );
}
