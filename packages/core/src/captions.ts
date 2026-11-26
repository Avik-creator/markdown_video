// Caption extraction and sidecar serialization.
//
// Captions intentionally describe the readable text transcript, not every
// pixel-level animation detail. Scene boundaries come from getTimelineSegments
// (the same timeline math used by preview and export); line-level timing is an
// explicit approximation documented below.

import {
  resolveEffectiveLocale,
  resolveSceneTextContent,
} from "./parser/i18n.js";
import { getTimelineSegments } from "./parser/timeline.js";
import type {
  LocalizationStrings,
  Scene,
} from "./types.js";

/** Delay before the first staggered text line in the scene renderer. */
export const TEXT_STAGGER_DELAY_CHILDREN_SECONDS = 0.1;

export interface CaptionCue {
  sceneIndex: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface CaptionSource {
  scenes: readonly Scene[];
  locales?: readonly string[] | undefined;
  localizationStrings?: LocalizationStrings | undefined;
  defaultLocale?: string | undefined;
}

export interface GenerateCaptionsOptions {
  /** User/export locale. Scene-level `!locale` still wins per scene. */
  activeLocale?: string | null | undefined;
}

/** Normalize text for caption containers without changing authored wording. */
export function normalizeCaptionText(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n")
    .trim();
}

/**
 * Generate non-overlapping caption cues from top-level text scenes.
 *
 * Scope and timing choices:
 *
 * - only scenes whose type is `text` contribute; overlays, split children,
 *   mockups, terminal/code/diff text, and timeline elements are deliberately
 *   out of scope for this first caption implementation;
 * - unstaggered multi-line text appears simultaneously on screen, so it is a
 *   single multi-line cue spanning the exact scene boundary;
 * - with `stagger`, each non-empty line becomes one cue. Lines start at the
 *   scene renderer's deterministic reveal offset (`0.1s + index * stagger`).
 *   A cue ends when the next line starts, and the final cue ends exactly at
 *   the scene end;
 * - lines whose staggered reveal falls outside the scene are omitted;
 * - i18n text resolves through the same effective-locale chain as rendering.
 */
export function generateCaptions(
  source: CaptionSource,
  options: GenerateCaptionsOptions = {}
): CaptionCue[] {
  const { segments } = getTimelineSegments([...source.scenes]);
  const cues: CaptionCue[] = [];

  source.scenes.forEach((scene, sceneIndex) => {
    const segment = segments[sceneIndex];
    if (!segment || scene.type !== "text" || !scene.text) return;
    if (!(segment.endTime > segment.startTime)) return;

    const effectiveLocale = resolveEffectiveLocale({
      sceneLocale: scene.locale,
      activeLocale: options.activeLocale ?? null,
      locales: source.locales ?? [],
      defaultLocale: source.defaultLocale,
    });
    const content = normalizeCaptionText(
      resolveSceneTextContent(scene.text, {
        strings: source.localizationStrings,
        locale: effectiveLocale,
        defaultLocale: source.defaultLocale,
      })
    );
    if (!content) return;

    const lines = content.split("\n").filter((line) => line.trim().length > 0);
    const stagger = scene.text.stagger ?? 0;
    if (lines.length <= 1 || !(stagger > 0)) {
      cues.push({
        sceneIndex,
        startTime: segment.startTime,
        endTime: segment.endTime,
        text: lines.join("\n"),
      });
      return;
    }

    const starts: number[] = [];
    const startOffset = segment.startTime;
    for (let index = 0; index < lines.length; index++) {
      const offset = TEXT_STAGGER_DELAY_CHILDREN_SECONDS + index * stagger;
      const absolute = startOffset + offset;
      if (absolute < segment.endTime) {
        starts.push(absolute);
      } else {
        break;
      }
    }

    starts.forEach((startTime, index) => {
      const endTime = index + 1 < starts.length
        ? starts[index + 1]
        : segment.endTime;
      if (!(endTime > startTime)) return;
      cues.push({
        sceneIndex,
        startTime,
        endTime,
        text: lines[index],
      });
    });
  });

  return cues;
}

/** Return the active cue at a timeline instant using half-open intervals. */
export function getCaptionCueAtTime(
  cues: readonly CaptionCue[],
  time: number
): CaptionCue | null {
  return cues.find((cue) => time >= cue.startTime && time < cue.endTime) ?? null;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

function formatTimestamp(seconds: number, separator: "," | "."): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}${separator}${pad(milliseconds, 3)}`;
}

/** Escape WebVTT's HTML-like cue text metacharacters so text renders literally. */
export function escapeVttText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Serialize cues as SubRip (.srt), with a trailing newline for non-empty output. */
export function serializeSrt(cues: readonly CaptionCue[]): string {
  if (cues.length === 0) return "";
  return `${cues
    .map((cue, index) =>
      [
        String(index + 1),
        `${formatTimestamp(cue.startTime, ",")} --> ${formatTimestamp(cue.endTime, ",")}`,
        cue.text,
      ].join("\n")
    )
    .join("\n\n")}\n`;
}

/** Serialize cues as WebVTT. The WEBVTT header is present even without cues. */
export function serializeVtt(cues: readonly CaptionCue[]): string {
  if (cues.length === 0) return "WEBVTT\n";
  return `WEBVTT\n\n${cues
    .map((cue) =>
      [
        `${formatTimestamp(cue.startTime, ".")} --> ${formatTimestamp(cue.endTime, ".")}`,
        escapeVttText(cue.text),
      ].join("\n")
    )
    .join("\n\n")}\n`;
}

export interface CaptionSidecars {
  cues: CaptionCue[];
  srt: string;
  vtt: string;
}

export function generateCaptionSidecars(
  source: CaptionSource,
  options: GenerateCaptionsOptions = {}
): CaptionSidecars {
  const cues = generateCaptions(source, options);
  return {
    cues,
    srt: serializeSrt(cues),
    vtt: serializeVtt(cues),
  };
}
