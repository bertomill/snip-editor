"use client";

import React from 'react';
import { TextOverlay } from '@/types/overlays';
import { getTextStyleById } from '@/lib/templates/text-templates';

interface TextOverlayPreviewProps {
  textOverlays: TextOverlay[];
  currentTimeMs: number;
}

/**
 * Renders active text overlays on the video preview
 * Shows text based on current playback time and overlay timing
 */
export function TextOverlayPreview({
  textOverlays,
  currentTimeMs,
}: TextOverlayPreviewProps) {
  // Filter to only show overlays that are active at current time
  const activeOverlays = textOverlays.filter(overlay => {
    const endMs = overlay.startMs + overlay.durationMs;
    return currentTimeMs >= overlay.startMs && currentTimeMs < endMs;
  });

  if (activeOverlays.length === 0) return null;

  return (
    <>
      {activeOverlays.map(overlay => {
        const style = getTextStyleById(overlay.templateId);
        if (!style) return null;

        // Check if backgroundColor is a gradient
        const isGradient = style.backgroundColor?.includes('gradient');

        return (
          <div
            key={overlay.id}
            className="absolute pointer-events-none"
            style={{
              left: `${overlay.position.x}%`,
              top: `${overlay.position.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
            }}
          >
            <div
              style={{
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                color: style.color,
                textShadow: style.textShadow,
                letterSpacing: style.letterSpacing,
                padding: style.padding,
                borderRadius: style.borderRadius,
                // Handle both solid colors and gradients
                ...(style.backgroundColor && !isGradient && {
                  backgroundColor: style.backgroundColor,
                }),
                ...(isGradient && {
                  background: style.backgroundColor,
                }),
                whiteSpace: 'nowrap',
                textAlign: 'center',
              }}
            >
              {overlay.content}
            </div>
          </div>
        );
      })}
    </>
  );
}
