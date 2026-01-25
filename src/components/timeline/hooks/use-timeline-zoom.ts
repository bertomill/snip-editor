import { useCallback, useState, useRef } from "react";
import { ZOOM_CONSTRAINTS } from "../constants";
import { calculateViewportDuration } from "../utils";

export type ZoomState = {
  scale: number;
  scroll: number;
};

// Touch gesture state
interface TouchState {
  initialDistance: number;
  initialScale: number;
  initialCenterX: number;
  initialScrollLeft: number;
  lastTouchX: number;
  isPinching: boolean;
  isPanning: boolean;
}

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

  // Touch gesture refs
  const touchStateRef = useRef<TouchState>({
    initialDistance: 0,
    initialScale: 1,
    initialCenterX: 0,
    initialScrollLeft: 0,
    lastTouchX: 0,
    isPinching: false,
    isPanning: false,
  });

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

  // Calculate distance between two touch points
  const getTouchDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate center point between two touches
  const getTouchCenter = useCallback((touches: TouchList): { x: number; y: number } => {
    if (touches.length < 2) {
      return { x: touches[0]?.clientX || 0, y: touches[0]?.clientY || 0 };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  // Handle touch start for pinch/pan
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      const scrollContainer = timelineRef?.current?.parentElement;
      if (!scrollContainer) return;

      const touches = event.touches;

      if (touches.length === 2) {
        // Two-finger gesture: could be pinch or pan
        event.preventDefault();
        const distance = getTouchDistance(touches);
        const center = getTouchCenter(touches);

        touchStateRef.current = {
          initialDistance: distance,
          initialScale: zoomState.scale,
          initialCenterX: center.x,
          initialScrollLeft: scrollContainer.scrollLeft,
          lastTouchX: center.x,
          isPinching: true,
          isPanning: true,
        };
      } else if (touches.length === 1) {
        // Single finger - just track for potential pan
        touchStateRef.current = {
          ...touchStateRef.current,
          lastTouchX: touches[0].clientX,
          isPanning: false,
          isPinching: false,
        };
      }
    },
    [timelineRef, zoomState.scale, getTouchDistance, getTouchCenter]
  );

  // Handle touch move for pinch zoom and pan
  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      const scrollContainer = timelineRef?.current?.parentElement;
      if (!scrollContainer) return;

      const touches = event.touches;
      const touchState = touchStateRef.current;

      if (touches.length === 2 && touchState.isPinching) {
        event.preventDefault();

        const currentDistance = getTouchDistance(touches);
        const center = getTouchCenter(touches);

        // Calculate zoom based on pinch distance change with sensitivity multiplier
        const distanceRatio = currentDistance / touchState.initialDistance;
        // Apply sensitivity: amplify the pinch effect (2x sensitivity)
        const sensitivityMultiplier = 2.0;
        const amplifiedRatio = 1 + (distanceRatio - 1) * sensitivityMultiplier;
        const newScale = Math.min(
          ZOOM_CONSTRAINTS.max,
          Math.max(ZOOM_CONSTRAINTS.min, touchState.initialScale * amplifiedRatio)
        );

        // Calculate pan based on center point movement
        const panDeltaX = center.x - touchState.lastTouchX;

        // Apply zoom
        if (Math.abs(newScale - zoomState.scale) > 0.01) {
          const rect = scrollContainer.getBoundingClientRect();
          const relativeX = center.x - rect.left + scrollContainer.scrollLeft;
          const zoomFactor = newScale / zoomState.scale;
          const newScroll = relativeX * zoomFactor - (center.x - rect.left);

          scrollContainer.scrollLeft = newScroll - panDeltaX;
          setZoomState({ scale: newScale, scroll: newScroll });
          currentScaleRef.current = newScale;
        } else {
          // Just pan without zoom change
          scrollContainer.scrollLeft -= panDeltaX;
        }

        touchStateRef.current.lastTouchX = center.x;
      }
    },
    [timelineRef, zoomState.scale, getTouchDistance, getTouchCenter]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (event.touches.length < 2) {
        touchStateRef.current.isPinching = false;
        touchStateRef.current.isPanning = false;
      }
    },
    []
  );

  // Handle gesture events (Safari-specific for better trackpad pinch)
  const handleGestureStart = useCallback(
    (event: Event) => {
      event.preventDefault();
      const gestureEvent = event as GestureEvent;
      touchStateRef.current.initialScale = zoomState.scale;
    },
    [zoomState.scale]
  );

  const handleGestureChange = useCallback(
    (event: Event) => {
      event.preventDefault();
      const gestureEvent = event as GestureEvent;
      const scrollContainer = timelineRef?.current?.parentElement;
      if (!scrollContainer) return;

      // Apply sensitivity multiplier (2x) to trackpad pinch
      const sensitivityMultiplier = 2.0;
      const amplifiedScale = 1 + (gestureEvent.scale - 1) * sensitivityMultiplier;
      const newScale = Math.min(
        ZOOM_CONSTRAINTS.max,
        Math.max(ZOOM_CONSTRAINTS.min, touchStateRef.current.initialScale * amplifiedScale)
      );

      if (Math.abs(newScale - zoomState.scale) > 0.01) {
        const rect = scrollContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const relativeX = centerX - rect.left + scrollContainer.scrollLeft;
        const zoomFactor = newScale / zoomState.scale;
        const newScroll = relativeX * zoomFactor - (centerX - rect.left);

        scrollContainer.scrollLeft = newScroll;
        setZoomState({ scale: newScale, scroll: newScroll });
        currentScaleRef.current = newScale;
      }
    },
    [timelineRef, zoomState.scale]
  );

  const handleGestureEnd = useCallback(() => {
    // Reset gesture state
  }, []);

  // Stub methods for compatibility
  const startSliderDrag = useCallback(() => {}, []);
  const endSliderDrag = useCallback(() => {}, []);

  return {
    zoomScale: zoomState.scale,
    scrollPosition: zoomState.scroll,
    setZoomScale,
    handleZoom,
    handleWheelZoom,
    // Touch gesture handlers
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    // Safari gesture handlers
    handleGestureStart,
    handleGestureChange,
    handleGestureEnd,
    startSliderDrag,
    endSliderDrag,
  };
};

// Type for Safari's gesture events
interface GestureEvent extends Event {
  scale: number;
  rotation: number;
}
