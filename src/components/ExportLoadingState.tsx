"use client";

/**
 * Export Loading State - Adapted from kokonutui
 * Shows animated progress during video export
 */

import { useEffect, useState, useRef } from "react";

const EXPORT_SEQUENCES = {
  preparing: {
    status: "Preparing your video",
    lines: [
      "Analyzing video clips...",
      "Processing timeline edits...",
      "Preparing caption overlays...",
      "Optimizing for export...",
      "Initializing render engine...",
    ],
  },
  converting: {
    status: "Converting video formats",
    lines: [
      "Reading source video...",
      "Decoding video frames...",
      "Converting to MP4 format...",
      "Encoding with H.264...",
      "Optimizing audio tracks...",
      "Finalizing conversion...",
    ],
  },
  rendering: {
    status: "Rendering your video",
    lines: [
      "Starting cloud render...",
      "Compositing video layers...",
      "Applying visual effects...",
      "Burning in captions...",
      "Processing audio mix...",
      "Encoding final output...",
      "Optimizing for playback...",
      "Finalizing video...",
    ],
  },
};

const LoadingAnimation = ({ progress }: { progress: number }) => (
  <div className="relative w-6 h-6">
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-label={`Loading progress: ${Math.round(progress)}%`}
    >
      <title>Loading Progress Indicator</title>

      <defs>
        <mask id="export-progress-mask">
          <rect width="240" height="240" fill="black" />
          <circle
            r="120"
            cx="120"
            cy="120"
            fill="white"
            strokeDasharray={`${(progress / 100) * 754}, 754`}
            transform="rotate(-90 120 120)"
          />
        </mask>
      </defs>

      <style>
        {`
          @keyframes rotate-cw {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes rotate-ccw {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          .export-spin circle {
            transform-origin: 120px 120px;
          }
          .export-spin circle:nth-child(1) { animation: rotate-cw 8s linear infinite; }
          .export-spin circle:nth-child(2) { animation: rotate-ccw 8s linear infinite; }
          .export-spin circle:nth-child(3) { animation: rotate-cw 8s linear infinite; }
          .export-spin circle:nth-child(4) { animation: rotate-ccw 8s linear infinite; }
          .export-spin circle:nth-child(5) { animation: rotate-cw 8s linear infinite; }
          .export-spin circle:nth-child(6) { animation: rotate-ccw 8s linear infinite; }

          .export-spin circle:nth-child(2n) { animation-delay: 0.2s; }
          .export-spin circle:nth-child(3n) { animation-delay: 0.3s; }
        `}
      </style>

      <g
        className="export-spin"
        strokeWidth="16"
        strokeDasharray="18% 40%"
        mask="url(#export-progress-mask)"
      >
        <circle r="150" cx="120" cy="120" stroke="#FF2E7E" opacity="0.95" />
        <circle r="130" cx="120" cy="120" stroke="#00E5FF" opacity="0.95" />
        <circle r="110" cx="120" cy="120" stroke="#4ADE80" opacity="0.95" />
        <circle r="90" cx="120" cy="120" stroke="#FFA726" opacity="0.95" />
        <circle r="70" cx="120" cy="120" stroke="#FFEB3B" opacity="0.95" />
        <circle r="50" cx="120" cy="120" stroke="#FF4081" opacity="0.95" />
      </g>
    </svg>
  </div>
);

interface ExportLoadingStateProps {
  status: 'preparing' | 'converting' | 'rendering';
  progress: number;
}

export default function ExportLoadingState({ status, progress }: ExportLoadingStateProps) {
  const [visibleLines, setVisibleLines] = useState<Array<{ text: string; number: number }>>([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const lineHeight = 24;

  const currentSequence = EXPORT_SEQUENCES[status];
  const totalLines = currentSequence.lines.length;

  // Reset when status changes
  useEffect(() => {
    const initialLines = [];
    for (let i = 0; i < Math.min(3, totalLines); i++) {
      initialLines.push({
        text: currentSequence.lines[i],
        number: i + 1,
      });
    }
    setVisibleLines(initialLines);
    setScrollPosition(0);
  }, [status, currentSequence.lines, totalLines]);

  // Handle line advancement
  useEffect(() => {
    const advanceTimer = setInterval(() => {
      const firstVisibleLineIndex = Math.floor(scrollPosition / lineHeight);
      const nextLineIndex = firstVisibleLineIndex + 3;

      // Loop back to start if we've shown all lines
      if (nextLineIndex >= totalLines) {
        setVisibleLines(
          currentSequence.lines.slice(0, Math.min(3, totalLines)).map((text, i) => ({
            text,
            number: i + 1,
          }))
        );
        setScrollPosition(0);
        return;
      }

      // Add the next line
      if (nextLineIndex < totalLines) {
        setVisibleLines((prevLines) => [
          ...prevLines,
          {
            text: currentSequence.lines[nextLineIndex],
            number: nextLineIndex + 1,
          },
        ]);
      }

      // Scroll to the next line
      setScrollPosition((prevPosition) => prevPosition + lineHeight);
    }, 2500);

    return () => clearInterval(advanceTimer);
  }, [scrollPosition, totalLines, currentSequence.lines, lineHeight]);

  // Apply scroll position
  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  return (
    <div className="space-y-3">
      {/* Header with animated icon and status */}
      <div className="flex items-center gap-3">
        <LoadingAnimation progress={progress} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm">{currentSequence.status}...</p>
          <p className="text-[#8E8E93] text-xs">{Math.round(progress)}% complete</p>
        </div>
      </div>

      {/* Scrolling task lines */}
      <div className="relative">
        <div
          ref={codeContainerRef}
          className="font-mono text-[11px] overflow-hidden w-full h-[72px] relative rounded-lg bg-[#0D0D0D]"
          style={{ scrollBehavior: "smooth" }}
        >
          <div className="p-2">
            {visibleLines.map((line) => (
              <div
                key={`${line.number}-${line.text}`}
                className="flex h-[24px] items-center"
              >
                <div className="text-[#4A8FE7] pr-2 select-none w-5 text-right font-medium">
                  {line.number}
                </div>
                <div className="text-[#A0A0A0] flex-1 ml-1">
                  {line.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gradient overlay for fade effect */}
        <div
          className="absolute top-0 left-0 right-0 h-6 pointer-events-none rounded-t-lg"
          style={{
            background: "linear-gradient(to bottom, rgba(13,13,13,0.9) 0%, transparent 100%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none rounded-b-lg"
          style={{
            background: "linear-gradient(to top, rgba(13,13,13,0.9) 0%, transparent 100%)",
          }}
        />
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-[#2C2C2E] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status === 'converting'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500'
              : 'bg-gradient-to-r from-[#4A8FE7] to-[#5F7BFD]'
          }`}
          style={{ width: `${Math.max(progress, 2)}%` }}
        />
      </div>
    </div>
  );
}
