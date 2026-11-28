// Music track encoding for the WebCodecs export path.
//
// The ffmpeg pipeline mixes music with a volume filter, an optional linear
// afade pair and -stream_loop for looping. Here the same schedule is applied
// in an OfflineAudioContext and the rendered AudioBuffer is handed to
// Mediabunny's AudioBufferSource for AAC encoding, so an MP4 with music never
// needs the 32 MB ffmpeg core.
//
// AAC support is browser-dependent: Chrome/Firefox/Safari all expose an AAC
// AudioEncoder except Firefox, where @mediabunny/aac-encoder supplies a wasm
// encoder. Both are loaded dynamically so this module adds nothing to the
// editor bundle.

import { getEffectiveMusicFade, type MusicTrack } from "@markdown-video/core";

export const WEBCODECS_AUDIO_BITRATE = 128_000;
export const WEBCODECS_AUDIO_SAMPLE_RATE = 48_000;
export const WEBCODECS_AUDIO_CHANNELS = 2;

export interface MusicGainPoint {
  /** "set" jumps to a value; "linear" ramps to it (ffmpeg's afade tri curve). */
  kind: "set" | "linear";
  /** Seconds on the video timeline. */
  time: number;
  /** Linear gain. */
  value: number;
}

/**
 * Gain automation equivalent to `volume=` + `afade` in buildMusicAudioFilter:
 * fade-in from 0 to `volume` over F seconds, hold, fade-out to 0 at the video
 * end. `getEffectiveMusicFade` clamps overlapping fades on short videos.
 */
export function buildMusicGainSchedule({
  volume,
  fade,
  totalDuration,
}: Pick<MusicTrack, "volume" | "fade"> & { totalDuration: number }): MusicGainPoint[] {
  const duration = Math.max(0, totalDuration);
  const effectiveFade = getEffectiveMusicFade(fade, duration);
  // Microsecond rounding keeps the automation points aligned with the
  // formatted seconds ffmpeg receives in the filter-graph path.
  const t = (seconds: number) => Math.round(seconds * 1e6) / 1e6;
  if (effectiveFade <= 0) {
    return [{ kind: "set", time: 0, value: volume }];
  }
  return [
    { kind: "set", time: 0, value: 0 },
    { kind: "linear", time: t(effectiveFade), value: volume },
    { kind: "set", time: t(Math.max(0, duration - effectiveFade)), value: volume },
    { kind: "linear", time: t(duration), value: 0 },
  ];
}

/**
 * Render the music track to a fixed-length stereo 48 kHz AudioBuffer with the
 * gain schedule applied. `decodeAudioData` detaches its input, so a copy is
 * made first. A non-looping track shorter than the video ends in silence
 * (ffmpeg would end the audio stream early instead); both produce silence
 * past the source length, so parity holds.
 */
export async function renderMusicAudioBuffer({
  musicData,
  music,
  totalDuration,
}: {
  musicData: ArrayBuffer | Uint8Array;
  music: Pick<MusicTrack, "volume" | "fade" | "loop">;
  totalDuration: number;
}): Promise<AudioBuffer> {
  const duration = Math.max(0, totalDuration);
  const context = new OfflineAudioContext(
    WEBCODECS_AUDIO_CHANNELS,
    Math.max(1, Math.ceil(duration * WEBCODECS_AUDIO_SAMPLE_RATE)),
    WEBCODECS_AUDIO_SAMPLE_RATE
  );
  const bytes =
    musicData instanceof Uint8Array
      ? musicData.slice(0).buffer
      : musicData.slice(0);
  const decoded = await context.decodeAudioData(bytes as ArrayBuffer);

  const source = context.createBufferSource();
  source.buffer = decoded;
  source.loop = music.loop;

  const gain = context.createGain();
  for (const point of buildMusicGainSchedule({ ...music, totalDuration: duration })) {
    if (point.kind === "set") {
      gain.gain.setValueAtTime(point.value, point.time);
    } else {
      gain.gain.linearRampToValueAtTime(point.value, point.time);
    }
  }
  source.connect(gain);
  gain.connect(context.destination);
  source.start(0);
  return context.startRendering();
}

export type WebCodecsAudioCodecPath = "native" | "wasm";

// Memoized so a failed registration retries on the next call, while
// concurrent callers share one import/registration (as OpenReel does). The
// mediabunny import is also single-flighted so the capability probe and the
// custom-encoder registration always see the same module instance.
let mediabunnyPromise: Promise<typeof import("mediabunny")> | null = null;
let aacRegistrationPromise: Promise<void> | null = null;

const getMediabunny = () => (mediabunnyPromise ??= import("mediabunny"));

const probeAac = async (): Promise<boolean> => {
  try {
    const mediabunny = await getMediabunny();
    return await mediabunny.canEncodeAudio("aac", {
      numberOfChannels: WEBCODECS_AUDIO_CHANNELS,
      sampleRate: WEBCODECS_AUDIO_SAMPLE_RATE,
      bitrate: WEBCODECS_AUDIO_BITRATE,
    });
  } catch {
    return false;
  }
};

/**
 * Resolve how this browser can produce AAC for the MP4 muxer:
 * "native" via a platform AudioEncoder, "wasm" via @mediabunny/aac-encoder
 * (registered once, lazily), or null when neither works.
 */
export async function selectWebCodecsAudioCodec(): Promise<WebCodecsAudioCodecPath | null> {
  if (await probeAac()) return "native";

  if (!aacRegistrationPromise) {
    aacRegistrationPromise = import("@mediabunny/aac-encoder")
      .then(({ registerAacEncoder }) => {
        registerAacEncoder();
      })
      .catch((error: unknown) => {
        aacRegistrationPromise = null;
        throw error;
      });
  }

  try {
    await aacRegistrationPromise;
  } catch {
    return null;
  }
  return (await probeAac()) ? "wasm" : null;
}
