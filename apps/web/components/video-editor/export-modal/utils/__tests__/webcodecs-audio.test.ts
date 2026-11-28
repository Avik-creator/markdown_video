// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildMusicGainSchedule,
  renderMusicAudioBuffer,
} from "../webcodecs-audio";

class MockGainNode {
  readonly calls: { method: string; value: number; time: number }[] = [];
  gain = {
    setValueAtTime: (value: number, time: number) => {
      this.calls.push({ method: "set", value, time });
    },
    linearRampToValueAtTime: (value: number, time: number) => {
      this.calls.push({ method: "linear", value, time });
    },
  };
  connect = vi.fn();
}

class MockBufferSource {
  buffer: unknown = null;
  loop = false;
  connect = vi.fn();
  start = vi.fn();
}

class MockOfflineAudioContext {
  static lastInstance: MockOfflineAudioContext | null = null;
  decodeCalls: ArrayBuffer[] = [];
  gainNode = new MockGainNode();
  source = new MockBufferSource();
  destination = {};

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number
  ) {
    MockOfflineAudioContext.lastInstance = this;
  }

  createBufferSource() {
    return this.source;
  }
  createGain() {
    return this.gainNode;
  }
  async decodeAudioData(data: ArrayBuffer) {
    this.decodeCalls.push(data);
    return { duration: 30 } as AudioBuffer;
  }
  async startRendering() {
    return {
      duration: this.length / this.sampleRate,
      numberOfChannels: this.numberOfChannels,
      sampleRate: this.sampleRate,
      length: this.length,
    } as AudioBuffer;
  }
}

describe("buildMusicGainSchedule", () => {
  it("ramps in, holds, and ramps out when a fade is set", () => {
    expect(
      buildMusicGainSchedule({ volume: 0.8, fade: 1, totalDuration: 10 })
    ).toEqual([
      { kind: "set", time: 0, value: 0 },
      { kind: "linear", time: 1, value: 0.8 },
      { kind: "set", time: 9, value: 0.8 },
      { kind: "linear", time: 10, value: 0 },
    ]);
  });

  it("is a single set at the track volume without a fade", () => {
    expect(
      buildMusicGainSchedule({ volume: 0.32, fade: 0, totalDuration: 10 })
    ).toEqual([{ kind: "set", time: 0, value: 0.32 }]);
  });

  it("clamps the fade to half the video duration so fades never overlap", () => {
    // getEffectiveMusicFade caps fade at duration/2 → a 1s video keeps
    // start and end fades contiguous but non-overlapping.
    expect(
      buildMusicGainSchedule({ volume: 1, fade: 2, totalDuration: 1 })
    ).toEqual([
      { kind: "set", time: 0, value: 0 },
      { kind: "linear", time: 0.5, value: 1 },
      { kind: "set", time: 0.5, value: 1 },
      { kind: "linear", time: 1, value: 0 },
    ]);
  });

  it("scales the held level by volume", () => {
    const points = buildMusicGainSchedule({
      volume: 0.4,
      fade: 0.6,
      totalDuration: 5,
    });
    expect(points[1].value).toBe(0.4);
    expect(points[2].value).toBe(0.4);
    expect(points[2].time).toBeCloseTo(4.4);
  });
});

describe("renderMusicAudioBuffer", () => {
  beforeEach(() => {
    vi.stubGlobal("OfflineAudioContext", MockOfflineAudioContext);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a stereo 48 kHz buffer of the video duration with the gain schedule", async () => {
    const musicData = new Uint8Array([1, 2, 3, 4]);
    const buffer = await renderMusicAudioBuffer({
      musicData,
      music: { volume: 0.8, fade: 1, loop: true },
      totalDuration: 32.77,
    });

    const context = MockOfflineAudioContext.lastInstance!;
    expect(context.numberOfChannels).toBe(2);
    expect(context.sampleRate).toBe(48000);
    expect(context.length).toBe(Math.ceil(32.77 * 48000));
    expect(buffer.duration).toBeCloseTo(32.77, 2);

    expect(context.source.loop).toBe(true);
    expect(context.source.start).toHaveBeenCalledWith(0);
    expect(context.source.connect).toHaveBeenCalledWith(context.gainNode);
    expect(context.gainNode.connect).toHaveBeenCalledWith(context.destination);

    expect(context.gainNode.calls).toEqual([
      { method: "set", value: 0, time: 0 },
      { method: "linear", value: 0.8, time: 1 },
      { method: "set", value: 0.8, time: 31.77 },
      { method: "linear", value: 0, time: 32.77 },
    ]);
  });

  it("passes a copy of the bytes to decodeAudioData and wires loop=false", async () => {
    const musicData = new Uint8Array([9, 8, 7]);
    await renderMusicAudioBuffer({
      musicData,
      music: { volume: 1, fade: 0, loop: false },
      totalDuration: 5,
    });
    const context = MockOfflineAudioContext.lastInstance!;
    expect(context.decodeCalls).toHaveLength(1);
    expect(context.decodeCalls[0]).not.toBe(musicData.buffer);
    expect(new Uint8Array(context.decodeCalls[0])).toEqual(musicData);
    expect(context.source.loop).toBe(false);
    expect(context.gainNode.calls).toEqual([
      { method: "set", value: 1, time: 0 },
    ]);
  });
});

// selectWebCodecsAudioCodec's platform-vs-wasm scenarios live in separate
// files (webcodecs-audio-codec.*.test.ts): mediabunny memoizes capability
// probes and custom-encoder registrations per module instance, so the states
// leak across tests in one file. Vitest isolates each file's module registry.
