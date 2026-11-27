// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Controls } from "../controls";
import { useVideoStore } from "@/lib/use-video-store";

const CONTROLLED_MARKDOWN = `!scene
!duration 4
!text
Hello

---

!scene
!duration 2
!text
World
`;

const MUSIC_MARKDOWN = `!music theme.mp3 volume:0.5 fade:1s loop:false
${CONTROLLED_MARKDOWN}`;

const LOOPING_MUSIC_MARKDOWN = `!music theme.mp3 volume:0.5 fade:1s loop:true
${CONTROLLED_MARKDOWN}`;

class FakeAudioElement {
  static instances: FakeAudioElement[] = [];

  src = "";
  preload = "auto";
  volume = 1;
  muted = false;
  loop = false;
  playbackRate = 1;
  duration = Number.NaN;
  paused = true;
  ended = false;

  readonly play = vi.fn(() => {
    this.paused = false;
    this.ended = false;
    return Promise.resolve();
  });

  readonly pause = vi.fn(() => {
    this.paused = true;
  });

  private time = 0;
  get currentTime(): number {
    return this.time;
  }
  set currentTime(value: number) {
    this.time = value;
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

function installAudioMock() {
  FakeAudioElement.instances = [];
  vi.stubGlobal("Audio", function FakeAudioConstructor() {
    const audio = new FakeAudioElement();
    FakeAudioElement.instances.push(audio);
    return audio;
  });

  // These tests exercise state synchronization, not wall-clock playback. A
  // non-firing rAF keeps the controls' playback ticker from mutating the store
  // asynchronously outside act().
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

function resetStore() {
  useVideoStore.getState().pause();
  useVideoStore.getState().setPlaybackSpeed(1);
  useVideoStore.getState().setMarkdown(CONTROLLED_MARKDOWN, false);
  useVideoStore.setState({ currentTime: 0, isPlaying: false });
}

describe("Controls preview music", () => {
  beforeEach(() => {
    installAudioMock();
    resetStore();
  });

  afterEach(() => {
    cleanup();
    resetStore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders no music control when the document has no music", () => {
    render(<Controls />);

    expect(screen.queryByRole("button", { name: /preview music/i })).toBeNull();
    expect(FakeAudioElement.instances).toHaveLength(0);
  });

  it("creates a preloading audio element and renders an unmuted toggle when music exists", async () => {
    useVideoStore.getState().setMarkdown(MUSIC_MARKDOWN, false);
    render(<Controls />);

    const toggle = screen.getByRole("button", { name: "Mute preview music" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(FakeAudioElement.instances).toHaveLength(1);
    await vi.waitFor(() => {
      expect(FakeAudioElement.instances[0].src).toBe("theme.mp3");
    });
    expect(FakeAudioElement.instances[0].preload).toBe("auto");
    expect(FakeAudioElement.instances[0].muted).toBe(false);
    // At t=0 with a one-second fade-in the envelope starts at silence.
    expect(FakeAudioElement.instances[0].volume).toBe(0);
  });

  it("toggles preview music mute independently of the fade envelope", () => {
    useVideoStore.getState().setMarkdown(MUSIC_MARKDOWN, false);
    useVideoStore.getState().seekTo(0.5);
    render(<Controls />);

    const audio = FakeAudioElement.instances[0];
    expect(audio.volume).toBeCloseTo(0.25);

    fireEvent.click(screen.getByRole("button", { name: "Mute preview music" }));

    expect(screen.getByRole("button", { name: "Unmute preview music" })).toBeTruthy();
    expect(audio.muted).toBe(true);
    expect(audio.volume).toBeCloseTo(0.25);

    fireEvent.click(screen.getByRole("button", { name: "Unmute preview music" }));
    expect(audio.muted).toBe(false);
  });

  it("follows play, pause, seek, and playback-rate state", () => {
    useVideoStore.getState().setMarkdown(MUSIC_MARKDOWN, false);
    render(<Controls />);
    const audio = FakeAudioElement.instances[0];

    act(() => {
      useVideoStore.getState().seekTo(1.5);
    });
    expect(audio.currentTime).toBe(1.5);
    expect(audio.play).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(useVideoStore.getState().isPlaying).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.paused).toBe(false);

    act(() => {
      useVideoStore.getState().setPlaybackSpeed(2);
    });
    expect(audio.playbackRate).toBe(2);

    act(() => {
      useVideoStore.getState().seekTo(3);
    });
    expect(audio.currentTime).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(useVideoStore.getState().isPlaying).toBe(false);
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.paused).toBe(true);
  });

  it("suspends hidden-tab audio with the rAF-driven playhead and resumes on visibility", async () => {
    useVideoStore.getState().setMarkdown(MUSIC_MARKDOWN, false);
    render(<Controls />);
    const audio = FakeAudioElement.instances[0];
    let hidden = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });

    try {
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await act(async () => Promise.resolve());
      expect(audio.paused).toBe(false);
      expect(audio.play).toHaveBeenCalledTimes(1);

      hidden = true;
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(audio.paused).toBe(true);
      expect(audio.pause).toHaveBeenCalled();

      hidden = false;
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(audio.play).toHaveBeenCalledTimes(2);
      expect(audio.paused).toBe(false);

      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    } finally {
      Reflect.deleteProperty(document, "hidden");
    }
  });

  it("joins late-loading looping music at the wrapped playhead position", () => {
    useVideoStore.getState().setMarkdown(LOOPING_MUSIC_MARKDOWN, false);
    render(<Controls />);
    const audio = FakeAudioElement.instances[0];

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      useVideoStore.getState().seekTo(5.5);
    });
    expect(audio.currentTime).toBe(5.5);

    audio.duration = 4;
    act(() => {
      audio.emit("loadedmetadata");
    });

    expect(audio.currentTime).toBeCloseTo(1.5);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  });

  it("pauses and removes the old element when the music directive disappears", () => {
    useVideoStore.getState().setMarkdown(MUSIC_MARKDOWN, false);
    render(<Controls />);
    const audio = FakeAudioElement.instances[0];

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(audio.paused).toBe(false);

    act(() => {
      useVideoStore.getState().setMarkdown(CONTROLLED_MARKDOWN, false);
    });

    expect(screen.queryByRole("button", { name: /preview music/i })).toBeNull();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.paused).toBe(true);

    // Leaving audio paused is the important part; do not leave the store playing
    // in this test merely because a playback rAF ran during the assertions.
    act(() => {
      useVideoStore.getState().pause();
    });
  });

  it("keeps video playback working when the audio element reports a load error", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useVideoStore.getState().setMarkdown(MUSIC_MARKDOWN, false);
    render(<Controls />);
    const audio = FakeAudioElement.instances[0];

    act(() => {
      audio.emit("error");
    });
    expect(warn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    expect(useVideoStore.getState().isPlaying).toBe(true);
    expect(audio.play).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  });
});
