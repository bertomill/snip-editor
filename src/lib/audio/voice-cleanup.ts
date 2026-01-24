/**
 * Voice cleanup module using FFmpeg filters
 * Applies noise reduction and loudness normalization to audio
 */

import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { tmpdir } from "os";
import { stat } from "fs/promises";

const execAsync = promisify(exec);

export interface VoiceCleanupOptions {
  /** Enable noise reduction (default: true) */
  noiseReduction?: boolean;
  /** Noise reduction strength: 'light' | 'medium' | 'strong' (default: 'medium') */
  noiseReductionStrength?: 'light' | 'medium' | 'strong';
  /** Enable loudness normalization (default: true) */
  loudnessNormalization?: boolean;
  /** Target loudness in LUFS (default: -16) */
  targetLoudness?: number;
}

interface NoiseReductionParams {
  nr: number;  // Noise reduction amount in dB (0-97)
  nf: number;  // Noise floor in dB
  tn: number;  // Track noise (1 = enabled)
}

const NOISE_REDUCTION_PRESETS: Record<string, NoiseReductionParams> = {
  light: { nr: 8, nf: -50, tn: 1 },
  medium: { nr: 12, nf: -40, tn: 1 },
  strong: { nr: 20, nf: -30, tn: 1 },
};

/**
 * Apply voice cleanup filters to an audio file
 * Uses FFmpeg's afftdn (adaptive FFT denoiser) and loudnorm filters
 *
 * @param inputPath - Path to input audio file
 * @param options - Cleanup options
 * @returns Path to cleaned audio file
 */
export async function cleanupVoice(
  inputPath: string,
  options: VoiceCleanupOptions = {}
): Promise<string> {
  const {
    noiseReduction = true,
    noiseReductionStrength = 'medium',
    loudnessNormalization = true,
    targetLoudness = -16,
  } = options;

  // Build filter chain
  const filters: string[] = [];

  // Add noise reduction filter
  if (noiseReduction) {
    const params = NOISE_REDUCTION_PRESETS[noiseReductionStrength];
    filters.push(`afftdn=nr=${params.nr}:nf=${params.nf}:tn=${params.tn}`);
  }

  // Add loudness normalization filter
  if (loudnessNormalization) {
    // I=-16 is broadcast standard, TP=-1.5 is true peak, LRA=11 is loudness range
    filters.push(`loudnorm=I=${targetLoudness}:TP=-1.5:LRA=11`);
  }

  // If no filters, return input path (no processing needed)
  if (filters.length === 0) {
    console.log("[voice-cleanup] No filters enabled, skipping cleanup");
    return inputPath;
  }

  // Generate output path
  const outputPath = join(tmpdir(), `cleaned-${Date.now()}.mp3`);
  const filterString = filters.join(',');

  console.log(`[voice-cleanup] Applying filters: ${filterString}`);
  console.log(`[voice-cleanup] Input: ${inputPath}`);
  console.log(`[voice-cleanup] Output: ${outputPath}`);

  try {
    // Get input file size for comparison
    const inputStats = await stat(inputPath);
    const inputSizeMB = inputStats.size / (1024 * 1024);
    console.log(`[voice-cleanup] Input size: ${inputSizeMB.toFixed(2)} MB`);

    // Run FFmpeg with filter chain
    // -ar 16000 -ac 1 maintains 16kHz mono (optimal for speech recognition)
    // -q:a 2 is high quality MP3
    const command = `ffmpeg -i "${inputPath}" -af "${filterString}" -ar 16000 -ac 1 -q:a 2 -y "${outputPath}"`;

    const startTime = Date.now();
    await execAsync(command);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // Get output file size
    const outputStats = await stat(outputPath);
    const outputSizeMB = outputStats.size / (1024 * 1024);

    console.log(`[voice-cleanup] Completed in ${elapsed}s`);
    console.log(`[voice-cleanup] Output size: ${outputSizeMB.toFixed(2)} MB`);

    return outputPath;
  } catch (error) {
    console.error("[voice-cleanup] FFmpeg filter failed:", error);
    throw new Error("Failed to apply voice cleanup filters");
  }
}

// Note: AudioSettings type and defaultAudioSettings are defined in @/types/overlays
// This module is server-only (uses child_process and fs)
