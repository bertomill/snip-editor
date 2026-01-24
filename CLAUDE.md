# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev              # Next.js dev with Turbopack
npm run dev:webpack      # Dev with webpack (use if Turbopack issues)
npm run build            # Production build (uses webpack)
npm run start            # Serve production build
npm run lint             # ESLint
```

Note: Production build forces webpack because Remotion SSR requires it.

## Architecture Overview

Snip is a vertical video editor (9:16) for creating short-form content with AI-powered transcription and caption generation.

### Three-Step Editor Workflow

The main component (`src/app/page.tsx`) implements a state machine:
1. **Upload** — Drag-and-drop multi-file upload with format detection
2. **Edit** — Timeline with transcript segments, overlay tools
3. **Export** — Caption template selection and render initiation

### Overlay System (React Context + useReducer)

`src/components/overlays/OverlayContext.tsx` manages all visual effects:
- State: `textOverlays[]`, `stickers[]`, `filterId`, `showCaptionPreview`
- Limits: Max 5 text overlays, max 10 stickers
- Drawer components (`TextOverlayDrawer`, `StickerDrawer`, `FilterDrawer`) dispatch actions

### Video Rendering Pipeline

```
POST /api/render → startRendering() → Remotion SSR → /public/rendered-videos/[id].mp4
     ↓
Poll /api/render/progress every 1s
     ↓
GET /api/render/download/[id]
```

Key files:
- `src/app/api/render/route.ts` — Accepts clips + overlays, starts render
- `src/lib/renderer/remotion-renderer.ts` — Bundles and renders via Remotion
- `src/lib/renderer/render-state.ts` — In-memory progress tracking

### Remotion Composition Layers

`src/lib/remotion/main.tsx` (SnipMain) renders in order:
1. Video clips with CSS filter
2. Sticker layer (positioned emoji/shapes)
3. Text layer (styled text with animations)
4. Caption layer (word-by-word highlighting)

Each uses Remotion's `Sequence` for frame-precise timing.

### Template System

Templates in `src/lib/templates/`:
- `caption-templates.ts` — 4 presets (Classic, Minimal, Handwritten, Neon)
- `text-templates.ts` — 8 text styles with position
- `animation-templates.ts` — Fade, Scale, Slide, Bounce
- `filter-presets.ts` — 10+ CSS filters (Cinematic, Vibrant, Vintage, etc.)
- `sticker-templates.ts` — Emoji library with categories

### Transcript-Based Editing

- `/api/transcribe` uses Groq Whisper Large v3 Turbo for fast transcription (~216x real-time)
- Extracts audio from video via FFmpeg, sends to Groq API
- Returns word-level timestamps grouped into natural segments
- Segments displayed as clickable list; Delete key marks segments for exclusion
- Only active segments included in final render

### Format Handling

- MOV/HEVC files converted to MP4 for browser preview via `/api/convert-preview`
- Original files sent to render API to maintain quality

## Key Types

- `src/types/overlays.ts` — TextOverlay, StickerOverlay, FilterPreset
- `src/lib/types/composition.ts` — SnipCompositionProps, SnipCaption

## Supabase Authentication

- Browser client: `src/lib/supabase/client.ts`
- Server client: `src/lib/supabase/server.ts`
- Middleware: `middleware.ts` refreshes sessions

## Environment Variables

```
GROQ_API_KEY                    # Transcription API (Groq Whisper)
NEXT_PUBLIC_SUPABASE_URL        # Database & auth
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Client auth token
```

## Configuration Notes

- `next.config.ts` externalizes Remotion packages for SSR compatibility
- Server action body size limit: 50MB (for video uploads)
- Rendered videos output to `/public/rendered-videos/`
