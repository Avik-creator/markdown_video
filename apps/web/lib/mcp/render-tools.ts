import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getUtf8ByteLength } from "@markdown-video/core";

import {
  enforceMcpRenderPreviewRateLimit,
  enforceMcpRenderVideoRateLimit,
  type RateLimitRequestLike,
} from "@/lib/rate-limit";
import {
  isRenderStorageConfigured,
  storeRenderVideo,
} from "@/lib/render-storage";
import {
  renderBackendPreview,
  renderBackendVideo,
  requireRenderBackend,
} from "@/lib/render-backend";

export const MAX_MCP_RENDER_MARKDOWN_CHARS = 100_000;
export const MAX_MCP_RENDER_MARKDOWN_BYTES = 400_000;
export const MAX_RENDER_DURATION_SECONDS = 30;

const markdownSchema = z
  .string()
  .min(1)
  .max(MAX_MCP_RENDER_MARKDOWN_CHARS)
  .refine(
    (markdown) => getUtf8ByteLength(markdown) <= MAX_MCP_RENDER_MARKDOWN_BYTES,
    `Markdown must not exceed ${MAX_MCP_RENDER_MARKDOWN_BYTES} UTF-8 bytes`
  )
  .describe("The markdown_video document to render");

const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1", "4:3"]);
const localeSchema = z
  .string()
  .regex(/^[\p{L}\p{N}_.-]{1,64}$/u)
  .nullish();

const timesSchema = z
  .array(
    z
      .number()
      .finite()
      .nonnegative()
      .max(MAX_RENDER_DURATION_SECONDS)
      .describe("Timeline time in seconds")
  )
  .min(3)
  .max(6)
  .optional()
  .describe("3–6 explicit preview times; omitted means 5 frames spread across the video");

type ToolExtra = {
  requestInfo?: {
    headers?: Record<string, string | string[] | undefined>;
    url?: URL;
  };
};

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function rateLimitRequestFromExtra(extra: ToolExtra): RateLimitRequestLike {
  const headers = extra.requestInfo?.headers ?? {};
  return {
    headers: {
      get(name: string) {
        const lower = name.toLowerCase();
        for (const [key, value] of Object.entries(headers)) {
          if (key.toLowerCase() === lower) return headerValue(value) ?? null;
        }
        return null;
      },
    },
  };
}

async function throwIfRateLimited(
  extra: ToolExtra,
  enforce: (request: RateLimitRequestLike) => Promise<Response | null>,
  label: string,
) {
  const response = await enforce(rateLimitRequestFromExtra(extra));
  if (!response) return;

  if (response.status === 429) {
    throw new Error(
      `${label} rate limit exceeded. Rendering limits are per IP per hour; retry after the reset time in the rate-limit response.`
    );
  }
  throw new Error(
    `${label} is temporarily unavailable because distributed rate limiting is unavailable. Rendering fails closed instead of becoming unthrottled.`
  );
}

function publicOrigin(extra: ToolExtra) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      if (process.env.NODE_ENV === "production") {
        throw new Error("NEXT_PUBLIC_SITE_URL is not a valid URL.");
      }
    }
  }
  // Production links must never be host-header derived: a spoofed Host could
  // otherwise make a private render artifact appear to live on an attacker's
  // domain. Development/test fallback remains convenient for local MCP use.
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for render_video URLs in production.");
  }

  const headers = extra.requestInfo?.headers ?? {};
  const host = headerValue(headers["x-forwarded-host"]) ?? headerValue(headers.host);
  if (host) {
    const proto = headerValue(headers["x-forwarded-proto"]) ?? "https";
    return `${proto.split(",")[0]!.trim()}://${host.split(",")[0]!.trim()}`;
  }
  return extra.requestInfo?.url?.origin ?? "http://localhost:3000";
}

export function registerRenderTools(server: McpServer) {
  server.tool(
    "render_preview",
    "Renders 3–6 direct PNG screenshots of a markdown_video document so agents can visually inspect their output. Duration is capped at 30s; remote image URLs are blocked by the configured render backend.",
    {
      markdown: markdownSchema,
      times: timesSchema,
      aspectRatio: aspectRatioSchema
        .optional()
        .describe("Output aspect ratio; defaults to 16:9"),
      locale: localeSchema.describe("Optional locale code such as en or pt-BR"),
    },
    async ({ markdown, times, aspectRatio, locale }, extra) => {
      requireRenderBackend();
      await throwIfRateLimited(
        extra,
        enforceMcpRenderPreviewRateLimit,
        "render_preview"
      );

      const result = await renderBackendPreview({
        markdown,
        ...(times ? { times } : {}),
        ...(aspectRatio ? { aspectRatio } : {}),
        locale: locale ?? null,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Rendered ${result.frames.length} preview frame(s) at ${result.frames
              .map((frame) => `${frame.time}s`)
              .join(", ")} for a ${result.duration}s video (${result.width}×${result.height}).`,
          },
          ...result.frames.map((frame) => ({
            type: "image" as const,
            data: frame.pngBase64,
            mimeType: "image/png",
          })),
        ],
      };
    }
  );

  server.tool(
    "render_video",
    "Renders a markdown_video document to MP4 and returns a temporary URL. Caps: 30s, 1080p, 30fps, 6 MiB. URLs expire after 1 hour. Remote image URLs are blocked by the configured render backend.",
    {
      markdown: markdownSchema,
      options: z
        .object({
          resolution: z.enum(["480p", "720p", "1080p"]).optional(),
          quality: z.enum(["low", "medium", "high"]).optional(),
          speed: z.enum(["fastest", "fast", "balanced"]).optional(),
          fps: z.number().int().min(1).max(30).optional(),
          aspectRatio: aspectRatioSchema.optional(),
          locale: localeSchema,
        })
        .optional()
        .describe("Render options; defaults are 720p, medium quality, fast encoding, 24fps, 16:9"),
    },
    async ({ markdown, options }, extra) => {
      requireRenderBackend();
      if (!isRenderStorageConfigured()) {
        throw new Error(
          "Rendering is not configured on this deployment: render storage is unavailable. Set NEON_DATABASE_URL or DATABASE_URL for Postgres storage, or UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN for Redis storage."
        );
      }
      await throwIfRateLimited(
        extra,
        enforceMcpRenderVideoRateLimit,
        "render_video"
      );

      const rendered = await renderBackendVideo({
        markdown,
        ...(options ? { options } : {}),
      });
      const stored = await storeRenderVideo({
        mp4: rendered.mp4,
        duration: rendered.duration,
        width: rendered.width,
        height: rendered.height,
        fps: rendered.fps,
        totalFrames: rendered.totalFrames,
      });
      const url = `${publicOrigin(extra)}/api/renders/${stored.id}`;
      const metadata = {
        url,
        id: stored.id,
        duration: stored.duration,
        width: stored.width,
        height: stored.height,
        fps: stored.fps,
        totalFrames: stored.totalFrames,
        sizeBytes: stored.sizeBytes,
        expiresAt: stored.expiresAt,
        ttlSeconds: stored.ttlSeconds,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: `Rendered MP4: ${url}\n\nDuration: ${stored.duration}s\nSize: ${stored.sizeBytes} bytes\nResolution: ${stored.width}×${stored.height} @ ${stored.fps}fps\nExpires: ${stored.expiresAt} (${stored.ttlSeconds / 3600} hour TTL)`,
          },
        ],
        structuredContent: metadata,
      };
    }
  );
}
