/**
 * AI Auto-transitions for clip boundaries
 *
 * Automatically applies TikTok-style transitions when multiple clips are loaded.
 * The algorithm uses smart defaults based on clip count and content type.
 */
import { ClipTransition, TransitionType } from "@/types/overlays";
import { transitionTemplates } from "@/lib/templates/transition-templates";

export interface ClipInfo {
  duration: number; // Duration in seconds
  index: number;
}

/**
 * Distribution weights for auto-selection
 * zoom-punch is most common in TikTok-style edits
 */
const TRANSITION_WEIGHTS: Record<TransitionType, number> = {
  'none': 0,
  'zoom-punch': 60,  // Most TikTok-like, very common
  'flash': 20,       // Good for emphasis
  'shake': 10,       // For energetic content
  'glitch': 5,       // For tech/gaming content
  'whip-pan': 3,     // Less common, more cinematic
  'speed-ramp': 2,   // Reserved for longer clips
};

/**
 * Select a random transition type based on weights
 */
function selectRandomTransition(seed: number): TransitionType {
  const totalWeight = Object.values(TRANSITION_WEIGHTS).reduce((a, b) => a + b, 0);
  let random = (seed * 9301 + 49297) % 233280 / 233280.0 * totalWeight;

  for (const [type, weight] of Object.entries(TRANSITION_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      return type as TransitionType;
    }
  }

  return 'zoom-punch'; // Fallback
}

/**
 * Generate auto-transitions for a list of clips
 *
 * Rules:
 * - Transitions are applied BETWEEN clips (after clip N ends, before clip N+1 starts)
 * - No transition after the last clip
 * - Smart selection based on clip duration and position
 *
 * @param clips - Array of clip info
 * @param strategy - 'consistent' uses same transition, 'varied' alternates
 */
export function generateAutoTransitions(
  clips: ClipInfo[],
  strategy: 'consistent' | 'varied' = 'varied'
): ClipTransition[] {
  // Need at least 2 clips to have transitions
  if (clips.length < 2) {
    return [];
  }

  const transitions: ClipTransition[] = [];
  const baseTransition = 'zoom-punch'; // Most TikTok-like

  for (let i = 0; i < clips.length - 1; i++) {
    const clip = clips[i];

    // Determine transition type
    let transitionType: TransitionType;

    if (strategy === 'consistent') {
      // Use same transition for all cuts
      transitionType = baseTransition;
    } else {
      // Varied strategy: mostly zoom-punch with occasional variety
      if (i === 0 || i === clips.length - 2) {
        // First and last transitions are usually zoom-punch for consistency
        transitionType = baseTransition;
      } else {
        // Middle transitions can vary
        transitionType = selectRandomTransition(i * 1000 + clip.duration * 100);

        // Keep it mostly zoom-punch (70% chance to override)
        if (Math.random() > 0.3) {
          transitionType = baseTransition;
        }
      }
    }

    // Get default duration from template
    const template = transitionTemplates[transitionType];
    const durationFrames = template?.durationFrames || 6;

    transitions.push({
      id: `transition-${i}-${Date.now()}`,
      type: transitionType,
      clipIndex: i,
      durationFrames,
      intensity: 1.0, // Default intensity
    });
  }

  return transitions;
}

/**
 * Generate transitions with specific type for all cuts
 * Useful when user wants to apply same transition everywhere
 */
export function generateUniformTransitions(
  clips: ClipInfo[],
  transitionType: TransitionType,
  intensity: number = 1.0
): ClipTransition[] {
  if (clips.length < 2 || transitionType === 'none') {
    return [];
  }

  const template = transitionTemplates[transitionType];
  const durationFrames = template?.durationFrames || 6;

  const transitions: ClipTransition[] = [];

  for (let i = 0; i < clips.length - 1; i++) {
    transitions.push({
      id: `transition-${i}-${Date.now()}`,
      type: transitionType,
      clipIndex: i,
      durationFrames,
      intensity,
    });
  }

  return transitions;
}

/**
 * Get suggested transition type based on content
 * This could be enhanced with AI analysis in the future
 */
export function suggestTransitionType(
  clipDuration: number,
  isFirstClip: boolean,
  isLastClip: boolean,
  contentHint?: 'energetic' | 'calm' | 'tech' | 'cinematic'
): TransitionType {
  // Short clips (< 3s) work well with quick transitions
  if (clipDuration < 3) {
    if (contentHint === 'tech') return 'glitch';
    if (contentHint === 'energetic') return 'shake';
    return 'zoom-punch';
  }

  // Medium clips (3-8s) - standard transitions
  if (clipDuration < 8) {
    if (contentHint === 'cinematic') return 'whip-pan';
    if (contentHint === 'energetic') return 'flash';
    return 'zoom-punch';
  }

  // Longer clips (> 8s) - can use more dramatic transitions
  if (contentHint === 'cinematic') return 'speed-ramp';
  if (contentHint === 'energetic') return 'shake';
  return 'zoom-punch';
}

/**
 * Validate and fix transitions array
 * Ensures clipIndex values are valid and sorted
 */
export function validateTransitions(
  transitions: ClipTransition[],
  clipCount: number
): ClipTransition[] {
  return transitions
    .filter(t => t.clipIndex >= 0 && t.clipIndex < clipCount - 1)
    .sort((a, b) => a.clipIndex - b.clipIndex)
    .filter((t, i, arr) => i === 0 || arr[i - 1].clipIndex !== t.clipIndex);
}

/**
 * Cut point representing where a silence was removed
 */
export interface CutPoint {
  clipIndex: number;
  cutTimeMs: number;  // Timestamp in the OUTPUT video where the cut occurs
  silenceDuration: number; // How long the removed silence was (for selecting transition type)
}

/**
 * Generate transitions for internal cuts (silence removal points)
 *
 * These transitions are applied WITHIN a clip where silences were removed,
 * making the jump cuts smoother with visual effects.
 *
 * @param cutPoints - Array of cut point info
 * @param transitionType - 'auto' selects based on silence duration, or specify a type
 */
export function generateInternalCutTransitions(
  cutPoints: CutPoint[],
  transitionType: TransitionType | 'auto' = 'auto'
): ClipTransition[] {
  if (cutPoints.length === 0) {
    return [];
  }

  const transitions: ClipTransition[] = [];

  for (let i = 0; i < cutPoints.length; i++) {
    const cut = cutPoints[i];

    // Select transition type based on silence duration or use specified type
    let type: TransitionType;
    if (transitionType === 'auto') {
      // Longer silences = more noticeable jumps = stronger transitions
      if (cut.silenceDuration > 1.5) {
        // Long pause: use flash or zoom-punch for emphasis
        type = Math.random() > 0.5 ? 'flash' : 'zoom-punch';
      } else if (cut.silenceDuration > 0.8) {
        // Medium pause: mostly zoom-punch
        type = 'zoom-punch';
      } else {
        // Short pause: subtle zoom-punch with lower intensity
        type = 'zoom-punch';
      }
    } else {
      type = transitionType;
    }

    const template = transitionTemplates[type];
    const durationFrames = template?.durationFrames || 6;

    // Adjust intensity based on silence duration
    // Shorter silences get subtler transitions
    const intensity = cut.silenceDuration > 1.0 ? 1.0 :
                     cut.silenceDuration > 0.5 ? 0.8 : 0.6;

    transitions.push({
      id: `internal-cut-${cut.clipIndex}-${i}-${Date.now()}`,
      type,
      clipIndex: cut.clipIndex,
      durationFrames,
      intensity,
      cutTimeMs: cut.cutTimeMs,
    });
  }

  return transitions;
}

/**
 * Calculate cut points from deleted pauses/silences
 *
 * Given the original word timings and deleted ranges, calculates where
 * the cuts will appear in the output video.
 *
 * @param words - Original word timings (before cuts)
 * @param deletedRanges - Array of {start, end} ranges that were deleted
 * @param clipIndex - Which clip these cuts belong to
 * @param clipStartMs - When this clip starts in the output timeline
 */
export function calculateCutPoints(
  words: { start: number; end: number }[],
  deletedRanges: { start: number; end: number; duration: number }[],
  clipIndex: number,
  clipStartMs: number = 0
): CutPoint[] {
  if (deletedRanges.length === 0) {
    return [];
  }

  const cutPoints: CutPoint[] = [];
  let cumulativeRemoved = 0;

  // Sort ranges by start time
  const sortedRanges = [...deletedRanges].sort((a, b) => a.start - b.start);

  for (const range of sortedRanges) {
    // The cut point in output video is where the deletion starts,
    // adjusted for all previous deletions
    const cutTimeInClip = (range.start - cumulativeRemoved) * 1000;
    const cutTimeMs = clipStartMs + cutTimeInClip;

    cutPoints.push({
      clipIndex,
      cutTimeMs,
      silenceDuration: range.duration,
    });

    cumulativeRemoved += range.duration;
  }

  return cutPoints;
}
