// Browser-side media fetching for ffmpeg.wasm export. Network access happens
// in the user's browser (never in the shared worker): cross-origin music is
// HTTPS-only and relies on normal CORS permission. Document-relative uploads
// are supplied from IndexedDB before static-path fetching is attempted.
import {
  buildMusicAudioFilter,
  buildMusicInputArgs,
  buildMusicOutputArgs,
  type MusicTrack,
} from "@markdown-video/core";
import { resolveBrowserAssetSource } from "@/lib/assets/asset-resolution";

export const MAX_BROWSER_MUSIC_BYTES = 32 * 1024 * 1024;

function audioContentTypeAllowed(contentType: string | null): boolean {
  const normalized = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return (
    normalized === "" ||
    normalized.startsWith("audio/") ||
    normalized === "application/octet-stream" ||
    normalized === "binary/octet-stream"
  );
}

async function readLimitedArrayBuffer(
  response: Response,
  limit: number,
  label: string
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > limit) {
    throw new Error(`${label} exceeds the ${Math.floor(limit / (1024 * 1024))}MB export limit`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error(`${label} is empty`);
  }
  if (buffer.byteLength > limit) {
    throw new Error(`${label} exceeds the ${Math.floor(limit / (1024 * 1024))}MB export limit`);
  }
  return new Uint8Array(buffer);
}

/**
 * Resolve and fetch a browser !music source into bytes suitable for MEMFS.
 *
 * Relative sources first match uploaded IndexedDB assets by filename; when no
 * upload matches they remain application assets resolved against the current
 * origin. Cross-origin sources must be HTTPS and CORS-readable. data:/blob:
 * URLs are self-contained browser objects and do not create network egress.
 */
export async function fetchBrowserMusicData(
  src: string,
  signal: AbortSignal
): Promise<Uint8Array> {
  const trimmed = src.trim();
  if (!trimmed) throw new Error("Music source is empty");

  const resolvedSource = await resolveBrowserAssetSource(trimmed);
  if (signal.aborted) {
    throw new DOMException("Music export was cancelled", "AbortError");
  }
  const sourceUrl = resolvedSource.url;

  let url: string;
  if (/^(data|blob):/i.test(sourceUrl)) {
    url = sourceUrl;
  } else {
    let resolved: URL;
    try {
      resolved = new URL(sourceUrl, window.location.href);
    } catch {
      throw new Error(`Invalid music source "${trimmed}"`);
    }
    const isSameOrigin = resolved.origin === window.location.origin;
    if (!isSameOrigin && resolved.protocol !== "https:") {
      throw new Error("Remote music must use HTTPS");
    }
    if (!/^(https?|data|blob):$/.test(resolved.protocol)) {
      throw new Error(`Unsupported music source scheme "${resolved.protocol}"`);
    }
    url = resolved.href;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      credentials: "same-origin",
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "Could not fetch music. For remote audio, check HTTPS and CORS access."
    );
  }
  if (!response.ok) {
    throw new Error(`Music download failed with HTTP status ${response.status}`);
  }
  if (!audioContentTypeAllowed(response.headers.get("content-type"))) {
    throw new Error("Music download did not return an audio content type");
  }
  return readLimitedArrayBuffer(response, MAX_BROWSER_MUSIC_BYTES, "Music");
}

export interface WebCodecsMusicRemuxArgsOptions {
  /** MP4 written by the WebCodecs encoder (H.264 video only). */
  videoPath: string;
  /** Music bytes from fetchBrowserMusicData, written to ffmpeg's MEMFS. */
  musicPath: string;
  music: Pick<MusicTrack, "volume" | "fade" | "loop">;
  totalDuration: number;
  outputPath: string;
}

/**
 * ffmpeg argv that adds document music to a WebCodecs-encoded MP4.
 *
 * Video is stream-copied (`-c:v copy`), so the only work left for ffmpeg.wasm
 * is encoding the AAC track. Music uses the same shared core fragments as the
 * libx264 export (`-stream_loop` input option, then volume, atrim, asetpts and
 * afade with the same `-map`), so volume, fade and loop behave identically on
 * both paths. `-movflags +faststart` keeps the remuxed file progressively
 * playable, like the encoder's own output.
 */
export function buildWebCodecsMusicRemuxArgs({
  videoPath,
  musicPath,
  music,
  totalDuration,
  outputPath,
}: WebCodecsMusicRemuxArgsOptions): string[] {
  return [
    "-v",
    "error",
    "-i",
    videoPath,
    ...buildMusicInputArgs(music, musicPath),
    ...buildMusicOutputArgs(buildMusicAudioFilter(music, totalDuration)),
    "-c:v",
    "copy",
    "-t",
    totalDuration.toFixed(3),
    "-movflags",
    "+faststart",
    outputPath,
  ];
}
