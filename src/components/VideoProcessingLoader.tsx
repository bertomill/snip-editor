"use client";

/**
 * Video Processing Loader
 * Animated loading text that cycles through contextual messages
 * Based on kokonutui's AITextLoading component
 */

import { cn } from "@/lib/utils/cn";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState, useMemo } from "react";

type ProcessingStage =
  | "converting"
  | "uploading"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "processing"
  | "idle";

interface VideoProcessingLoaderProps {
  stage?: ProcessingStage;
  className?: string;
  interval?: number;
  progress?: number;
  clipCount?: number;
  currentClip?: number;
}

const stageMessages: Record<ProcessingStage, string[]> = {
  converting: [
    "Converting video format...",
    "Preparing for playback...",
    "Optimizing for preview...",
    "Making it browser-friendly...",
    "Almost ready to view...",
  ],
  uploading: [
    "Uploading your video...",
    "Sending to the cloud...",
    "Securing your content...",
    "Transfer in progress...",
    "Almost there...",
  ],
  transcribing: [
    "Listening to your video...",
    "Detecting speech patterns...",
    "Converting speech to text...",
    "Finding the perfect words...",
    "Removing word gaps...",
    "AI is working its magic...",
    "Understanding your content...",
    "Capturing every word...",
    "Almost done listening...",
  ],
  analyzing: [
    "Analyzing your content...",
    "Finding key moments...",
    "Detecting pauses...",
    "Identifying speakers...",
    "Processing audio...",
  ],
  rendering: [
    "Rendering your video...",
    "Applying your edits...",
    "Cutting and splicing...",
    "Adding captions...",
    "Polishing the final cut...",
    "Making it perfect...",
    "Almost ready to download...",
  ],
  processing: [
    "Processing...",
    "Working on it...",
    "Just a moment...",
    "Hang tight...",
    "Almost there...",
  ],
  idle: [
    "Ready when you are...",
  ],
};

export default function VideoProcessingLoader({
  stage = "processing",
  className,
  interval = 2500,
  progress,
  clipCount,
  currentClip,
}: VideoProcessingLoaderProps) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  const texts = useMemo(() => stageMessages[stage], [stage]);

  useEffect(() => {
    // Reset index when stage changes
    setCurrentTextIndex(0);
  }, [stage]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval, texts.length]);

  // Build subtitle text
  const subtitle = useMemo(() => {
    if (clipCount && currentClip !== undefined) {
      return `Clip ${currentClip} of ${clipCount}`;
    }
    if (progress !== undefined) {
      return `${Math.round(progress)}% complete`;
    }
    return null;
  }, [clipCount, currentClip, progress]);

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-4">
      <motion.div
        className="relative px-4 py-2 w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${stage}-${currentTextIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: 1,
              y: 0,
              backgroundPosition: ["200% center", "-200% center"],
            }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              opacity: { duration: 0.3 },
              y: { duration: 0.3 },
              backgroundPosition: {
                duration: 3,
                ease: "linear",
                repeat: Infinity,
              },
            }}
            className={cn(
              "flex justify-center text-xl md:text-2xl font-semibold",
              "bg-gradient-to-r from-white via-[#4A8FE7] to-white",
              "bg-[length:200%_100%] bg-clip-text text-transparent",
              "whitespace-nowrap min-w-max",
              className
            )}
          >
            {texts[currentTextIndex]}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Subtitle with progress info */}
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-[#636366]"
        >
          {subtitle}
        </motion.p>
      )}

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="w-48 h-1 bg-[#252A35] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#4A8FE7] to-[#5A9FF7]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      )}
    </div>
  );
}

// Compact version for inline use (like in the transcript drawer)
export function VideoProcessingLoaderCompact({
  stage = "processing",
  className,
  interval = 2000,
}: Pick<VideoProcessingLoaderProps, "stage" | "className" | "interval">) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const texts = useMemo(() => stageMessages[stage], [stage]);

  useEffect(() => {
    setCurrentTextIndex(0);
  }, [stage]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
    }, interval);
    return () => clearInterval(timer);
  }, [interval, texts.length]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={`${stage}-${currentTextIndex}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn("text-[#8E8E93]", className)}
      >
        {texts[currentTextIndex]}
      </motion.span>
    </AnimatePresence>
  );
}
