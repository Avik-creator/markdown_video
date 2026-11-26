// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { MusicTrack } from "@markdown-video/core";
import {
  getPreviewMusicGain,
  getPreviewMusicSourceTime,
  normalizePreviewPlaybackRate,
  PreviewMusicController,
  type PreviewMusicSnapshot,
} from "../preview-music";

class MockAudioElement {
  src = "";
  preload = "auto";
  volume = 1;
  muted = false;
  loop = false;
  playbackRate = 1;
  duration = 10;
  paused = true;
  ended = false;
  playImpl: () => Promise<void> = () => {
    this.paused = false;
    this.ended = false;
    return Promise.resolve();
  };

  readonly play = vi.fn(() => this.playImpl());
  readonly pause = vi.fn(() => {
    this.paused = true;
  });

  readonly currentTimeWrites: number[] = [];
  private time = 0;

  get currentTime(): number {
    return this.time;
  }

  set currentTime(value: number) {
    this.time = value;
    this.currentTimeWrites.push(value);
  }

  private readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }
}

function asAudioElement(audio: MockAudioElement): HTMLAudioElement {
  return audio as unknown as HTMLAudioElement;
}

function music(overrides: Partial<MusicTrack> = {}): MusicTrack {
  return {
    src: "theme.mp3",
    volume: 0.5,
    fade: 2,
    loop: true,
    ...overrides,
  };
}

function snapshot(overrides: Partial<PreviewMusicSnapshot> = {}): PreviewMusicSnapshot {
  return {
    isPlaying: false,
    currentTime: 0,
    playbackSpeed: 1,
    totalDuration: 10,
    music: music(),
    ...overrides,
  };
}

describe("getPreviewMusicGain", () => {
  it("matches the export linear fade envelope at key video times", () => {
    const track = music({ volume: 0.5, fade: 2 });

    expect(getPreviewMusicGain(track, 0, 10)).toBe(0);
    expect(getPreviewMusicGain(track, 1, 10)).toBeCloseTo(0.25);
    expect(getPreviewMusicGain(track, 2, 10)).toBeCloseTo(0.5);
    expect(getPreviewMusicGain(track, 5, 10)).toBeCloseTo(0.5);
    expect(getPreviewMusicGain(track, 8, 10)).toBeCloseTo(0.5);
    expect(getPreviewMusicGain(track, 9, 10)).toBeCloseTo(0.25);
    expect(getPreviewMusicGain(track, 10, 10)).toBe(0);
  });

  it("clamps fade-in and fade-out to half the video duration like export", () => {
    const track = music({ volume: 0.8, fade: 10 });

    // Effective fade is 3s for a 6s video, so the midpoint reaches full gain
    // without the two fades overlapping.
    expect(getPreviewMusicGain(track, 1.5, 6)).toBeCloseTo(0.4);
    expect(getPreviewMusicGain(track, 3, 6)).toBeCloseTo(0.8);
    expect(getPreviewMusicGain(track, 4.5, 6)).toBeCloseTo(0.4);
  });

  it("uses the base volume throughout when fade is zero", () => {
    const track = music({ volume: 0.4, fade: 0 });

    expect(getPreviewMusicGain(track, 0, 10)).toBeCloseTo(0.4);
    expect(getPreviewMusicGain(track, 9.999, 10)).toBeCloseTo(0.4);
    expect(getPreviewMusicGain(track, 10, 10)).toBeCloseTo(0.4);
  });

  it("clamps invalid gain inputs into the HTMLMediaElement volume range", () => {
    expect(getPreviewMusicGain(music({ volume: 2, fade: 0 }), 1, 10)).toBe(1);
    expect(getPreviewMusicGain(music({ volume: -1, fade: 0 }), 1, 10)).toBe(0);
    expect(getPreviewMusicGain(music({ volume: Number.NaN, fade: 0 }), 1, 10)).toBe(0);
    expect(getPreviewMusicGain(music(), 1, 0)).toBe(0);
  });
});

describe("getPreviewMusicSourceTime", () => {
  it("wraps looping sources at the media duration", () => {
    expect(getPreviewMusicSourceTime(7, 4, true)).toBe(3);
    expect(getPreviewMusicSourceTime(8, 4, true)).toBe(0);
    expect(getPreviewMusicSourceTime(9.25, 4, true)).toBeCloseTo(1.25);
  });

  it("clamps non-looping sources at the media end", () => {
    expect(getPreviewMusicSourceTime(2, 4, false)).toBe(2);
    expect(getPreviewMusicSourceTime(8, 4, false)).toBe(4);
  });

  it("uses unwrapped time while metadata has not supplied a duration", () => {
    expect(getPreviewMusicSourceTime(7, Number.NaN, true)).toBe(7);
    expect(getPreviewMusicSourceTime(-2, Number.NaN, true)).toBe(0);
  });
});

describe("normalizePreviewPlaybackRate", () => {
  it("keeps positive rates and normalizes invalid rates to 1", () => {
    expect(normalizePreviewPlaybackRate(1.5)).toBe(1.5);
    expect(normalizePreviewPlaybackRate(0)).toBe(1);
    expect(normalizePreviewPlaybackRate(-1)).toBe(1);
    expect(normalizePreviewPlaybackRate(Number.NaN)).toBe(1);
  });
});

describe("PreviewMusicController", () => {
  it("starts playback synchronized to the playhead and applies rate, loop, gain, and mute", () => {
    const audio = new MockAudioElement();
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.sync(
      snapshot({
        isPlaying: true,
        currentTime: 1,
        playbackSpeed: 1.5,
        music: music({ volume: 0.5, fade: 2, loop: true }),
      }),
      { muted: true },
    );

    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(1);
    expect(audio.playbackRate).toBe(1.5);
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBeCloseTo(0.25);
    expect(audio.muted).toBe(true);
  });

  it("pauses without starting playback and keeps seek synchronization while paused", () => {
    const audio = new MockAudioElement();
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.sync(snapshot({ isPlaying: false, currentTime: 3 }), { muted: false });

    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(3);

    controller.sync(snapshot({ isPlaying: false, currentTime: 4.5 }), { muted: false });
    expect(audio.currentTime).toBe(4.5);
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("ignores small playing drift but hard-corrects drift beyond the tolerance", () => {
    const audio = new MockAudioElement();
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.sync(snapshot({ isPlaying: true, currentTime: 5 }), { muted: false });
    audio.currentTimeWrites.length = 0;

    audio.currentTime = 5.05;
    audio.currentTimeWrites.length = 0;
    controller.sync(snapshot({ isPlaying: true, currentTime: 5 }), { muted: false });
    expect(audio.currentTime).toBe(5.05);

    audio.currentTime = 4.75;
    controller.sync(snapshot({ isPlaying: true, currentTime: 5 }), { muted: false });
    expect(audio.currentTime).toBe(5);
  });

  it("maps looping playback modulo the source duration", () => {
    const audio = new MockAudioElement();
    audio.duration = 4;
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.sync(
      snapshot({ isPlaying: false, currentTime: 9.25, music: music({ loop: true }) }),
      { muted: false },
    );

    expect(audio.loop).toBe(true);
    expect(audio.currentTime).toBeCloseTo(1.25);
  });

  it("does not play a non-looping source past its end, but resumes after seeking back", async () => {
    const audio = new MockAudioElement();
    audio.duration = 4;
    const controller = new PreviewMusicController(asAudioElement(audio));
    const track = music({ loop: false });

    controller.sync(snapshot({ isPlaying: true, currentTime: 5, music: track }), { muted: false });
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(4);

    audio.ended = true;
    controller.sync(snapshot({ isPlaying: true, currentTime: 2, music: track }), { muted: false });

    expect(audio.currentTime).toBe(2);
    expect(audio.play).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });

  it("restarts a looping source if the element nevertheless reaches ended state", () => {
    const audio = new MockAudioElement();
    audio.duration = 4;
    audio.ended = true;
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.sync(
      snapshot({ isPlaying: true, currentTime: 6, music: music({ loop: true }) }),
      { muted: false },
    );

    expect(audio.loop).toBe(true);
    expect(audio.currentTime).toBe(2);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("corrects an unwrapped pending seek when metadata later supplies the loop duration", () => {
    const audio = new MockAudioElement();
    audio.duration = Number.NaN;
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.sync(snapshot({ isPlaying: true, currentTime: 7 }), { muted: false });
    expect(audio.currentTime).toBe(7);

    // Simulate the browser applying/clamping that early seek before metadata.
    audio.currentTime = 0;
    audio.duration = 4;
    controller.sync(snapshot({ isPlaying: true, currentTime: 7 }), { muted: false });

    expect(audio.currentTime).toBe(3);
  });

  it("updates playbackRate when the preview speed changes", () => {
    const audio = new MockAudioElement();
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.sync(snapshot({ isPlaying: false, playbackSpeed: 0.5 }), { muted: false });
    expect(audio.playbackRate).toBe(0.5);

    controller.sync(snapshot({ isPlaying: false, playbackSpeed: 2 }), { muted: false });
    expect(audio.playbackRate).toBe(2);
  });

  it("keeps the fade envelope independent from the mute flag", () => {
    const audio = new MockAudioElement();
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.sync(snapshot({ currentTime: 1 }), { muted: true });
    expect(audio.muted).toBe(true);
    expect(audio.volume).toBeCloseTo(0.25);

    controller.setMuted(false);
    expect(audio.muted).toBe(false);
    expect(audio.volume).toBeCloseTo(0.25);
  });

  it("suppresses repeated play attempts after a rejection until a new play run", async () => {
    const audio = new MockAudioElement();
    audio.playImpl = () => Promise.reject(new Error("autoplay blocked"));
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.sync(snapshot({ isPlaying: true }), { muted: false });
    controller.sync(snapshot({ isPlaying: true }), { muted: false });
    await Promise.resolve();
    controller.sync(snapshot({ isPlaying: true }), { muted: false });

    expect(audio.play).toHaveBeenCalledTimes(1);

    controller.sync(snapshot({ isPlaying: false }), { muted: false });
    controller.sync(snapshot({ isPlaying: true }), { muted: false });
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("pauses even when a play request is still asynchronously pending", () => {
    const audio = new MockAudioElement();
    audio.playImpl = () => new Promise<void>(() => {});
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.sync(snapshot({ isPlaying: true }), { muted: false });
    expect(audio.paused).toBe(true);

    controller.sync(snapshot({ isPlaying: false }), { muted: false });
    expect(audio.pause).toHaveBeenCalledTimes(1);
  });

  it("handles media errors once and continues video state synchronization without audio", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const audio = new MockAudioElement();
    const controller = new PreviewMusicController(asAudioElement(audio));

    try {
      audio.emit("error");
      audio.emit("error");
      expect(controller.hasFailed()).toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);

      expect(() => {
        controller.sync(snapshot({ isPlaying: true, currentTime: 2 }), { muted: false });
      }).not.toThrow();
      expect(audio.play).not.toHaveBeenCalled();

      controller.sync(snapshot({ isPlaying: false, currentTime: 3 }), { muted: false });
      expect(audio.play).not.toHaveBeenCalled();
      await Promise.resolve();
    } finally {
      warn.mockRestore();
    }
  });

  it("dispose removes the error listener and pauses the element", () => {
    const audio = new MockAudioElement();
    audio.paused = false;
    const controller = new PreviewMusicController(asAudioElement(audio));

    controller.dispose();

    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.paused).toBe(true);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      audio.emit("error");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
