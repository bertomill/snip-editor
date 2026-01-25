"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "motion/react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCall?: {
    name: string;
    input: Record<string, unknown>;
  };
  status?: "pending" | "success" | "error";
}

interface EditorContext {
  duration: number;
  currentTime: number;
  captionsEnabled: boolean;
  currentFilter: string | null;
  textOverlayCount: number;
  stickerCount: number;
  hasTranscript: boolean;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: EditorContext;
  onCommand: (command: { name: string; input: Record<string, unknown> }) => void;
}

export function ChatPanel({ isOpen, onClose, context, onCommand }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey! I'm Eddie, your editing assistant. Tell me what you want to do:\n\n• \"Add text saying 'Subscribe' at the bottom\"\n• \"Apply a cinematic filter\"\n• \"Turn on captions\"\n• \"Remove the silences\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: input.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: input.trim(),
            context,
          }),
        });

        if (!response.ok) throw new Error("Failed to get response");

        const data = await response.json();

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.response || "Done!",
          toolCall: data.toolCall,
          status: data.toolCall ? "pending" : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Execute the tool call if present
        if (data.toolCall) {
          try {
            onCommand(data.toolCall);
            // Update status to success
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id ? { ...m, status: "success" } : m
              )
            );
          } catch {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id ? { ...m, status: "error" } : m
              )
            );
          }
        }
      } catch (error) {
        console.error("Chat error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Sorry, I had trouble processing that. Please try again.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, context, onCommand]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[#1C1C1E] border-l border-[var(--border)] z-50 flex flex-col animate-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          {/* Eddie Avatar - Animated */}
          <div className="relative w-10 h-10">
            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6366f1] to-[#4A8FE7]"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.5, 0.3, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            {/* Main avatar circle */}
            <motion.div
              className="absolute inset-1 rounded-full bg-gradient-to-br from-[#4A8FE7] to-[#6366f1] flex items-center justify-center shadow-lg"
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {/* Face - simple friendly expression */}
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Eyes */}
                <motion.div
                  className="absolute flex gap-1.5"
                  style={{ top: '35%' }}
                  animate={{
                    scaleY: [1, 0.1, 1],
                  }}
                  transition={{
                    duration: 0.15,
                    repeat: Infinity,
                    repeatDelay: 3,
                  }}
                >
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </motion.div>
                {/* Smile */}
                <svg className="absolute w-4 h-4 text-white" style={{ top: '50%' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                </svg>
              </div>
            </motion.div>
            {/* Sparkle accent */}
            <motion.div
              className="absolute -top-0.5 -right-0.5 w-3 h-3"
              animate={{
                scale: [1, 1.3, 1],
                rotate: [0, 180, 360],
                opacity: [1, 0.7, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-full h-full drop-shadow-sm">
                <path d="M12 0L14 8L22 10L14 12L12 20L10 12L2 10L10 8L12 0Z" />
              </svg>
            </motion.div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Eddie</h3>
            <p className="text-[10px] text-[#8E8E93]">Your editing assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5 text-[#8E8E93]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                message.role === "user"
                  ? "bg-[#4A8FE7] text-white"
                  : "bg-[#2C2C2E] text-white"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              {message.toolCall && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1.5">
                    {message.status === "pending" && (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {message.status === "success" && (
                      <svg
                        className="w-3.5 h-3.5 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {message.status === "error" && (
                      <svg
                        className="w-3.5 h-3.5 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className="text-[10px] text-white/60">
                      {message.toolCall.name.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 bg-[#2C2C2E] rounded-xl px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to edit your video..."
            className="flex-1 bg-transparent text-white placeholder:text-[#636366] text-sm focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-[#4A8FE7] hover:bg-[#3A7FD7] disabled:opacity-40 disabled:hover:bg-[#4A8FE7] rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-[#636366] mt-2 text-center">
          Try: &quot;Add bold text saying Hello&quot; or &quot;Make it look cinematic&quot;
        </p>
      </form>
    </div>
  );
}
