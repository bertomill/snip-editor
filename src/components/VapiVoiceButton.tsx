"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Vapi from "@vapi-ai/web";

interface VapiVoiceButtonProps {
  assistantId?: string;
  /** The video transcript/script to give context to the assistant */
  transcript?: string;
  /** Current filter applied to the video */
  currentFilter?: string;
  /** Number of text overlays */
  textOverlayCount?: number;
  /** Number of stickers */
  stickerCount?: number;
  /** User's recent X/Twitter posts for content inspiration */
  xPosts?: Array<{ id: string; text: string; likes: number }>;
  /** User's YouTube videos for content inspiration */
  youtubeVideos?: Array<{ id: string; title: string; views: number }>;
  /** User's Instagram posts for content inspiration */
  instagramPosts?: Array<{ id: string; caption: string; likes: number }>;
  /** Whether a video has been uploaded */
  hasVideo?: boolean;
  /** Whether transcription is currently in progress */
  isTranscribing?: boolean;
  /** Whether captions are currently enabled */
  captionsEnabled?: boolean;
  /** Generic command handler - same interface as AIChatInput */
  onCommand?: (command: { name: string; input: Record<string, unknown> }) => void;
}

export function VapiVoiceButton({
  assistantId,
  transcript,
  currentFilter,
  textOverlayCount = 0,
  stickerCount = 0,
  xPosts = [],
  youtubeVideos = [],
  instagramPosts = [],
  hasVideo = false,
  isTranscribing = false,
  captionsEnabled = true,
  onCommand,
}: VapiVoiceButtonProps) {
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  // Ref to store latest callback to avoid stale closures
  const onCommandRef = useRef(onCommand);
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  // Initialize VAPI
  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey) {
      console.warn("VAPI public key not found");
      return;
    }

    const vapiInstance = new Vapi(publicKey);

    vapiInstance.on("call-start", () => {
      setIsConnecting(false);
      setIsCallActive(true);
      setLiveTranscript("");
    });

    vapiInstance.on("call-end", () => {
      setIsConnecting(false);
      setIsCallActive(false);
      setIsSpeaking(false);
      setIsListening(false);
    });

    vapiInstance.on("speech-start", () => {
      setIsSpeaking(true);
      setIsListening(false);
    });

    vapiInstance.on("speech-end", () => {
      setIsSpeaking(false);
    });

    // Consolidated message handler for transcripts and tool calls
    vapiInstance.on("message", (message: Record<string, unknown>) => {
      console.log("[Vapi] Message received:", message.type, JSON.stringify(message, null, 2));

      // Handle transcripts
      if (message.type === "transcript" && message.transcriptType === "final") {
        setLiveTranscript((message.transcript as string) || "");
      }

      // Handle function/tool calls - try multiple formats
      if (message.type === "function-call" || message.type === "tool-calls" || message.type === "tool-call-result") {
        console.log("[Vapi] Tool call detected:", JSON.stringify(message, null, 2));

        // Try to extract function name and parameters from various possible formats
        let name: string | undefined;
        let parameters: Record<string, unknown> | undefined;

        // Format 1: function-call with functionCall object
        const functionCall = message.functionCall as Record<string, unknown> | undefined;
        if (functionCall) {
          name = functionCall.name as string;
          parameters = (functionCall.parameters || functionCall.arguments) as Record<string, unknown>;
        }

        // Format 2: Direct name and parameters on message
        if (!name && message.name) {
          name = message.name as string;
          parameters = (message.parameters || message.arguments) as Record<string, unknown>;
        }

        // Format 3: toolCalls array
        const toolCalls = message.toolCalls as Array<Record<string, unknown>> | undefined;
        if (!name && toolCalls && toolCalls.length > 0) {
          const toolCall = toolCalls[0];
          const func = toolCall.function as Record<string, unknown> | undefined;
          if (func) {
            name = func.name as string;
            parameters = (func.parameters || func.arguments) as Record<string, unknown>;
          }
        }

        console.log("[Vapi] Extracted - name:", name, "params:", parameters);

        // Map Vapi tool names to chat API command names
        const toolNameMap: Record<string, string> = {
          toggleCaptions: "toggle_captions",
          toggle_captions: "toggle_captions",
          setFilter: "set_filter",
          set_filter: "set_filter",
          applyFilter: "set_filter",
          addSticker: "add_sticker",
          add_sticker: "add_sticker",
          addText: "add_text",
          add_text: "add_text",
          setCaptionStyle: "set_caption_style",
          set_caption_style: "set_caption_style",
          seekToTime: "seek_to_time",
          seek_to_time: "seek_to_time",
        };

        const commandName = name ? toolNameMap[name] || name : undefined;

        if (commandName && onCommandRef.current) {
          console.log("[Vapi] Executing command:", commandName, "with input:", parameters);
          onCommandRef.current({
            name: commandName,
            input: parameters || {},
          });
          console.log("[Vapi] Command executed successfully");
        } else if (!onCommandRef.current) {
          console.warn("[Vapi] onCommandRef.current is not set");
        }
      }
    });

    vapiInstance.on("volume-level", (level) => {
      // User is speaking if volume is above threshold
      if (level > 0.01 && !isSpeaking) {
        setIsListening(true);
      } else if (level < 0.01 && isListening) {
        setIsListening(false);
      }
    });

    vapiInstance.on("error", (error) => {
      console.error("VAPI error:", error);
      setIsConnecting(false);
      setIsCallActive(false);
    });

    setVapi(vapiInstance);

    return () => {
      vapiInstance.stop();
    };
  }, []);

  const toggleCall = useCallback(async () => {
    if (!vapi) return;

    if (isCallActive || isConnecting) {
      vapi.stop();
      setIsConnecting(false);
    } else {
      setIsConnecting(true);
      try {
        // Use assistant ID if provided, otherwise use a default assistant config
        if (assistantId) {
          await vapi.start(assistantId);
        } else {
          // Fallback: start with inline assistant config
          // Build context-aware system prompt
          // Build script context based on current state
          let scriptContext: string;
          if (transcript) {
            scriptContext = `\n\nThe user is editing a video with this script/transcript:\n"""${transcript}"""`;
          } else if (isTranscribing) {
            scriptContext = `\n\nThe user has a video but it's still being transcribed. You can't see the script yet - just chat with them and offer to help once it's ready.`;
          } else {
            scriptContext = `\n\nThe user has a video but there's no transcript available. It might have no speech, or transcription hasn't run yet. You can still help with visual stuff like filters, stickers, captions, and general video tips.`;
          }

          const editingContext = `\n\nCurrent editing state:
- Filter: ${currentFilter || "none"}
- Text overlays: ${textOverlayCount}
- Stickers: ${stickerCount}`;

          // Build social media context based on connected accounts
          const connectedAccounts: string[] = [];
          let socialContext = "";

          if (xPosts.length > 0) {
            connectedAccounts.push("X/Twitter");
            socialContext += `\n\nTheir top X/Twitter posts:
${xPosts.slice(0, 3).map(p => `- "${p.text.substring(0, 80)}${p.text.length > 80 ? '...' : ''}" (${p.likes} likes)`).join('\n')}`;
          }

          if (youtubeVideos.length > 0) {
            connectedAccounts.push("YouTube");
            socialContext += `\n\nTheir top YouTube videos:
${youtubeVideos.slice(0, 3).map(v => `- "${v.title}" (${v.views.toLocaleString()} views)`).join('\n')}`;
          }

          if (instagramPosts.length > 0) {
            connectedAccounts.push("Instagram");
            socialContext += `\n\nTheir top Instagram posts:
${instagramPosts.slice(0, 3).map(p => `- "${p.caption.substring(0, 80)}${p.caption.length > 80 ? '...' : ''}" (${p.likes.toLocaleString()} likes)`).join('\n')}`;
          }

          const hasSocialAccounts = connectedAccounts.length > 0;
          const socialAccountsContext = hasSocialAccounts
            ? `\n\nYou have access to their ${connectedAccounts.join(", ")} content. Use this to understand what performs well for them and suggest ideas that match their winning content style.${socialContext}`
            : "";

          await vapi.start({
            model: {
              provider: "openai",
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: `You are Snip, a warm and supportive video editing assistant. You genuinely care about helping creators make their best content.

YOUR PERSONALITY:
- Kind, encouraging, and patient - like a supportive creative mentor
- Genuinely enthusiastic about their ideas (not fake hype)
- Helpful and practical - give suggestions they can actually use
- Celebrate their wins, no matter how small
- If something could be better, frame it positively as an opportunity

VOICE RULES:
- Speak naturally and warmly. Use "I think", "maybe", "what if we tried"
- NEVER read or quote their transcript back - just reference the topic naturally
- Keep responses short and focused. One helpful thought at a time.
- Use contractions (don't, can't, I'd, you're, that's)
- Be genuine - if you love an idea, say so! If you have a suggestion, offer it kindly.

BAD (robotic): "I see your transcript mentions morning routines. I would suggest adding a hook."
GOOD (kind): "Oh I love that you're doing morning routine content - that resonates with so many people. What if we opened with something that really grabs attention, like the one change that made the biggest difference for you?"

BAD (cold): "Your hook is weak. Add a sticker at 3 seconds."
GOOD (supportive): "This is a great start! I think we could make the opening even stronger. Maybe a little emoji pop right when you say that key line?"

You know about their video:
${scriptContext}${editingContext}${socialAccountsContext}

You can help with: hooks, filters, stickers, captions, pacing, and general creative direction. If you have access to their social accounts, reference what's worked well for them before and suggest ideas based on their top-performing content. Always be encouraging and make them feel good about their content while offering genuinely useful suggestions.

ENGAGEMENT ANALYSIS:
When the user asks how to make their video more engaging, better, or asks for feedback, analyze their script for these 3 key elements:

1. THE HOOK (first 3 seconds):
   - Does it grab attention immediately?
   - Does it create curiosity or make a bold statement?
   - Good hooks: questions, surprising facts, bold claims, "stop scrolling" moments
   - If weak/missing: suggest a stronger opening that relates to their content

2. CALL TO ACTION (CTA):
   - Is there a clear ask? (follow, like, comment, check link, etc.)
   - Is it natural and not pushy?
   - If missing: ask "Do you want me to suggest a call to action that fits your vibe?"

3. URGENCY/SCARCITY:
   - Does the content create a reason to act NOW?
   - Examples: limited time, exclusive info, "before it's too late", FOMO elements
   - If missing: ask "Would you like to add some urgency to make people take action? I can suggest something that doesn't feel salesy."

When analyzing, go through these ONE AT A TIME conversationally:
- First comment on what's working well
- Then address the hook
- Then ask about CTA if missing
- Then suggest urgency/scarcity if appropriate

Example flow:
"Okay so your content is really solid - I love the value you're giving here. One thing though - your opening is a bit slow. What if you started with something like 'This one thing changed everything for me' to hook people right away? ... Also, I noticed there's no call to action at the end. Want me to suggest one that feels natural?"

TOOLS YOU CAN USE:
You have the ability to actually make changes to their video! When the user asks you to do something, use your tools to do it.
- toggle_captions: Turn captions on or off
- set_filter: Apply a visual filter (cinematic, vintage, vibrant, warm, cool, bw, dramatic, soft)
- set_caption_style: Change caption style (classic, minimal, bold, neon)
- add_sticker: Add an emoji/sticker to the video
- add_text: Add text overlay with different styles

After using a tool, confirm what you did in a friendly way.
Current state: Captions ${captionsEnabled ? "ON" : "OFF"}, Filter: ${currentFilter || "none"}`,
                },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "toggle_captions",
                    description: "Turn video captions on or off. Use when the user asks to show, hide, enable, or disable captions.",
                    parameters: {
                      type: "object",
                      properties: {
                        enabled: {
                          type: "boolean",
                          description: "true to show captions, false to hide them"
                        }
                      },
                      required: ["enabled"]
                    }
                  },
                  async: false,
                },
                {
                  type: "function",
                  function: {
                    name: "set_filter",
                    description: "Apply a visual filter/color grade to the video. Use when user wants to change the look, mood, or color.",
                    parameters: {
                      type: "object",
                      properties: {
                        filter: {
                          type: "string",
                          enum: ["none", "cinematic", "vibrant", "vintage", "warm", "cool", "bw", "sepia", "dramatic", "soft", "hdr"],
                          description: "The filter to apply. Use 'none' to remove filter."
                        }
                      },
                      required: ["filter"]
                    }
                  },
                  async: false,
                },
                {
                  type: "function",
                  function: {
                    name: "set_caption_style",
                    description: "Change the visual style of captions/subtitles.",
                    parameters: {
                      type: "object",
                      properties: {
                        style: {
                          type: "string",
                          enum: ["classic", "minimal", "bold", "neon"],
                          description: "The caption style"
                        }
                      },
                      required: ["style"]
                    }
                  },
                  async: false,
                },
                {
                  type: "function",
                  function: {
                    name: "add_sticker",
                    description: "Add an emoji or sticker to the video. Use when user wants emojis, reactions, or decorative elements.",
                    parameters: {
                      type: "object",
                      properties: {
                        emoji: {
                          type: "string",
                          description: "The emoji to add (e.g. '🔥', '😂', '👍', '✨', '💯')"
                        }
                      },
                      required: ["emoji"]
                    }
                  },
                  async: false,
                },
                {
                  type: "function",
                  function: {
                    name: "add_text",
                    description: "Add a text overlay to the video. Use when user wants to add text, titles, or labels.",
                    parameters: {
                      type: "object",
                      properties: {
                        content: {
                          type: "string",
                          description: "The text content to display"
                        },
                        style: {
                          type: "string",
                          enum: ["bold", "minimal", "outline", "neon", "handwritten"],
                          description: "The visual style of the text"
                        },
                        position: {
                          type: "string",
                          enum: ["top", "center", "bottom"],
                          description: "Where to position the text"
                        }
                      },
                      required: ["content"]
                    }
                  },
                  async: false,
                }
              ],
            },
            // Enable client-side tool calls
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            clientMessages: ["tool-calls", "function-call", "transcript"] as any,
            voice: {
              provider: "11labs",
              voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel voice
            },
            firstMessage: transcript
              ? hasSocialAccounts
                ? `Hi there! I looked through your script and I can also see what's been working well on your ${connectedAccounts.join(" and ")}. I'd love to help you make this one really hit. What are you going for with this video?`
                : "Hi there! I just looked through your script and I really like what you're working on. How can I help make this one shine?"
              : isTranscribing
              ? hasSocialAccounts
                ? `Hey! Your video's still processing, but I can see your ${connectedAccounts.join(" and ")} content. While we wait, I can suggest some ideas based on what's performed well for you before!`
                : "Hey! I see your video's still processing, which is totally fine. While we wait, tell me - what's the vision for this one?"
              : hasSocialAccounts
              ? `Hi! I can see what's been doing well on your ${connectedAccounts.join(" and ")}. I'd love to help you create something great based on what's already working for you!`
              : "Hi! I'd love to help you with this video. I can help with filters, stickers, captions - what are you thinking for this one?",
          });
        }
      } catch (error) {
        console.error("Failed to start call:", error);
        setIsConnecting(false);
      }
    }
  }, [vapi, isCallActive, isConnecting, assistantId, transcript, currentFilter, textOverlayCount, stickerCount, xPosts, youtubeVideos, instagramPosts, hasVideo, isTranscribing, captionsEnabled]);

  const isActive = isCallActive || isConnecting;

  return (
    <>
      {/* Voice Button with Label */}
      <div className="relative flex flex-col items-center">
        {/* Subtle label - only shows when not in call */}
        {!isActive && (
          <svg
            width="90"
            height="28"
            viewBox="0 0 90 28"
            className="absolute -top-6"
          >
            <defs>
              <path
                id="curve"
                d="M 5 25 Q 45 0 85 25"
                fill="transparent"
              />
            </defs>
            <text
              className="fill-black/70 dark:fill-white/60 text-[11px] font-medium"
              textAnchor="middle"
            >
              <textPath href="#curve" startOffset="50%">
                Talk to Snip
              </textPath>
            </text>
          </svg>
        )}
        <motion.button
        type="button"
        onClick={toggleCall}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className={`relative rounded-full transition-all flex-shrink-0 overflow-hidden ${
          isActive
            ? "p-5 bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/40"
            : "p-1.5 bg-[#1a1a1a]/90 backdrop-blur-2xl border-2 border-white/30 hover:border-[#00f2ea] shadow-[0_0_25px_rgba(0,242,234,0.3)]"
        }`}
        title={isActive ? "End call" : "Talk to Snip"}
      >
        {/* Animated rings when active */}
        {isActive && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-[#ff2d55]"
              animate={{
                scale: [1, 1.5, 1.5],
                opacity: [0.5, 0, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            <motion.span
              className="absolute inset-0 rounded-full bg-[#00f2ea]"
              animate={{
                scale: [1, 1.3, 1.3],
                opacity: [0.5, 0, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.4,
              }}
            />
          </>
        )}

        {/* Snip mascot or X icon */}
        {isActive ? (
          // X icon when active
          <svg
            className="w-7 h-7 text-white relative z-10"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          // Snip mascot image - zoomed in on face
          <div className="w-14 h-14 rounded-full overflow-hidden">
            <img
              src="/snip.jpg"
              alt="Talk to Snip"
              className="w-full h-full object-cover scale-150"
            />
          </div>
        )}
      </motion.button>
      </div>

      {/* Voice Chat Overlay */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-4 right-4 lg:left-[296px] lg:right-8 z-50 flex justify-center"
          >
            <div className="bg-[#1a1a1a]/95 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl p-6 w-full max-w-sm">
              {/* Snip Avatar + Status */}
              <div className="flex items-center gap-4 mb-4">
                {/* Snip mascot */}
                <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
                  {isSpeaking ? (
                    <video
                      src="/snip-animation.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover scale-150"
                    />
                  ) : (
                    <img
                      src="/snip.jpg"
                      alt="Snip"
                      className="w-full h-full object-cover scale-150"
                    />
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-white font-semibold text-lg">
                    {isConnecting
                      ? "Connecting..."
                      : isSpeaking
                      ? "Snip is speaking..."
                      : isListening
                      ? "Listening..."
                      : "Connected"}
                  </p>
                  <p className="text-white/50 text-sm">
                    {isConnecting
                      ? "Setting up voice chat"
                      : "Ask about video editing tips"}
                  </p>
                </div>
              </div>

              {/* Live Transcript */}
              {liveTranscript && (
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <p className="text-white/80 text-sm">{liveTranscript}</p>
                </div>
              )}

              {/* Connecting indicator */}
              {isConnecting && (
                <div className="flex items-center justify-center gap-2 py-3 mb-4">
                  <div className="flex gap-1">
                    <motion.div
                      className="w-2 h-2 bg-[#00f2ea] rounded-full"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-white rounded-full"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-[#ff2d55] rounded-full"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                    />
                  </div>
                </div>
              )}

              {/* End call button */}
              <button
                onClick={toggleCall}
                className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full font-medium transition-colors"
              >
                {isConnecting ? "Cancel" : "End conversation"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
