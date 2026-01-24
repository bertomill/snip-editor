import { CaptionStyles } from "./types/composition";

export interface CaptionTemplate {
  id: string;
  name: string;
  preview: string;
  styles: CaptionStyles;
}

/**
 * 4 caption style presets for Snip
 */
export const captionTemplates: CaptionTemplate[] = [
  {
    id: "classic",
    name: "Classic",
    preview: "Clean & Professional",
    styles: {
      fontFamily: "Inter, sans-serif",
      fontSize: "2.2rem",
      lineHeight: 1.4,
      textAlign: "center",
      color: "#FFFFFF",
      textShadow: "2px 2px 4px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3)",
      padding: "12px",
      fontWeight: 500,
      letterSpacing: "0.01em",
      highlightStyle: {
        backgroundColor: "rgba(59, 130, 246, 0.92)",
        color: "#FFFFFF",
        scale: 1.06,
        fontWeight: 600,
        textShadow: "2px 2px 4px rgba(0,0,0,0.4)",
        borderRadius: "6px",
        padding: "2px 8px",
      },
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    preview: "Simple & Clean",
    styles: {
      fontFamily: "Inter, sans-serif",
      fontSize: "1.5rem",
      lineHeight: 1.2,
      textAlign: "center",
      color: "#FFFFFF",
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: "4px 22px",
      highlightStyle: {
        backgroundColor: "rgba(0,0,0,0.8)",
        color: "#FFFFFF",
        scale: 1.02,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: "4px",
      },
    },
  },
  {
    id: "handwritten",
    name: "Handwritten",
    preview: "Casual & Friendly",
    styles: {
      fontFamily: "Caveat, cursive",
      fontSize: "2.4rem",
      lineHeight: 1.4,
      textAlign: "center",
      color: "#FFFFFF",
      textShadow: "1px 1px 2px rgba(0,0,0,0.6)",
      fontWeight: "normal",
      padding: "8px",
      highlightStyle: {
        backgroundColor: "rgba(34, 197, 94, 0.9)",
        color: "#FFFFFF",
        scale: 1.08,
        fontWeight: 600,
        textShadow: "1px 1px 2px rgba(0,0,0,0.4)",
        borderRadius: "8px",
        padding: "4px 10px",
      },
    },
  },
  {
    id: "neon",
    name: "Neon",
    preview: "Vibrant & Electric",
    styles: {
      fontFamily: "Outfit, sans-serif",
      fontSize: "2.2rem",
      lineHeight: 1.3,
      textAlign: "center",
      color: "#FFFFFF",
      textShadow:
        "0 0 10px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.5), 0 0 30px rgba(255,255,255,0.3)",
      highlightStyle: {
        backgroundColor: "rgba(139, 92, 246, 0.25)",
        color: "#F0ABFC",
        scale: 1.07,
        fontWeight: 600,
        textShadow:
          "0 0 10px rgba(240,171,252,0.9), 0 0 20px rgba(240,171,252,0.5), 0 0 30px rgba(240,171,252,0.3)",
        borderRadius: "8px",
        padding: "4px 16px",
      },
    },
  },
];

export function getCaptionTemplate(id: string): CaptionTemplate | undefined {
  return captionTemplates.find((t) => t.id === id);
}

export function getDefaultCaptionTemplate(): CaptionTemplate {
  return captionTemplates[0]; // Classic
}
