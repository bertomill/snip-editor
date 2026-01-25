import { useCallback, useState, useRef, useLayoutEffect } from "react";
import { ZOOM_CONSTRAINTS } from "../constants";
import { calculateViewportDuration } from "../utils";

export type ZoomState = {
  scale: number;
  scroll: number;
};

export const useTimelineZoom = (
  timelineRef: React.RefObject<HTMLDivElement> | React.RefObject<HTMLDivElement | null>,
  currentFrame?: number,
  fps?: number,
  totalDuration?: number
) => {
  const [zoomState, setZoomState] = useState<ZoomState>({
    scale: ZOOM_CONSTRAINTS.default,
    scroll: 0,
  });

  const currentScaleRef = useRef<number>(zoomState.scale);
  const pendingScrollRef = useRef<number | null>(null);

  const calculateNewZoom = useCallback(
    (prevZoom: number, delta: number): number => {
      let stepMultiplier = 1;
      if (prevZoom <= 3) {
        stepMultiplier = 1;
      } else if (prevZoom <= 10) {
        stepMultiplier = 2;
      } else {
        stepMultiplier = 4;
      }

      const tieredStep = delta * ZOOM_CONSTRAINTS.step * stepMultiplier;

      return Math.min(
        ZOOM_CONSTRAINTS.max,
        Math.max(ZOOM_CONSTRAINTS.min, prevZoom + tieredStep)
      );
    },
    []
  );

  const handleZoom = useCallback(
    (delta: number, clientX?: number) => {
      const scrollContainer = timelineRef?.current?.parentElement;
      if (!scrollContainer) return;

      const newZoom = calculateNewZoom(zoomState.scale, delta);
      if (newZoom === zoomState.scale) return;

      const rect = scrollContainer.getBoundingClientRect();
      if (rect.width === 0) {
        requestAnimationFrame(() => handleZoom(delta, clientX));
        return;
      }

      let zoomCenterX: number;

      if (clientX !== undefined) {
        zoomCenterX = clientX;
      } else if (currentFrame !== undefined && fps && totalDuration) {
        const currentTimeInSeconds = currentFrame / fps;
        const timelineElement = timelineRef?.current;

        if (timelineElement) {
          const viewportDuration = calculateViewportDuration(totalDuration, zoomState.scale);
          const playheadPercentage = (currentTimeInSeconds / viewportDuration) * 100;
          const timelineWidth = timelineElement.offsetWidth;
          const playheadPositionInTimeline = (playheadPercentage / 100) * timelineWidth;
          const playheadInViewport = playheadPositionInTimeline - scrollContainer.scrollLeft;
          zoomCenterX = rect.left + playheadInViewport;
        } else {
          zoomCenterX = rect.left + rect.width / 2;
        }
      } else {
        zoomCenterX = rect.left + rect.width / 2;
      }

      const relativeX = zoomCenterX - rect.left + scrollContainer.scrollLeft;
      const zoomFactor = newZoom / zoomState.scale;
      const newScroll = relativeX * zoomFactor - (zoomCenterX - rect.left);

      scrollContainer.scrollLeft = newScroll;
      setZoomState({ scale: newZoom, scroll: newScroll });
    },
    [timelineRef, zoomState.scale, calculateNewZoom, currentFrame, fps, totalDuration]
  );

  const setZoomScale = useCallback(
    (newScale: number) => {
      const clampedScale = Math.min(ZOOM_CONSTRAINTS.max, Math.max(ZOOM_CONSTRAINTS.min, newScale));
      if (clampedScale === currentScaleRef.current) return;

      currentScaleRef.current = clampedScale;
      const delta = clampedScale - zoomState.scale;
      handleZoom(delta, undefined);
    },
    [handleZoom, zoomState.scale]
  );

  const handleWheelZoom = useCallback(
    (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const delta = -Math.sign(event.deltaY) * ZOOM_CONSTRAINTS.wheelStep;
        handleZoom(delta, event.clientX);
      }
    },
    [handleZoom]
  );

  // Stub methods for compatibility
  const startSliderDrag = useCallback(() => {}, []);
  const endSliderDrag = useCallback(() => {}, []);

  return {
    zoomScale: zoomState.scale,
    scrollPosition: zoomState.scroll,
    setZoomScale,
    handleZoom,
    handleWheelZoom,
    startSliderDrag,
    endSliderDrag,
  };
};
