import React from "react";
import { Composition } from "remotion";
import { SnipMain } from "./main";
import { SnipCompositionProps } from "../types/composition";

/**
 * Default props for the composition
 * These are overridden at render time with actual values
 */
const defaultProps: SnipCompositionProps = {
  clips: [],
  captions: [],
  captionStyles: {},
  durationInFrames: 900, // 30 seconds at 30fps
  fps: 30,
  width: 1080,
  height: 1920, // 9:16 vertical video
  // Overlay defaults
  filterId: undefined,
  textOverlays: [],
  stickers: [],
};

/**
 * Root component that defines the Remotion composition
 */
export const SnipRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SnipVideo"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={SnipMain as any}
        durationInFrames={defaultProps.durationInFrames}
        fps={defaultProps.fps}
        width={defaultProps.width}
        height={defaultProps.height}
        defaultProps={defaultProps}
        calculateMetadata={async ({ props }) => {
          // Use props to dynamically set composition metadata
          const p = props as unknown as SnipCompositionProps;
          return {
            durationInFrames: p.durationInFrames || defaultProps.durationInFrames,
            fps: p.fps || defaultProps.fps,
            width: p.width || defaultProps.width,
            height: p.height || defaultProps.height,
          };
        }}
      />
    </>
  );
};
