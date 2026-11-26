import {
  getEffectiveMusicFade,
  type MusicTrack,
} from "@markdown-video/core";

/**
 * The audio clock is allowed to drift this far from the playhead before a
 * hard seek corrects it. Smaller corrections are audible as tiny discontinuities,
 * while browser media clocks normally stay within a few milliseconds of the
 * wall-clock-driven preview clock.
 */
export const PREVIEW_MUSIC_DRIFT_TOLERANCE_SECONDS = 0.08;

/** Paused scrubs should feel exact, but sub-frame noise is not worth a seek. */
const PAUSED_SEEK_EPSILON_SECONDS = 0.005;

export interface PreviewMusicSnapshot {
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
  totalDuration: number;
  music: MusicTrack;
}

export interface PreviewMusicSyncOptions {
  muted: boolean;
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampVideoTime(videoTime: number, totalDuration: number): number {
  if (!Number.isFinite(videoTime)) return 0;
  return Math.min(Math.max(0, videoTime), totalDuration);
}

/**
 * Linear gain envelope matching the ffmpeg export chain (`volume` followed by
 * default linear `afade` filters). The fade duration uses the same half-video
 * clamp as export. Fade-out is anchored to the video duration, never to the
 * audio file's duration.
 */
export function getPreviewMusicGain(
  music: Pick<MusicTrack, "volume" | "fade">,
  videoTime: number,
  totalDuration: number,
): number {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) return 0;

  const time = clampVideoTime(videoTime, totalDuration);
  const volume = clampUnitInterval(music.volume);
  const fade = getEffectiveMusicFade(music.fade, totalDuration);
  if (fade <= 0) return volume;

  // The two ffmpeg fades are chained, so multiplication is the faithful model.
  // Because the effective fade is clamped to half the video duration they only
  // meet at the midpoint and never overlap for a sustained interval.
  let envelope = 1;
  if (time < fade) {
    envelope *= time / fade;
  }

  const fadeOutStart = totalDuration - fade;
  if (time > fadeOutStart) {
    envelope *= Math.max(0, (totalDuration - time) / fade);
  }

  return clampUnitInterval(volume * envelope);
}

/**
 * Map video time into source-audio time. Looping sources wrap at the media
 * duration; non-looping sources clamp at their end. Unknown durations (before
 * metadata arrives) use the unwrapped time so the browser can perform a
 * pending seek and join near the current playhead once ready.
 */
export function getPreviewMusicSourceTime(
  videoTime: number,
  audioDuration: number,
  loop: boolean,
): number {
  const time = Number.isFinite(videoTime) ? Math.max(0, videoTime) : 0;
  const hasDuration = Number.isFinite(audioDuration) && audioDuration > 0;
  if (!hasDuration) return time;
  if (!loop) return Math.min(time, audioDuration);
  return time % audioDuration;
}

/** The UI only offers positive rates; normalize defensively for direct store writes. */
export function normalizePreviewPlaybackRate(playbackSpeed: number): number {
  return Number.isFinite(playbackSpeed) && playbackSpeed > 0 ? playbackSpeed : 1;
}

/**
 * Stateful owner of one HTMLAudioElement.
 *
 * HTML media playback is deliberate here rather than a WebAudio gain node:
 * plain media elements can play cross-origin audio without CORS, while a
 * MediaElementSource would expose media data to WebAudio and therefore impose
 * CORS on remote music that preview playback otherwise supports. Updating
 * `volume` once per preview frame is still smooth enough for linear fades and
 * keeps mute/rate/loop behavior simple and testable.
 */
export class PreviewMusicController {
  private readonly audio: HTMLAudioElement;
  private disposed = false;
  private failed = false;
  private wasPlaying = false;
  private playSuppressedForRun = false;
  private playPromise: Promise<void> | null = null;

  private readonly handleError = () => {
    if (this.failed) return;
    this.failed = true;
    // Keep this deliberately source-free: data URLs can be very large and a
    // failed blob URL may reveal no useful diagnostic. The preview continues
    // silently because music must never block video playback.
    console.warn(
      "[markdown-video] Preview music could not be loaded; video playback will continue without music.",
    );
  };

  constructor(audio: HTMLAudioElement) {
    this.audio = audio;
    this.audio.preload = "auto";
    this.audio.addEventListener("error", this.handleError);
  }

  hasFailed(): boolean {
    return this.failed;
  }

  setMuted(muted: boolean): void {
    if (this.disposed) return;
    this.audio.muted = muted;
  }

  pause(): void {
    if (this.disposed) return;
    this.pauseAudio();
  }

  sync(
    snapshot: PreviewMusicSnapshot,
    options: PreviewMusicSyncOptions,
  ): void {
    if (this.disposed) return;

    const { music } = snapshot;
    const audio = this.audio;
    audio.muted = options.muted;

    if (this.failed) {
      this.pauseAudio();
      this.wasPlaying = snapshot.isPlaying;
      return;
    }

    const playbackRate = normalizePreviewPlaybackRate(snapshot.playbackSpeed);
    if (audio.playbackRate !== playbackRate) {
      audio.playbackRate = playbackRate;
    }
    if (audio.loop !== music.loop) {
      audio.loop = music.loop;
    }

    const gain = getPreviewMusicGain(
      music,
      snapshot.currentTime,
      snapshot.totalDuration,
    );
    if (Math.abs(audio.volume - gain) > 0.0001) {
      audio.volume = gain;
    }

    const hasDuration = Number.isFinite(audio.duration) && audio.duration > 0;
    const targetSourceTime = getPreviewMusicSourceTime(
      snapshot.currentTime,
      audio.duration,
      music.loop,
    );
    const timeDifference = Math.abs(audio.currentTime - targetSourceTime);
    const tolerance = snapshot.isPlaying
      ? PREVIEW_MUSIC_DRIFT_TOLERANCE_SECONDS
      : PAUSED_SEEK_EPSILON_SECONDS;
    const endedButTargetIsAudible =
      audio.ended && (!hasDuration || targetSourceTime < audio.duration);

    if (timeDifference > tolerance || endedButTargetIsAudible) {
      try {
        audio.currentTime = targetSourceTime;
      } catch {
        // Some browsers reject seeks while the initial resource selection is
        // still in flight. A later sync tick retries; preview playback must
        // never fail because audio is not seekable yet.
      }
    }

    // A rejected play() promise suppresses retries for the rest of this play
    // run. Otherwise a blocked autoplay attempt would be retried (and would
    // produce promise noise) on every animation frame. Pausing or pressing
    // play again starts a new run and therefore permits a fresh gesture-backed
    // attempt.
    if (snapshot.isPlaying && !this.wasPlaying) {
      this.playSuppressedForRun = false;
    }

    const canAudioPlayAtTarget =
      !hasDuration || music.loop || snapshot.currentTime < audio.duration;

    if (!snapshot.isPlaying) {
      this.pauseAudio();
      this.playSuppressedForRun = false;
    } else if (!canAudioPlayAtTarget) {
      this.pauseAudio();
    } else if (
      audio.paused &&
      this.playPromise === null &&
      !this.playSuppressedForRun
    ) {
      this.playSuppressedForRun = true;
      this.requestPlay();
    }

    this.wasPlaying = snapshot.isPlaying;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.audio.removeEventListener("error", this.handleError);
    this.pauseAudio();
  }

  private requestPlay(): void {
    let playPromise: Promise<void>;
    try {
      playPromise = this.audio.play();
    } catch {
      // Keep this run suppressed. Synchronous media failures are retried only
      // on a fresh play gesture, matching promise-rejection behavior.
      return;
    }

    if (!playPromise || typeof playPromise.then !== "function") {
      // Legacy media implementations did not return a promise. Treat the call
      // as successful; if paused somehow remains true a later user gesture can
      // retry because this branch cannot identify a transient failure.
      this.playSuppressedForRun = false;
      return;
    }

    this.playPromise = playPromise;
    void playPromise.then(
      () => {
        if (this.playPromise === playPromise) {
          this.playPromise = null;
        }
        this.playSuppressedForRun = false;
        // pause() can race an asynchronous play() request when the user pauses
        // immediately after starting playback (or the music source disappears).
        // The media element itself usually rejects that interrupted play, but
        // pause defensively if the request nevertheless fulfilled late.
        if (this.disposed || !this.wasPlaying) {
          this.pauseAudio();
        }
      },
      () => {
        if (this.playPromise === playPromise) {
          this.playPromise = null;
        }
        // Rejection is intentionally quiet. Autoplay blocking and interruption
        // by pause() are expected media-element outcomes, and the store-driven
        // video preview remains fully usable without audio.
      },
    );
  }

  private pauseAudio(): void {
    // `paused` can still report true while an asynchronous play() request is
    // in flight. In that race an ordinary pause() call is still required;
    // otherwise the late fulfillment could briefly start audible playback
    // after the user already pressed pause.
    if (!this.audio.paused || this.playPromise !== null) {
      try {
        this.audio.pause();
      } catch {
        // Pause is best-effort only; a detached media element must never break
        // the editor while it is being torn down.
      }
    }
  }
}
