// Pure ffmpeg music-mixing primitives shared by the browser WASM exporter and
// the native CLI renderer.
//
// These helpers only construct argv/filter fragments. They never concatenate
// user-controlled paths into shell commands or filter expressions: callers pass
// every fragment as an argv array element to ffmpeg.

import type { MusicTrack } from "./types.js";

export function formatFfmpegSeconds(seconds: number): string {
  const rounded = Math.round(seconds * 1_000_000) / 1_000_000;
  return rounded.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function formatFfmpegGain(gain: number): string {
  const rounded = Math.round(gain * 1_000_000) / 1_000_000;
  return rounded.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/**
 * Fade duration after enforcing the video-boundary invariant. Equal start/end
 * fades may use the whole video in aggregate, but they must never overlap;
 * overlap would make the midpoint gain depend on filter implementation details.
 */
export function getEffectiveMusicFade(fade: number, totalDuration: number): number {
  if (!Number.isFinite(fade) || !Number.isFinite(totalDuration)) return 0;
  return Math.max(0, Math.min(fade, totalDuration / 2));
}

/**
 * Build the output audio filter chain for a music input.
 *
 * `atrim` enforces the hard video-duration cap before stream timestamps are
 * reset. `loop` is intentionally *not* represented here because it is an input
 * option (`-stream_loop -1`) rather than a filter; see buildMusicInputArgs.
 */
export function buildMusicAudioFilter(
  music: Pick<MusicTrack, "volume" | "fade">,
  totalDuration: number
): string {
  const duration = Math.max(0, totalDuration);
  const fade = getEffectiveMusicFade(music.fade, duration);
  const parts = [
    `volume=${formatFfmpegGain(music.volume)}`,
    `atrim=duration=${formatFfmpegSeconds(duration)}`,
    "asetpts=PTS-STARTPTS",
  ];

  if (fade > 0) {
    parts.push(`afade=t=in:st=0:d=${formatFfmpegSeconds(fade)}`);
    const fadeOutStart = Math.max(0, duration - fade);
    parts.push(
      `afade=t=out:st=${formatFfmpegSeconds(fadeOutStart)}:d=${formatFfmpegSeconds(fade)}`
    );
  }

  return parts.join(",");
}

/**
 * Input argv fragment for the music source. `-stream_loop` is an input option
 * and therefore must immediately precede the corresponding `-i`.
 */
export function buildMusicInputArgs(music: Pick<MusicTrack, "loop">, inputPath: string): string[] {
  return music.loop
    ? ["-stream_loop", "-1", "-i", inputPath]
    : ["-i", inputPath];
}

/**
 * Output mapping/codec fragment for muxing input 1 audio into an mp4 whose
 * video comes from input 0. AAC at 128kbps is a compatibility-oriented choice
 * that both the WASM core and normal native ffmpeg builds provide.
 */
export function buildMusicOutputArgs(audioFilter: string): string[] {
  return [
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-af",
    audioFilter,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
  ];
}

/** Sidecar files produced next to the primary output. */
export interface CaptionSidecarPaths {
  srtPath: string;
  vttPath: string;
}

/** Replace or remove a media extension using path-string operations only. */
export function captionSidecarPathsForOutput(outputPath: string): CaptionSidecarPaths {
  const slash = Math.max(outputPath.lastIndexOf("/"), outputPath.lastIndexOf("\\"));
  const dot = outputPath.lastIndexOf(".");
  const stem = dot > slash + 1 ? outputPath.slice(0, dot) : outputPath;
  return {
    srtPath: `${stem}.srt`,
    vttPath: `${stem}.vtt`,
  };
}
