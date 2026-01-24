import React from "react";
import { AbsoluteFill, Sequence, Video, useCurrentFrame } from "remotion";
import { SnipCompositionProps } from "../types/composition";
import { CaptionLayer } from "./caption-layer";
import { TextLayer } from "./text-layer";
import { StickerLayer } from "./sticker-layer";
import { getFilterById } from "../templates/filter-presets";

/**
 * Main composition component that renders:
 * 1. Video clips in sequence (with optional filter)
 * 2. Sticker overlays
 * 3. Text overlays with animations
 * 4. Caption overlay with word-by-word highlighting
 */
export const SnipMain: React.FC<SnipCompositionProps> = ({
  clips,
  captions,
  captionStyles,
  fps,
  filterId,
  textOverlays = [],
  stickers = [],
}) => {
  const frame = useCurrentFrame();

  // Get filter CSS
  const filter = filterId ? getFilterById(filterId) : null;
  const filterStyle = filter && filter.id !== 'none' ? filter.filter : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Video Layer - render clips in sequence with optional filter */}
      <AbsoluteFill style={{ filter: filterStyle }}>
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

      {/* Stickers Layer */}
      {stickers.length > 0 && (
        <StickerLayer stickers={stickers} fps={fps} />
      )}

      {/* Text Overlays Layer */}
      {textOverlays.length > 0 && (
        <TextLayer textOverlays={textOverlays} fps={fps} />
      )}

      {/* Caption Layer - positioned at bottom */}
      <AbsoluteFill
        style={{
          top: "auto",
          bottom: 0,
          height: "30%",
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
