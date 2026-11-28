// Privacy-preserving usage analytics for the export pipeline.
//
// Everything in this module is designed around two constraints:
//
// 1. Privacy. Payloads only contain product-level metadata: the export
//    format/settings, output geometry, duration/frame counts, and which
//    scene *types* were used. Scene types come from a fixed enum, so no
//    markdown, scene content, text, URLs, or user identifiers can ever
//    end up in an event.
//
// 2. Vercel Analytics custom event limits. Properties must be flat
//    primitives (string, number, boolean, null — no nested objects), names
//    and values are limited to 255 characters, and the number of
//    properties per event is plan-dependent with a hard maximum of 8.
//    Related values are therefore packed into single composite properties
//    (e.g. settings: "1080p/30fps/high/balanced") so the full payload fits
//    in 7 properties, leaving room for a failure-phase property.

import { track } from "@vercel/analytics";
import type { AnalyticsProps } from "@vercel/analytics/next";

/**
 * Strip the query string and hash fragment from a URL. Inline share links put
 * the entire document in the `?md=` query parameter, so any URL reported to an
 * analytics provider must have both removed first. Splitting on "?" first and
 * then "#" handles both the standard order (query before hash) and malformed
 * URLs with the hash first.
 */
export function stripUrlQueryAndHash(url: string): string {
  return url.split("?")[0].split("#")[0];
}

type AnalyticsBeforeSendEvent = Parameters<
  NonNullable<AnalyticsProps["beforeSend"]>
>[0];

/**
 * `beforeSend` middleware for the Vercel Analytics `<Analytics />` component.
 * Guarantees that no query string (which can carry a full markdown document in
 * `?md=`) or hash fragment ever leaves the browser in an analytics event,
 * while preserving the rest of the event payload. This must be applied inside
 * a client component — see app/privacy-analytics.tsx — because function props
 * cannot cross the server/client component boundary.
 */
export function beforeSendAnalyticsEvent(
  event: AnalyticsBeforeSendEvent
): AnalyticsBeforeSendEvent {
  return { ...event, url: stripUrlQueryAndHash(event.url) };
}

/** Custom event names for the export lifecycle, normalized as snake_case. */
export const EXPORT_EVENT_NAMES = {
  started: "export_started",
  finished: "export_finished",
  failed: "export_failed",
  cancelled: "export_cancelled",
} as const;

export type ExportEventName =
  (typeof EXPORT_EVENT_NAMES)[keyof typeof EXPORT_EVENT_NAMES];

/** Flat primitives are the only property values Vercel Analytics accepts. */
export type AnalyticsPropertyValue = string | number | boolean | null;

export type ExportEventProperties = Record<string, AnalyticsPropertyValue>;

/**
 * Normalize a categorical token for use inside a payload: lowercase,
 * trimmed, whitespace collapsed to underscores. Empty or missing values
 * become "unknown" so composite properties keep their positional shape.
 */
export function normalizeToken(value?: string | null): string {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return normalized.length > 0 ? normalized : "unknown";
}

function toNonNegativeInteger(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

function toNonNegativeSeconds(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value * 10) / 10;
}

/**
 * Count scene types across the parsed scenes. Only the type discriminator
 * is read — never any scene content. Scenes without a usable type are
 * bucketed as "unknown" rather than dropped so counts stay accurate.
 */
export function countSceneTypes(
  scenes?: ReadonlyArray<{ type?: string | null }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!scenes) return counts;

  for (const scene of scenes) {
    const type = normalizeToken(scene?.type);
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

/**
 * Encode scene type counts as a compact, deterministic string such as
 * "code:2,terminal:1,text:3". Types are sorted alphabetically so equal
 * inputs always produce equal strings. Empty counts encode as "none".
 */
export function encodeSceneTypeCounts(
  counts: Record<string, number>
): string {
  const pairs = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([type, count]) => `${type}:${count}`);

  return pairs.length > 0 ? pairs.join(",") : "none";
}

export interface ExportAnalyticsInput {
  format?: string;
  resolution?: string;
  quality?: string;
  speed?: string;
  /** Which encoder produced the video stream; a fixed enum, folded into `settings`. */
  encoder?: "webcodecs" | "ffmpeg";
  /** Which rasterizer captured the frames; a fixed enum, folded into `settings`. */
  capture?: "snapdom" | "html2canvas";
  /** How the audio track was produced; a fixed enum, folded into `settings`. */
  audio?: "none" | "aac-webcodecs" | "aac-wasm" | "aac-ffmpeg";
  fps?: number;
  aspectRatio?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  totalFrames?: number;
  scenes?: ReadonlyArray<{ type?: string | null }>;
}

/**
 * Build the flat, privacy-preserving property payload shared by all export
 * lifecycle events. The result always fits within the Vercel Analytics
 * custom event constraints: at most 7 flat primitive properties, each well
 * under 255 characters.
 *
 * Composite properties:
 * - settings: "<resolution>/<fps>fps/<quality>/<speed>[/encoder][/capture][/audio]"
 * - output:   "<aspectRatio>/<width>x<height>"
 * - scenes:   "<type>:<count>,..." sorted by type, or "none"
 */
export function buildExportEventProperties(
  input: ExportAnalyticsInput
): ExportEventProperties {
  const fps = toNonNegativeInteger(input.fps);
  const width = toNonNegativeInteger(input.width);
  const height = toNonNegativeInteger(input.height);
  const sceneTypeCounts = countSceneTypes(input.scenes);
  const sceneCount = input.scenes?.length ?? 0;

  // The encoder is only known after config selection, so its segment is
  // appended only when set; the capture engine (a disjoint enum) follows it.
  // Fixed enums, never content.
  const encoder = input.encoder ? `/${normalizeToken(input.encoder)}` : "";
  const capture = input.capture ? `/${normalizeToken(input.capture)}` : "";
  const audio = input.audio ? `/${normalizeToken(input.audio)}` : "";
  return {
    format: normalizeToken(input.format),
    settings: `${normalizeToken(input.resolution)}/${fps}fps/${normalizeToken(
      input.quality
    )}/${normalizeToken(input.speed)}${encoder}${capture}${audio}`,
    output: `${normalizeToken(input.aspectRatio)}/${width}x${height}`,
    duration: toNonNegativeSeconds(input.durationSeconds),
    frames: toNonNegativeInteger(input.totalFrames),
    scene_count: sceneCount,
    scenes: encodeSceneTypeCounts(sceneTypeCounts),
  };
}

/**
 * Classify whether a render pipeline error represents a user/harness
 * cancellation rather than a genuine failure. Cancellation must never be
 * reported as a failure, so the export catch block checks this first.
 *
 * Detection is name-based because the pipeline's RenderCancelledError
 * class is local to the render component and AbortErrors surface as
 * DOMExceptions or plain objects depending on the ffmpeg.wasm boundary.
 */
export function isCancellationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return name === "RenderCancelledError" || name === "AbortError";
}

/**
 * Fire a custom event through Vercel Analytics without ever letting
 * analytics affect the product. Outside the browser this is a no-op:
 * the underlying track() throws in non-browser development/test
 * environments, and server-side rendering must not attempt it either.
 * Any unexpected failure inside the analytics SDK is swallowed.
 */
export function trackExportEvent(
  name: ExportEventName,
  properties?: ExportEventProperties
): void {
  if (typeof window === "undefined") return;

  try {
    track(name, properties);
  } catch {
    // Analytics must never break the export flow.
  }
}
