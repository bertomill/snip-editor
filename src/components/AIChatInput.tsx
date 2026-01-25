"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";

interface EditorContext {
  duration: number;
  currentTime: number;
  captionsEnabled: boolean;
  currentFilter: string | null;
  textOverlayCount: number;
  stickerCount: number;
  hasTranscript: boolean;
}

interface AIChatInputProps {
  context: EditorContext;
  onCommand: (command: { name: string; input: Record<string, unknown> }) => void;
}

export function AIChatInput({ context, onCommand }: AIChatInputProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mouse tracking for glow effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userInput = input.trim();
      setInput("");
      setIsLoading(true);
      setFeedback(null);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userInput,
            context,
          }),
        });

        if (!response.ok) throw new Error("Failed to get response");

        const data = await response.json();

        // Execute the tool call if present
        if (data.toolCall) {
          try {
            onCommand(data.toolCall);
            setFeedback({ type: "success", message: data.response || "Done!" });
          } catch {
            setFeedback({ type: "error", message: "Failed to apply change" });
          }
        } else if (data.response) {
          setFeedback({ type: "success", message: data.response });
        }

        // Clear feedback after 3 seconds
        setTimeout(() => setFeedback(null), 3000);
      } catch (error) {
        console.error("Chat error:", error);
        setFeedback({ type: "error", message: "Something went wrong. Try again." });
        setTimeout(() => setFeedback(null), 3000);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, context, onCommand]
  );

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Outer glow wrapper */}
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: useMotionTemplate`
            radial-gradient(
              ${isHovered ? "300px" : "0px"} circle at ${mouseX}px ${mouseY}px,
              rgba(99, 179, 237, 0.6),
              transparent 70%
            )
          `,
        }}
        className="rounded-full p-[2px] transition-all duration-300 shadow-[0_0_30px_rgba(74,143,231,0.3)]"
      >
        <div className="flex items-center gap-4 bg-[#1a1a1a]/90 backdrop-blur-2xl rounded-full px-6 py-5 border border-white/20 shadow-2xl">
          {/* Sparkle icon */}
          <svg
            className="w-7 h-7 text-[#4A8FE7] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell Snip what to change..."
            className="flex-1 bg-transparent text-white text-lg placeholder:text-white/50 focus:outline-none min-w-0"
            disabled={isLoading}
          />

          {/* Send button - only show when there's input */}
          {(input.trim() || isLoading) && (
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-3 bg-[#4A8FE7] hover:bg-[#5A9FF7] disabled:opacity-40 rounded-full transition-all flex-shrink-0 shadow-lg shadow-[#4A8FE7]/30"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"
                  />
                </svg>
              )}
            </button>
          )}
        </div>
      </motion.div>

      {/* Feedback message */}
      {feedback && (
        <div
          className={`absolute -top-14 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap backdrop-blur-xl ${
            feedback.type === "success"
              ? "bg-green-500/20 text-green-300 border border-green-500/30"
              : "bg-red-500/20 text-red-300 border border-red-500/30"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </form>
  );
}
