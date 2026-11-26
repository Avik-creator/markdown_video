"use client";

import {
  getCaptionCueAtTime,
  type CaptionCue,
} from "@markdown-video/core";
import { textFontFamilyStyles } from "../utils/fonts.js";

export interface CaptionBurnOverlayProps {
  /** Generated caption cues (absolute video-time intervals, half-open). */
  cues: readonly CaptionCue[];
  /** Absolute video time in seconds — NOT scene-relative sceneTime. */
  time: number;
}

/**
 * Burned-in caption text composited inside the logical frame.
 *
 * This overlay is how caption burn-in is implemented for every capture
 * pipeline: captions are a deterministic function of absolute video time, so
 * rendering them as DOM inside the capture subtree makes the encoded frames
 * already contain the captions — no ffmpeg subtitles filter, no libass, no
 * fontconfig, and full Unicode coverage through the same web fonts (and host
 * fallback fonts) the rest of the composition already uses. Burned output is
 * therefore pixel-consistent with what the host document renders.
 *
 * Timing semantics are the SRT/half-open convention shared with the sidecar
 * serializers: a cue is visible for startTime <= time < endTime, so a frame
 * exactly at a cue end shows the next cue (or nothing), never the ended one.
 *
 * The visual style is the classic broadcast backing-box caption: bottom
 * centered inside the safe margin, white semibold text with one
 * semi-transparent black box per line. A backing box (rather than a text
 * outline or shadow) is deliberate: every capture pipeline — Chromium
 * screenshots and html2canvas canvas rasterization alike — reproduces box
 * backgrounds exactly, while text-shadow/stroke rendering diverges between
 * them. Multi-line cues render one box per line, which also avoids any
 * dependence on white-space: pre-line support in the capture clone.
 *
 * Sizing uses rem units only. Like the rest of the composition, these resolve
 * against the logical root font size the capture contract pins, so the
 * caption's fraction of the video frame is constant at every output
 * resolution and aspect ratio (the frame short side is always 1080 logical
 * px). Container-query units would not survive the html2canvas clone and are
 * intentionally not used inside the capture subtree.
 */
export function CaptionBurnOverlay({ cues, time }: CaptionBurnOverlayProps) {
  const cue = getCaptionCueAtTime(cues, time);
  if (!cue) return null;

  const lines = cue.text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return null;

  return (
    <div
      data-caption-burn="true"
      className="absolute inset-x-0 bottom-[6%] flex flex-col items-center px-[5%] pointer-events-none"
    >
      <div className="flex flex-col items-center gap-[0.15em] max-w-full">
        {lines.map((line, index) => (
          <div
            key={index}
            className="rounded-md bg-black/75 px-[0.6em] py-[0.2em] text-white text-center font-semibold"
            style={{
              ...textFontFamilyStyles.sans,
              // 2.5rem at the pinned 16px logical root font size: 40 logical
              // px, ~3.7% of the always-1080 logical short side.
              fontSize: "2.5rem",
              lineHeight: 1.3,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
