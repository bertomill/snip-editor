import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TextOverlay } from '@/types/overlays';
import { getTextStyleById, getDefaultTextStyle } from '../templates/text-templates';
import { AnimatedWrapper } from './animated-wrapper';

interface TextLayerProps {
  textOverlays: TextOverlay[];
  fps: number;
}

/**
 * Renders text overlays with styling and animations
 */
export const TextLayer: React.FC<TextLayerProps> = ({ textOverlays, fps }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {textOverlays.map((overlay) => {
        const startFrame = Math.floor((overlay.startMs / 1000) * fps);
        const durationFrames = Math.floor((overlay.durationMs / 1000) * fps);
        const style = getTextStyleById(overlay.templateId) || getDefaultTextStyle();

        // Position mapping
        const positionStyles: React.CSSProperties = {
          position: 'absolute',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: '20px',
        };

        switch (overlay.position) {
          case 'top':
            positionStyles.top = '10%';
            break;
          case 'center':
            positionStyles.top = '50%';
            positionStyles.transform = 'translateY(-50%)';
            break;
          case 'bottom':
            positionStyles.bottom = '15%';
            break;
        }

        // Handle gradient backgrounds specially
        const isGradient = style.backgroundColor?.includes('gradient');
        const backgroundStyle: React.CSSProperties = isGradient
          ? { background: style.backgroundColor }
          : { backgroundColor: style.backgroundColor };

        return (
          <Sequence
            key={overlay.id}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <div style={positionStyles}>
              <AnimatedWrapper
                animationId={overlay.animationId}
                startFrame={startFrame}
                durationFrames={durationFrames}
                fps={fps}
              >
                <div
                  style={{
                    fontFamily: style.fontFamily,
                    fontSize: style.fontSize,
                    fontWeight: style.fontWeight,
                    color: style.color,
                    textShadow: style.textShadow,
                    borderRadius: style.borderRadius,
                    padding: style.padding,
                    letterSpacing: style.letterSpacing,
                    textAlign: 'center',
                    maxWidth: '90%',
                    wordBreak: 'break-word',
                    ...backgroundStyle,
                  }}
                >
                  {overlay.content}
                </div>
              </AnimatedWrapper>
            </div>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
