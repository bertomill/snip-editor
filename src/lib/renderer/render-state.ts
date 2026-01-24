import fs from "fs";
import path from "path";

const RENDER_STATE_DIR = path.join(process.cwd(), "tmp", "render-state");

// Ensure the directory exists
function ensureDir() {
  if (!fs.existsSync(RENDER_STATE_DIR)) {
    fs.mkdirSync(RENDER_STATE_DIR, { recursive: true });
  }
}

export interface RenderState {
  status: "rendering" | "done" | "error";
  progress: number;
  url?: string;
  supabaseUrl?: string; // Signed URL from Supabase storage
  size?: number;
  error?: string;
  timestamp?: number;
}

export const saveRenderState = (renderId: string, state: RenderState) => {
  ensureDir();
  const filePath = path.join(RENDER_STATE_DIR, `${renderId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(state));
};

export const getRenderState = (renderId: string): RenderState | null => {
  ensureDir();
  const filePath = path.join(RENDER_STATE_DIR, `${renderId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

export const updateRenderProgress = (renderId: string, progress: number) => {
  const state = getRenderState(renderId) || { status: "rendering" as const, progress: 0 };
  state.progress = progress;
  state.status = "rendering";
  saveRenderState(renderId, state);
};

export const completeRender = (renderId: string, url: string, size: number, supabaseUrl?: string) => {
  const state = getRenderState(renderId) || { status: "done" as const, progress: 100 };
  state.status = "done";
  state.progress = 100;
  state.url = url;
  state.size = size;
  if (supabaseUrl) {
    state.supabaseUrl = supabaseUrl;
  }
  saveRenderState(renderId, state);
};

export const failRender = (renderId: string, error: string) => {
  const state = getRenderState(renderId) || { status: "error" as const, progress: 0 };
  state.status = "error";
  state.error = error;
  saveRenderState(renderId, state);
};
