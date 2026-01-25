import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, Video, useCurrentFrame } from "remotion";
import { SnipCompositionProps } from "../types/composition";
import { CaptionLayer } from "./caption-layer";
import { TextLayer } from "./text-layer";
import { StickerLayer } from "./sticker-layer";
import { getFilterById } from "../templates/filter-presets";
import { getTransitionTemplate, TransitionEffect } from "../templates/transition-templates";
import { ClipTransition } from "@/types/overlays";

/**
 * Calculate transition effect for the current frame
 * Supports both clip boundaries (between clips) and internal cuts (silence removal)
 */
function calculateTransitionEffect(
  frame: number,
  fps: number,
  clips: SnipCompositionProps["clips"],
  clipTransitions: ClipTransition[]
): { effect: TransitionEffect; overlay?: { visible: boolean; backgroundColor?: string; opacity?: number } } {
  // Default: no effect
  const defaultResult = { effect: {}, overlay: undefined };

  if (!clipTransitions || clipTransitions.length === 0) {
    return defaultResult;
  }

  // Calculate clip boundary frames for clip-to-clip transitions
  const clipBoundaries: { clipIndex: number; boundaryFrame: number }[] = [];

  clips.forEach((clip, index) => {
    if (index < clips.length - 1) {
      // End frame of this clip = boundary
      const endFrame = Math.floor((clip.endMs / 1000) * fps);
      clipBoundaries.push({ clipIndex: index, boundaryFrame: endFrame });
    }
  });

  // Find if current frame is within any transition
  for (const transition of clipTransitions) {
    if (transition.type === 'none') continue;

    let boundaryFrame: number;

    // Check if this is an internal cut (has cutTimeMs) or a clip boundary
    if (transition.cutTimeMs !== undefined) {
      // Internal cut: use the cutTimeMs directly
      boundaryFrame = Math.floor((transition.cutTimeMs / 1000) * fps);
    } else {
      // Clip boundary: find the boundary frame
      const boundary = clipBoundaries.find(b => b.clipIndex === transition.clipIndex);
      if (!boundary) continue;
      boundaryFrame = boundary.boundaryFrame;
    }

    const template = getTransitionTemplate(transition.type);
    const transitionDuration = transition.durationFrames || template.durationFrames;
    const halfDuration = Math.floor(transitionDuration / 2);

    // Transition is centered on the boundary
    const transitionStart = boundaryFrame - halfDuration;
    const transitionEnd = boundaryFrame + halfDuration;

    if (frame >= transitionStart && frame < transitionEnd) {
      // We're in this transition
      const localFrame = frame - transitionStart;
      const effect = template.apply(localFrame, transitionDuration, transition.intensity);
      const overlay = template.overlay
        ? template.overlay(localFrame, transitionDuration, transition.intensity)
        : undefined;

      return { effect, overlay };
    }
  }

  return defaultResult;
}

/**
 * Main composition component that renders:
 * 1. Video clips in sequence (with optional filter + transitions)
 * 2. Sticker overlays
 * 3. Text overlays with animations
 * 4. Caption overlay with word-by-word highlighting
 * 5. Transition overlays (flash, etc.)
 */
export const SnipMain: React.FC<SnipCompositionProps> = ({
  clips,
  captions,
  captionStyles,
  fps,
  filterId,
  textOverlays = [],
  stickers = [],
  captionPositionY = 75,
  clipTransitions = [],
}) => {
  const frame = useCurrentFrame();

  // Get filter CSS
  const filter = filterId ? getFilterById(filterId) : null;
  const filterStyle = filter && filter.id !== 'none' ? filter.filter : undefined;

  // Calculate transition effect for current frame
  const { effect: transitionEffect, overlay: transitionOverlay } = useMemo(
    () => calculateTransitionEffect(frame, fps, clips, clipTransitions),
    [frame, fps, clips, clipTransitions]
  );

  // Combine filter and transition styles
  const combinedFilterStyle = useMemo(() => {
    const filters: string[] = [];
    if (filterStyle) filters.push(filterStyle);
    if (transitionEffect.filter) filters.push(transitionEffect.filter);
    return filters.length > 0 ? filters.join(' ') : undefined;
  }, [filterStyle, transitionEffect.filter]);

  // Video layer style with transition transforms
  const videoLayerStyle = useMemo(() => {
    const style: React.CSSProperties = {
      filter: combinedFilterStyle,
    };

    if (transitionEffect.transform) {
      style.transform = transitionEffect.transform;
    }

    if (transitionEffect.opacity !== undefined) {
      style.opacity = transitionEffect.opacity;
    }

    return style;
  }, [combinedFilterStyle, transitionEffect]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* Video Layer - render clips in sequence with optional filter and transitions */}
      <AbsoluteFill style={videoLayerStyle}>
        {clips.map((clip, index) => {
          const startFrame = Math.floor((clip.startMs / 1000) * fps);
          const durationFrames = Math.floor(((clip.endMs - clip.startMs) / 1000) * fps);

          return (
            <Sequence
              key={`clip-${index}`}
              from={startFrame}
              durationInFrames={durationFrames}
            >
              <AbsoluteFill>
                <Video
                  src={clip.filePath}
                  volume={clip.volume ?? 1}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </AbsoluteFill>
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {/* Transition Overlay Layer (for flash, glitch effects) */}
      {transitionOverlay && transitionOverlay.visible && (
        <AbsoluteFill
          style={{
            backgroundColor: transitionOverlay.backgroundColor || '#FFFFFF',
            opacity: transitionOverlay.opacity || 0,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Stickers Layer */}
      {stickers.length > 0 && (
        <StickerLayer stickers={stickers} fps={fps} />
      )}

      {/* Text Overlays Layer */}
      {textOverlays.length > 0 && (
        <TextLayer textOverlays={textOverlays} fps={fps} />
      )}

      {/* Caption Layer - positioned based on captionPositionY */}
      <AbsoluteFill
        style={{
          top: `${captionPositionY}%`,
          transform: "translateY(-50%)",
          height: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <CaptionLayer
          captions={captions}
          styles={captionStyles}
          fps={fps}
          currentFrame={frame}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
