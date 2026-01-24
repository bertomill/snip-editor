import { useState, useCallback, useRef } from 'react';

export const useTimelineInteractions = (
  timelineRef: React.RefObject<HTMLDivElement> | React.RefObject<HTMLDivElement | null>,
  zoomScale: number = 1
) => {
  const [isDragging, setIsDragging] = useState(false);
  const throttleRef = useRef<number | null>(null);
  const lastPositionRef = useRef<number | null>(null);
  const isGhostMarkerVisibleRef = useRef<boolean>(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging && timelineRef.current) {
      if (throttleRef.current) {
        cancelAnimationFrame(throttleRef.current);
      }

      const clientX = e.clientX;

      throttleRef.current = requestAnimationFrame(() => {
        const element = timelineRef.current;
        if (!element) return;

        const container = document.querySelector('.timeline-markers-container') as HTMLElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const x = clientX - rect.left;
        const position = Math.max(0, Math.min(100, (x / rect.width) * 100));

        const threshold = Math.max(0.001, 0.1 / zoomScale);

        if (lastPositionRef.current === null || Math.abs(position - lastPositionRef.current) > threshold) {
          const precision = zoomScale > 10 ? 6 : zoomScale > 5 ? 4 : 2;

          const rootContainer = element.parentElement?.parentElement;
          if (rootContainer) {
            rootContainer.style.setProperty('--ghost-marker-position', `${position.toFixed(precision)}%`);
            rootContainer.style.setProperty('--ghost-marker-visible', '1');
          }

          lastPositionRef.current = position;
          isGhostMarkerVisibleRef.current = true;
        }
      });
    }
  }, [isDragging, timelineRef, zoomScale]);

  const handleMouseLeave = useCallback(() => {
    if (throttleRef.current) {
      cancelAnimationFrame(throttleRef.current);
      throttleRef.current = null;
    }

    if (timelineRef.current && isGhostMarkerVisibleRef.current) {
      const rootContainer = timelineRef.current.parentElement?.parentElement;
      if (rootContainer) {
        rootContainer.style.setProperty('--ghost-marker-visible', '0');
      }
      isGhostMarkerVisibleRef.current = false;
    }

    lastPositionRef.current = null;
  }, [timelineRef]);

  return {
    ghostMarkerPosition: null,
    isDragging,
    setIsDragging,
    handleMouseMove,
    handleMouseLeave,
  };
};
