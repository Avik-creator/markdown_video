import { enforceRenderReadRateLimit } from "@/lib/rate-limit";
import { parseSingleByteRange } from "@/lib/render-range";
import {
  isRenderVideoId,
  readRenderVideo,
  RenderStorageConfigurationError,
} from "@/lib/render-storage";

function jsonError(error: string, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function baseHeaders(size: number) {
  return {
    "content-type": "video/mp4",
    "accept-ranges": "bytes",
    "content-length": String(size),
    "cache-control": "private, no-store",
    "content-disposition": "inline; filename=\"markdown-video.mp4\"",
    "x-content-type-options": "nosniff",
  } as const;
}

async function serveRender(
  request: Request,
  id: string,
  includeBody: boolean,
): Promise<Response> {
  const rateLimitResponse = await enforceRenderReadRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  if (!isRenderVideoId(id)) {
    return jsonError("Render not found", 404);
  }

  let asset;
  try {
    asset = await readRenderVideo(id);
  } catch (error) {
    if (error instanceof RenderStorageConfigurationError) {
      return jsonError("Render storage is unavailable", 503, { "retry-after": "30" });
    }
    console.error("Error retrieving rendered video:", error);
    return jsonError("Render storage is temporarily unavailable", 503, { "retry-after": "30" });
  }

  if (!asset) {
    return jsonError("Render not found", 404);
  }

  const range = parseSingleByteRange(
    request.headers.get("range"),
    asset.mp4.byteLength,
  );
  if (range === "invalid") {
    return jsonError("Requested range is not satisfiable", 416, {
      "content-range": `bytes */${asset.mp4.byteLength}`,
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? asset.mp4.byteLength - 1;
  const bytes = asset.mp4.subarray(start, end + 1);
  const headers: Record<string, string> = { ...baseHeaders(bytes.byteLength) };
  if (range) {
    headers["content-range"] = `bytes ${start}-${end}/${asset.mp4.byteLength}`;
  }

  // Copy the subarray into a fresh Uint8Array. Besides satisfying the web
  // Response BodyInit typing, this prevents a small range response from
  // retaining the complete multi-MiB Buffer backing store.
  const body = includeBody ? new Uint8Array(bytes) : null;
  return new Response(body, {
    status: range ? 206 : 200,
    headers,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return serveRender(request, id, true);
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return serveRender(request, id, false);
}
