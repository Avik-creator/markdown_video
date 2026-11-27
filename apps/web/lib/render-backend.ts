import {
  isRenderWorkerConfigured,
  renderWorkerPreview,
  renderWorkerVideo,
} from "@/lib/render-worker-client";
import {
  isRenderSandboxConfigured,
  renderSandboxPreview,
  renderSandboxVideo,
} from "@/lib/render-sandbox/backend";

export type RenderBackendName = "worker" | "sandbox";

export interface RenderPreviewInput {
  markdown: string;
  times?: number[];
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3";
  locale?: string | null;
}

export interface RenderVideoInput {
  markdown: string;
  options?: {
    resolution?: "480p" | "720p" | "1080p";
    quality?: "low" | "medium" | "high";
    speed?: "fastest" | "fast" | "balanced";
    fps?: number;
    aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3";
    locale?: string | null;
  };
}

/**
 * Rendering prefers the dedicated worker whenever it is configured because it
 * is operationally isolated and independently scalable. Vercel Sandbox is the
 * same-project fallback for deployments that do not run a separate worker.
 */
export function getRenderBackend(): RenderBackendName | null {
  if (isRenderWorkerConfigured()) return "worker";
  if (isRenderSandboxConfigured()) return "sandbox";
  return null;
}

export function requireRenderBackend(): RenderBackendName {
  const backend = getRenderBackend();
  if (!backend) {
    throw new Error(
      "Rendering is not configured on this deployment: set RENDER_WORKER_URL and RENDER_WORKER_SHARED_SECRET, or configure Vercel Sandbox rendering with VERCEL_OIDC_TOKEN (or VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID)."
    );
  }
  return backend;
}

export async function renderBackendPreview(input: RenderPreviewInput) {
  return requireRenderBackend() === "worker"
    ? renderWorkerPreview(input)
    : renderSandboxPreview(input);
}

export async function renderBackendVideo(input: RenderVideoInput) {
  return requireRenderBackend() === "worker"
    ? renderWorkerVideo(input)
    : renderSandboxVideo(input);
}
