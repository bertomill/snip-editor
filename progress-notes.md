# Snip - Progress Notes

## Stack
Next.js 14 | TypeScript | Tailwind | Groq Whisper | Supabase | Remotion

---

## Done
- [x] Project setup + Calm-inspired dark theme
- [x] Upload step (drag-drop, multi-file)
- [x] Video preview (9:16, play/pause, auto-advance)
- [x] Timeline with thumbnails + progress bar
- [x] Transcription API (Groq Whisper)
- [x] Clickable transcript segments
- [x] Mobile responsive
- [x] Export UI (placeholder)
- [x] Script-driven editing (segment deletion)
- [x] MOV→MP4 conversion for transcription (ffmpeg)
- [x] Browser preview conversion for MOV/HEVC files
- [x] Refined Calm-style UI (deeper colors, animations, glow effects)
- [x] App branding: favicon, apple-touch-icon, header icon with transparent corners
- [x] AI background removal for scissors-only icon variant (rembg)
- [x] Calm Sleep UI refresh: true black (#0A0A0A), iOS-style grays, blue glow card effects
- [x] Favicon setup for Next.js App Router (src/app/favicon.ico, icon.png, apple-icon.png)

### Phase 2: Overlay System (Jan 24, 2025)
- [x] **Type System** - Created `/src/types/overlays.ts` with TextOverlay, StickerOverlay, FilterPreset, OverlayState types
- [x] **Filter Presets** - 12 CSS filters (None, Cinematic, Vibrant, Vintage, Retro, Cool, Warm, Moody, Bright, B&W, Fade, Drama)
- [x] **Animation Templates** - 6 animation types (none, fade, scale, slide-up, slide-down, bounce) using Remotion interpolate
- [x] **Text Style Templates** - 8 curated styles (Bold White, Neon Glow, Boxed, Highlight, Handwritten, Minimal, Gradient Box, Retro)
- [x] **Sticker Templates** - 32 stickers in 4 categories (reactions, emotions, objects, shapes)
- [x] **Remotion Components**:
  - `animated-wrapper.tsx` - Enter/exit animations with Remotion's interpolate & Easing
  - `text-layer.tsx` - Text overlay rendering with style templates
  - `sticker-layer.tsx` - Sticker rendering with floating animation
  - `preview-composition.tsx` - Multi-clip preview composition
- [x] **Overlay UI Components**:
  - `OverlayContext.tsx` - React Context + useReducer for state management
  - `OverlayToolbar.tsx` - Floating toolbar with [CC][T][S][F] buttons
  - `ActiveOverlayList.tsx` - Chips showing active overlays with remove button
  - `TextOverlayDrawer.tsx` - Drawer for adding text with style/animation/position picker
  - `StickerDrawer.tsx` - Drawer with category tabs for sticker selection
  - `FilterDrawer.tsx` - Filter grid with thumbnails and checkmark selection
- [x] **Page Integration** - Updated EditStep with overlay toolbar, drawers, and filter preview on video element
- [x] **Export Integration** - Overlay state (filter, text, stickers) passed to render API
- [x] **Render API** - Extended to accept filterId, textOverlays[], stickers[] parameters
- [x] **SSR Render** - Updated main.tsx to render all overlay layers in exported video

### Phase 3: Supabase Auth & Sidebar (Jan 24, 2025)
- [x] **Supabase Integration** - Installed @supabase/supabase-js and @supabase/ssr
- [x] **Auth Setup** - Client, server, and middleware configuration for session handling
- [x] **Database Schema** - Created tables for projects, clips, renders with RLS policies
- [x] **Storage Config** - Video bucket with user-scoped upload/download policies
- [x] **Login Page** - Split-screen design with landscape image, email/password + Google OAuth
- [x] **Auth Callback** - OAuth redirect handler at /auth/callback
- [x] **Hooks** - useUser() and useSignOut() for client-side auth state
- [x] **TikTok-style Sidebar** - Fixed left nav with Home, Explore, Create icons
- [x] **Profile Menu** - Avatar with dropdown showing user info, settings, logout

### Phase 4: Groq Whisper Migration (Jan 24, 2025)
- [x] **Replaced Gemini with Groq Whisper** - 216x real-time transcription speed
- [x] **Audio extraction** - FFmpeg extracts mp3 (16kHz mono) from video
- [x] **Word-level timestamps** - Groq returns precise word timing, grouped into segments
- [x] **Performance improvement** - 1 min video transcribes in ~0.3s (was 30-60s with Gemini)

### Phase 5: Mobile UI (Jan 24, 2025)
- [x] **Shop-style bottom nav** - Floating pill-shaped nav bar on mobile (Home, Search, Create)
- [x] **Responsive sidebar** - Desktop sidebar hidden on mobile, bottom nav shown instead
- [x] **Layout adjustments** - Removed left padding on mobile, added bottom padding for nav clearance

### Phase 7: Supabase Video Storage for Rendering (Jan 24, 2025)
- [x] **Server-side storage helpers** - Created `storage-server.ts` with server-only Supabase functions
  - `uploadTempVideo()` - Uploads source clips to `videos/{userId}/temp/{renderId}/` with signed URLs
  - `deleteTempVideos()` - Cleans up temp folder after render completes
  - `uploadRenderedVideo()` - Uploads final MP4 to `videos/{userId}/renders/{renderId}.mp4`
- [x] **Render API updates** - `/api/render` now:
  - Accepts `userId` for Supabase storage (falls back to local for unauthenticated)
  - Generates `renderId` upfront for consistent temp folder paths
  - Converts MOV/HEVC to MP4 via FFmpeg before upload (optional, `convertIfNeeded` flag)
  - Uploads source clips to Supabase, passes signed URLs to Remotion
- [x] **Remotion renderer updates** - `remotion-renderer.ts`:
  - Accepts optional `renderId` parameter for Supabase path consistency
  - Uploads completed render to Supabase storage
  - Cleans up temp videos (Supabase or local) after render
  - Returns `supabaseUrl` in render state for direct download
- [x] **Render state** - Added `supabaseUrl` field for cloud-hosted video URLs
- [x] **Video cutting** - Integrated `video-cutter.ts` for removing deleted word segments:
  - Calculates deleted time ranges from word timestamps
  - Uses FFmpeg to cut and concatenate kept segments
  - Adjusts clip durations and caption timestamps accordingly
- [x] **Vercel compatibility** - Full flow works on serverless (no local filesystem dependency in production)

### Phase 6: Multi-Track Timeline & Media Library (Jan 24, 2025)
- [x] **Multi-Track Timeline** - Adapted from react-video-editor-pro with 3 tracks:
  - Video track (clips)
  - Text track (text overlays)
  - Sticker track (sticker overlays)
- [x] **Timeline Features**:
  - Drag items to move (updates startMs/durationMs in OverlayContext)
  - Resize items via edge handles
  - Playhead scrubbing (click to seek)
  - Zoom controls (+/- buttons)
  - Play/pause controls in timeline header
  - Delete items (Backspace/Delete key)
- [x] **Zustand Store** - Timeline drag/drop UI state (ghost elements, drag validity)
- [x] **Media Library Panel**:
  - Slide-over panel from sidebar
  - Upload media to Supabase Storage (50MB max)
  - Grid view with thumbnails
  - Preview modal with video player
  - Add to timeline button (fetches video, adds to clips)
  - Delete with custom confirmation modal
- [x] **API Routes**:
  - `POST /api/media/upload` - Upload to Supabase Storage with signed URLs
  - `GET /api/media/list` - List user's files with signed URLs
  - `DELETE /api/media/delete` - Remove from storage
- [x] **Script Editor** - Word-level transcript editing:
  - Click words to toggle deletion
  - Deleted words shown with strikethrough
  - Playback skips deleted words
  - Visual feedback for current word during playback
- [x] **Sidebar Updates** - Uploads button opens media library panel

### Phase 8: Script Track on Timeline (Jan 24, 2025)
- [x] **Script Track** - Descript-style word visualization in timeline:
  - Words appear as individual timeline items below Video track
  - Width proportional to spoken duration
  - Pauses (>0.3s gaps) shown as "..." blocks
  - Click word to seek video to that position
  - Deleted words show strikethrough + red tint
  - Script items not draggable/resizable (read-only)
- [x] **Auto-Transcription** - Transcription starts immediately on upload:
  - Removed "Generate Transcript" button
  - useEffect triggers when clips loaded without transcripts
  - Empty state shows "Preparing transcript..." message
- [x] **Project Feed** - View switching between feed and editor (external change)

### Phase 9: Auto-Synced Subtitles (Jan 24, 2025)
- [x] **Real-time Caption Preview** - `CaptionPreview.tsx` component:
  - Shows word-by-word captions synced to video playback in edit mode
  - Uses word-level timestamps from Groq Whisper transcription
  - Groups words into 8-word caption segments (matches export)
  - Highlights current word with template styling
  - Automatically filters out deleted words
  - Respects CC toggle in overlay toolbar
- [x] **Draggable Caption Position** - Vertical repositioning:
  - Drag captions up/down on video preview (mouse + touch support)
  - Position stored in OverlayContext (`captionPositionY`: 0-100%)
  - Clamped between 10-90% to keep captions visible
  - Visual drag handle indicator
- [x] **Render Pipeline Integration**:
  - `captionPositionY` added to OverlayState type
  - `SET_CAPTION_POSITION` action in OverlayContext
  - Render API accepts and passes position to Remotion
  - `SnipCompositionProps` includes `captionPositionY`
  - `main.tsx` positions caption layer using percentage from top
  - Final exported video matches preview position exactly

## Todo
- [ ] Trim clips (in-timeline trimming)
- [ ] Auto-stitching (AI clip ordering)
- [ ] Snap-to-grid on timeline
- [ ] Multi-select / marquee selection on timeline
- [ ] Keyboard shortcuts for timeline (J/K/L scrub, etc.)

---

## Architecture

### File Structure
```
/src/
├── app/
│   ├── login/page.tsx          # Split-screen login with image
│   ├── auth/callback/route.ts  # OAuth callback handler
│   └── api/
│       ├── media/              # Media library API
│       │   ├── upload/route.ts
│       │   ├── list/route.ts
│       │   └── delete/route.ts
│       ├── render/             # Video rendering
│       └── transcribe/         # Groq Whisper transcription
├── components/
│   ├── Sidebar.tsx             # TikTok-style nav + profile
│   ├── CaptionPreview.tsx      # Real-time draggable caption preview
│   ├── overlays/               # Text, sticker, filter overlays
│   ├── media-library/          # Upload panel & preview modal
│   │   └── MediaLibraryPanel.tsx
│   ├── script-editor/          # Word-level transcript editing
│   │   ├── ScriptEditor.tsx
│   │   ├── WordSpan.tsx
│   │   └── useScriptEditor.ts
│   └── timeline/               # Multi-track timeline
│       ├── Timeline.tsx
│       ├── types.ts            # TrackItemType: VIDEO, TEXT, STICKER, SCRIPT, PAUSE
│       ├── constants.ts        # SCRIPT_TRACK_CONSTANTS (pause threshold)
│       ├── stores/             # Zustand drag state
│       ├── hooks/              # Timeline logic hooks
│       ├── utils/              # generate-script-track.ts
│       └── components/         # Track, item, playhead, etc.
├── contexts/
│   ├── MediaLibraryContext.tsx # Media library state
│   └── ProjectsContext.tsx     # Project feed state
├── lib/
│   ├── supabase/
│   ├── remotion/
│   └── templates/
└── types/
    ├── overlays.ts
    └── media.ts
/middleware.ts                   # Auth session middleware
```

### Limits
- Max 5 text overlays per video
- Max 10 stickers per video
- Text overlays: 100 character limit
- Sticker duration: auto-set to 3 seconds from current time
- Media upload: 50MB max per file

### State Management
- **OverlayContext** (React Context + useReducer) - Source of truth for overlays, synced with timeline
- **MediaLibraryContext** (React Context) - Uploaded files, loading states
- **Zustand** (use-timeline-store) - Transient drag/drop UI state (ghost elements, drag validity)

### UX Pattern
- Floating toolbar at bottom of preview
- Slide-up drawers for adding content (animate-slide-up CSS)
- Chips below preview showing active overlays
- Filter applied as CSS filter on video element for instant preview
- Timeline drag updates OverlayContext via callbacks (onItemMove, onItemResize)
- Media library: slide-over panel with preview modal and "Add to Timeline" action

---

## Notes
- API keys in `.env.local` (Groq + Supabase) - regenerate after dev
- React Video Editor source for reference
- TypeScript compiles cleanly
- Run `supabase-schema.sql` in Supabase SQL Editor to create tables
