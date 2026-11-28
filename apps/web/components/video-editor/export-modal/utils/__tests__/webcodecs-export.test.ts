// @vitest-environment jsdom

// jsdom has no WebCodecs, so VideoEncoder/VideoFrame are mocked on globalThis.
// Mediabunny is NOT mocked: encoded chunks go through the real MP4 muxer, and
// the result is read back with Mediabunny's real demuxer to check timestamps,
// key frames and the fast-start box layout end to end.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_FORMATS, BufferSource, EncodedPacketSink, Input } from "mediabunny";
import {
  WEBCODECS_BITS_PER_PIXEL,
  WEBCODECS_MAX_ENCODE_QUEUE_SIZE,
  WebCodecsEncoderError,
  createWebCodecsMp4Encoder,
  getEligibleWebCodecsH264Candidates,
  getWebCodecsBitrate,
  getWebCodecsFrameDurationUs,
  getWebCodecsFrameTimestampUs,
  getWebCodecsKeyFrameInterval,
  getWebCodecsLatencyMode,
  h264LevelSupports,
  isWebCodecsExportSupported,
  isWebKitEngine,
  repairAvcDecoderConfigurationRecord,
  selectWebCodecsVideoConfig,
} from "../webcodecs-export";

// A well-formed AVCDecoderConfigurationRecord: High@4.0, 4-byte NAL lengths,
// one SPS and one PPS.
const SPS = [0x67, 0x64, 0x00, 0x28, 0xac, 0xd9, 0x40, 0x78, 0x02, 0x27, 0xe5, 0x84];
const PPS = [0x68, 0xeb, 0xe3, 0xcb, 0x22, 0xc0];
const AVCC = Uint8Array.from([
  0x01, 0x64, 0x00, 0x28, 0xff, 0xe1, 0x00, SPS.length, ...SPS, 0x01, 0x00, PPS.length, ...PPS,
]);
// The same record as Firefox's encoder emits it (mediabunny issue #559): the
// NAL header byte is duplicated and the reserved bits are zeroed.
const FIREFOX_AVCC = Uint8Array.from([
  0x01, 0x64, 0x00, 0x28, 0x03, 0x01,
  0x00, SPS.length + 1, SPS[0], ...SPS,
  0x01, 0x00, PPS.length + 1, PPS[0], ...PPS,
]);

class MockVideoFrame {
  static instances: MockVideoFrame[] = [];
  readonly timestamp: number;
  readonly duration: number | null;
  readonly init: VideoFrameInit;
  closeCount = 0;

  constructor(readonly source: unknown, init: VideoFrameInit) {
    this.timestamp = init.timestamp ?? 0;
    this.duration = init.duration ?? null;
    this.init = init;
    MockVideoFrame.instances.push(this);
  }

  get closed() {
    return this.closeCount > 0;
  }

  close() {
    this.closeCount += 1;
  }
}

interface EncodeRecord {
  timestamp: number;
  duration: number | null;
  keyFrame: boolean;
}

interface MockEncoderBehavior {
  /** Emit outputs automatically after each encode (asynchronously, like real engines). */
  autoOutput: boolean;
  /** Firefox AVC bug: chunk timestamp = frame timestamp + duration. */
  shiftTimestamps: boolean;
  description: Uint8Array;
}

const behavior: MockEncoderBehavior = {
  autoOutput: true,
  shiftTimestamps: false,
  description: AVCC,
};

class MockVideoEncoder extends EventTarget {
  static instances: MockVideoEncoder[] = [];
  static supportedCodecs = new Set<string>();
  static isConfigSupported = vi.fn(async (config: VideoEncoderConfig) => ({
    supported: MockVideoEncoder.supportedCodecs.has(config.codec),
    config,
  }));

  state: CodecState = "unconfigured";
  encodeQueueSize = 0;
  config: VideoEncoderConfig | null = null;
  readonly encoded: EncodeRecord[] = [];
  readonly queued: EncodeRecord[] = [];
  closeCalls = 0;
  private emitted = 0;
  private readonly output: EncodedVideoChunkOutputCallback;
  private readonly onError: WebCodecsErrorCallback;

  constructor(init: VideoEncoderInit) {
    super();
    this.output = init.output;
    this.onError = init.error;
    MockVideoEncoder.instances.push(this);
  }

  configure(config: VideoEncoderConfig) {
    if (this.state === "closed") throw new DOMException("closed", "InvalidStateError");
    this.config = config;
    this.state = "configured";
  }

  encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions) {
    if (this.state !== "configured") throw new DOMException("not configured", "InvalidStateError");
    const mockFrame = frame as unknown as MockVideoFrame;
    if (mockFrame.closed) throw new TypeError("frame is closed");
    const record = {
      timestamp: mockFrame.timestamp,
      duration: mockFrame.duration,
      keyFrame: options?.keyFrame === true,
    };
    this.encoded.push(record);
    this.queued.push(record);
    this.encodeQueueSize += 1;
    if (behavior.autoOutput) queueMicrotask(() => this.emitNext());
  }

  /** Emit the oldest queued frame as a chunk and fire `dequeue`. */
  emitNext() {
    const record = this.queued.shift();
    if (!record || this.state !== "configured") return;
    this.encodeQueueSize = Math.max(0, this.encodeQueueSize - 1);
    this.dispatchEvent(new Event("dequeue"));
    const data = Uint8Array.from([0, 0, 0, 2, record.keyFrame ? 0x65 : 0x41, this.emitted & 0xff]);
    const chunk = {
      type: record.keyFrame ? "key" : "delta",
      timestamp: record.timestamp + (behavior.shiftTimestamps ? record.duration ?? 0 : 0),
      duration: record.duration,
      byteLength: data.byteLength,
      copyTo: (destination: Uint8Array) => destination.set(data),
    } as unknown as EncodedVideoChunk;
    const meta: EncodedVideoChunkMetadata | undefined =
      this.emitted === 0
        ? {
            decoderConfig: {
              codec: this.config!.codec,
              codedWidth: this.config!.width,
              codedHeight: this.config!.height,
              description: behavior.description,
            },
          }
        : undefined;
    this.emitted += 1;
    this.output(chunk, meta);
  }

  async flush() {
    if (this.state !== "configured") throw new DOMException("not configured", "InvalidStateError");
    await Promise.resolve();
    while (this.queued.length > 0) this.emitNext();
    if ((this.state as CodecState) === "closed") throw new DOMException("closed during flush", "AbortError");
  }

  close() {
    if (this.state === "closed") throw new DOMException("already closed", "InvalidStateError");
    this.closeCalls += 1;
    this.state = "closed";
  }

  /** Simulate an asynchronous engine error, which also closes the codec. */
  fail(error: DOMException) {
    this.state = "closed";
    this.onError(error);
  }
}

const config1080p: VideoEncoderConfig = {
  codec: "avc1.640028",
  width: 1920,
  height: 1080,
  bitrate: 6_220_800,
  framerate: 30,
  latencyMode: "quality",
  hardwareAcceleration: "no-preference",
  avc: { format: "avc" },
};

function makeCanvas(width = 1920, height = 1080) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function lastEncoder() {
  const encoder = MockVideoEncoder.instances.at(-1);
  if (!encoder) throw new Error("no encoder created");
  return encoder;
}

async function readMp4(bytes: Uint8Array) {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error("no video track");
  const packets: { timestamp: number; duration: number; type: string }[] = [];
  for await (const packet of new EncodedPacketSink(track).packets()) {
    packets.push({ timestamp: packet.timestamp, duration: packet.duration, type: packet.type });
  }
  const decoderConfig = await track.getDecoderConfig();
  return {
    packets,
    width: track.codedWidth,
    height: track.codedHeight,
    duration: await input.computeDuration(),
    description: decoderConfig?.description
      ? new Uint8Array(decoderConfig.description as ArrayBuffer)
      : null,
  };
}

/** Top-level ISO BMFF box types in file order. */
function topLevelBoxes(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxes: string[] = [];
  let offset = 0;
  while (offset + 8 <= bytes.byteLength) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (size === 1) size = Number(view.getBigUint64(offset + 8));
    if (size < 8) break;
    boxes.push(type);
    offset += size;
  }
  return boxes;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function encodeAll(fps: number, totalFrames: number, signal?: AbortSignal) {
  const encoder = createWebCodecsMp4Encoder({ config: { ...config1080p, framerate: fps }, fps, totalFrames, signal });
  const canvas = makeCanvas();
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    await encoder.addFrame(canvas, frameIndex);
  }
  const bytes = await encoder.finalize();
  encoder.close();
  return bytes;
}

beforeEach(() => {
  MockVideoFrame.instances = [];
  MockVideoEncoder.instances = [];
  MockVideoEncoder.supportedCodecs = new Set();
  MockVideoEncoder.isConfigSupported.mockClear();
  behavior.autoOutput = true;
  behavior.shiftTimestamps = false;
  behavior.description = AVCC;
  vi.stubGlobal("VideoEncoder", MockVideoEncoder);
  vi.stubGlobal("VideoFrame", MockVideoFrame);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isWebCodecsExportSupported", () => {
  it("requires both VideoEncoder and VideoFrame", () => {
    expect(isWebCodecsExportSupported()).toBe(true);
    vi.stubGlobal("VideoFrame", undefined);
    expect(isWebCodecsExportSupported()).toBe(false);
    vi.stubGlobal("VideoFrame", MockVideoFrame);
    vi.stubGlobal("VideoEncoder", undefined);
    expect(isWebCodecsExportSupported()).toBe(false);
  });
});

describe("selectWebCodecsVideoConfig", () => {
  const requested = () => MockVideoEncoder.isConfigSupported.mock.calls.map(([config]) => config.codec);

  it("returns the first supported candidate with the full encoder config", async () => {
    // jsdom's UA matches the WebKit heuristic; pin Chrome to check quality.
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
    MockVideoEncoder.supportedCodecs = new Set(["avc1.640033", "avc1.640028", "avc1.4D4028"]);
    const config = await selectWebCodecsVideoConfig({ width: 1920, height: 1080, fps: 30, quality: "high" });
    expect(config).toEqual({
      codec: "avc1.640028",
      width: 1920,
      height: 1080,
      bitrate: 6_220_800,
      framerate: 30,
      latencyMode: "quality",
      hardwareAcceleration: "no-preference",
      avc: { format: "avc" },
    });
    expect(requested()).toEqual(["avc1.640028"]);
  });

  it("falls through unsupported and throwing candidates in preference order", async () => {
    MockVideoEncoder.supportedCodecs = new Set(["avc1.4D4028", "avc1.42001F"]);
    MockVideoEncoder.isConfigSupported.mockImplementationOnce(async () => {
      throw new TypeError("unparseable");
    });
    const config = await selectWebCodecsVideoConfig({ width: 1280, height: 720, fps: 30, quality: "medium" });
    expect(config?.codec).toBe("avc1.4D4028");
    expect(requested()).toEqual(["avc1.640028", "avc1.64002A", "avc1.640033", "avc1.4D4028"]);
  });

  it("never offers Baseline@3.1 for 1080p and only High@5.1 for 4K", async () => {
    await expect(
      selectWebCodecsVideoConfig({ width: 1920, height: 1080, fps: 30, quality: "high" })
    ).resolves.toBeNull();
    expect(requested()).toEqual(["avc1.640028", "avc1.64002A", "avc1.640033", "avc1.4D4028"]);

    MockVideoEncoder.isConfigSupported.mockClear();
    await selectWebCodecsVideoConfig({ width: 1080, height: 1920, fps: 30, quality: "high" });
    expect(requested()).toEqual(["avc1.640028", "avc1.64002A", "avc1.640033", "avc1.4D4028"]);

    MockVideoEncoder.isConfigSupported.mockClear();
    await selectWebCodecsVideoConfig({ width: 1920, height: 1080, fps: 60, quality: "high" });
    expect(requested()).toEqual(["avc1.64002A", "avc1.640033"]);

    MockVideoEncoder.isConfigSupported.mockClear();
    await selectWebCodecsVideoConfig({ width: 3840, height: 2160, fps: 30, quality: "ultra" });
    expect(requested()).toEqual(["avc1.640033"]);

    MockVideoEncoder.isConfigSupported.mockClear();
    await selectWebCodecsVideoConfig({ width: 1280, height: 720, fps: 30, quality: "high" });
    expect(requested()).toEqual([
      "avc1.640028",
      "avc1.64002A",
      "avc1.640033",
      "avc1.4D4028",
      "avc1.42001F",
    ]);
  });

  it("returns null without probing when no level can carry the output", async () => {
    MockVideoEncoder.supportedCodecs = new Set(["avc1.640033"]);
    await expect(
      selectWebCodecsVideoConfig({ width: 3840, height: 2160, fps: 60, quality: "high" })
    ).resolves.toBeNull();
    expect(MockVideoEncoder.isConfigSupported).not.toHaveBeenCalled();
  });

  it("returns null when nothing is supported, WebCodecs is missing, or dimensions are odd", async () => {
    await expect(
      selectWebCodecsVideoConfig({ width: 1280, height: 720, fps: 30, quality: "high" })
    ).resolves.toBeNull();

    MockVideoEncoder.supportedCodecs = new Set(["avc1.640033"]);
    await expect(
      selectWebCodecsVideoConfig({ width: 1281, height: 720, fps: 30, quality: "high" })
    ).resolves.toBeNull();

    vi.stubGlobal("VideoEncoder", undefined);
    await expect(
      selectWebCodecsVideoConfig({ width: 1280, height: 720, fps: 30, quality: "high" })
    ).resolves.toBeNull();
  });

  it("rejects invalid dimensions and frame rates", async () => {
    await expect(
      selectWebCodecsVideoConfig({ width: 0, height: 720, fps: 30, quality: "high" })
    ).rejects.toThrow(RangeError);
    await expect(
      selectWebCodecsVideoConfig({ width: 1280, height: 720, fps: Number.NaN, quality: "high" })
    ).rejects.toThrow(RangeError);
  });

  it("computes bitrate as round(width * height * fps * bpp) for every quality", async () => {
    expect(WEBCODECS_BITS_PER_PIXEL).toEqual({ low: 0.04, medium: 0.07, high: 0.1, ultra: 0.15 });
    const expected = { low: 2_488_320, medium: 4_354_560, high: 6_220_800, ultra: 9_331_200 };
    MockVideoEncoder.supportedCodecs = new Set(["avc1.640033"]);
    for (const [quality, bitrate] of Object.entries(expected)) {
      const params = { width: 1920, height: 1080, fps: 30, quality };
      expect(getWebCodecsBitrate(params)).toBe(bitrate);
      expect((await selectWebCodecsVideoConfig(params))?.bitrate).toBe(bitrate);
    }
    // Rounding, and the "high" fallback for unknown qualities.
    expect(getWebCodecsBitrate({ width: 1080, height: 1920, fps: 24, quality: "medium" })).toBe(
      Math.round(1080 * 1920 * 24 * 0.07)
    );
    expect(getWebCodecsBitrate({ width: 1280, height: 720, fps: 30, quality: "bogus" })).toBe(2_764_800);
    expect(getWebCodecsBitrate({ width: 1280, height: 720, fps: 30, quality: "toString" })).toBe(2_764_800);
  });

  it("applies the H.264 level limits from Table A-1", () => {
    const at = (width: number, height: number, fps: number, bitrate = 1_000_000) => ({ width, height, fps, bitrate });
    expect(h264LevelSupports({ profile: "baseline", level: "3.1" }, at(1280, 720, 30))).toBe(true);
    expect(h264LevelSupports({ profile: "baseline", level: "3.1" }, at(1280, 720, 31))).toBe(false);
    expect(h264LevelSupports({ profile: "high", level: "4.0" }, at(1920, 1080, 30))).toBe(true);
    expect(h264LevelSupports({ profile: "high", level: "4.0" }, at(1920, 1080, 31))).toBe(false);
    expect(h264LevelSupports({ profile: "high", level: "4.2" }, at(1920, 1080, 60))).toBe(true);
    expect(h264LevelSupports({ profile: "high", level: "4.2" }, at(2560, 1440, 30))).toBe(false);
    expect(h264LevelSupports({ profile: "high", level: "5.1" }, at(3840, 2160, 30))).toBe(true);
    // Very wide frames exceed sqrt(8 * MaxFS) macroblocks even when the area fits.
    expect(h264LevelSupports({ profile: "high", level: "4.0" }, at(4112, 16, 1))).toBe(false);
    // Bitrate: Main@4.0 allows 20 Mbit/s; High@4.0 allows 25 Mbit/s.
    expect(h264LevelSupports({ profile: "main", level: "4.0" }, at(1280, 720, 30, 20_000_001))).toBe(false);
    expect(h264LevelSupports({ profile: "high", level: "4.0" }, at(1280, 720, 30, 25_000_000))).toBe(true);
    expect(
      getEligibleWebCodecsH264Candidates({ width: 1920, height: 1080, fps: 30, quality: "ultra" }).map(
        (candidate) => candidate.codec
      )
    ).toEqual(["avc1.640028", "avc1.64002A", "avc1.640033", "avc1.4D4028"]);
  });
});


describe("isWebKitEngine / getWebCodecsLatencyMode", () => {
  const cases: [string, boolean][] = [
    // Safari macOS
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", true],
    // Safari iOS
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1", true],
    // Playwright WebKit (no Version token at all)
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36", true],
    // Chrome
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", false],
    // Edge
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0", false],
    // Chromium
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/131.0.0.0 Safari/537.36", false],
    // Firefox (no AppleWebKit token)
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0", false],
  ];

  for (const [ua, expected] of cases) {
    it(`${expected ? "detects" : "rejects"} ${ua.slice(0, 60)}`, () => {
      expect(isWebKitEngine(ua)).toBe(expected);
      expect(getWebCodecsLatencyMode(ua)).toBe(
        expected ? "realtime" : "quality"
      );
    });
  }

  it("selects latencyMode realtime under a WebKit UA and quality under Chrome", async () => {
    MockVideoEncoder.supportedCodecs = new Set(["avc1.640028"]);
    const params = { width: 1920, height: 1080, fps: 30, quality: "high" };

    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
    );
    expect((await selectWebCodecsVideoConfig(params))?.latencyMode).toBe("realtime");

    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
    expect((await selectWebCodecsVideoConfig(params))?.latencyMode).toBe("quality");
  });
});

describe("frame timing helpers", () => {
  it("derives timestamps from frame indices, without accumulating rounding", () => {
    expect(getWebCodecsFrameDurationUs(30)).toBe(33_333);
    expect(getWebCodecsFrameDurationUs(24)).toBe(41_667);
    expect(getWebCodecsFrameTimestampUs(899, 30)).toBe(29_966_667);
    expect(getWebCodecsFrameTimestampUs(899, 24)).toBe(37_458_333);
    // Summing rounded durations would drift by 300µs over 900 frames at 24fps.
    expect(899 * getWebCodecsFrameDurationUs(24)).toBe(37_458_633);
    expect(getWebCodecsKeyFrameInterval(30)).toBe(60);
    expect(getWebCodecsKeyFrameInterval(24)).toBe(48);
    expect(getWebCodecsKeyFrameInterval(0.25)).toBe(1);
  });
});

describe("createWebCodecsMp4Encoder", () => {
  it.each([
    [30, 60],
    [24, 48],
  ])("encodes 900 frames at %ifps with exact timestamps and a key frame every %i frames", async (fps, interval) => {
    const totalFrames = 900;
    const bytes = await encodeAll(fps, totalFrames);

    const encoder = lastEncoder();
    expect(encoder.config).toEqual({ ...config1080p, framerate: fps });
    expect(encoder.encoded).toHaveLength(totalFrames);
    encoder.encoded.forEach((record, frameIndex) => {
      expect(record.timestamp).toBe(Math.round((frameIndex * 1e6) / fps));
      expect(record.duration).toBe(Math.round(1e6 / fps));
      expect(record.keyFrame).toBe(frameIndex % interval === 0);
    });
    expect(Math.abs(encoder.encoded[899].timestamp - (899 * 1e6) / fps)).toBeLessThanOrEqual(0.5);

    // Every VideoFrame was closed exactly once, after encode() consumed it.
    expect(MockVideoFrame.instances).toHaveLength(totalFrames);
    expect(MockVideoFrame.instances.every((frame) => frame.closeCount === 1)).toBe(true);
    expect(MockVideoFrame.instances[0].init.alpha).toBe("discard");

    // Real Mediabunny muxer output, read back with the real demuxer.
    expect(topLevelBoxes(bytes)).toEqual(["ftyp", "moov", "mdat"]);
    const mp4 = await readMp4(bytes);
    expect(mp4.width).toBe(1920);
    expect(mp4.height).toBe(1080);
    expect(mp4.packets).toHaveLength(totalFrames);
    mp4.packets.forEach((packet, frameIndex) => {
      expect(packet.timestamp).toBeCloseTo(frameIndex / fps, 9);
      expect(packet.duration).toBeCloseTo(1 / fps, 9);
      expect(packet.type).toBe(frameIndex % interval === 0 ? "key" : "delta");
    });
    expect(mp4.duration).toBeCloseTo(totalFrames / fps, 9);
    expect(mp4.description).toEqual(AVCC);
  });

  it("waits while encodeQueueSize > 8 and resumes on dequeue", async () => {
    behavior.autoOutput = false;
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 3 });
    const canvas = makeCanvas();
    await encoder.addFrame(canvas, 0);
    const mock = lastEncoder();

    // Exactly the limit does not block.
    mock.encodeQueueSize = WEBCODECS_MAX_ENCODE_QUEUE_SIZE;
    await encoder.addFrame(canvas, 1);
    expect(mock.encoded).toHaveLength(2);

    mock.encodeQueueSize = WEBCODECS_MAX_ENCODE_QUEUE_SIZE + 1;
    let settled = false;
    const blocked = encoder.addFrame(canvas, 2).then(() => {
      settled = true;
    });
    // Longer than several fallback polls: still blocked because the queue stays above 8.
    await sleep(80);
    expect(settled).toBe(false);
    expect(mock.encoded).toHaveLength(2);
    // The snapshot was taken synchronously, but it stays open until encoded.
    expect(MockVideoFrame.instances[2].closed).toBe(false);

    mock.encodeQueueSize = WEBCODECS_MAX_ENCODE_QUEUE_SIZE;
    mock.dispatchEvent(new Event("dequeue"));
    await blocked;
    expect(mock.encoded).toHaveLength(3);
    expect(MockVideoFrame.instances[2].closed).toBe(true);

    mock.encodeQueueSize = 3;
    const finalized = encoder.finalize();
    const bytes = await finalized;
    expect((await readMp4(bytes)).packets).toHaveLength(3);
  });

  it("also resumes via the timer poll if an engine never fires dequeue", async () => {
    behavior.autoOutput = false;
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 2 });
    const canvas = makeCanvas();
    await encoder.addFrame(canvas, 0);
    const mock = lastEncoder();
    mock.encodeQueueSize = 20;
    const pending = encoder.addFrame(canvas, 1);
    await sleep(40);
    expect(mock.encoded).toHaveLength(1);
    mock.encodeQueueSize = 0; // drained silently
    await pending;
    expect(mock.encoded).toHaveLength(2);
    encoder.close();
  });

  it("rejects the next addFrame and finalize with the codec string after an encoder error", async () => {
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 3 });
    const canvas = makeCanvas();
    await encoder.addFrame(canvas, 0);
    lastEncoder().fail(new DOMException("GPU process crashed", "EncodingError"));

    const error = await encoder.addFrame(canvas, 1).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WebCodecsEncoderError);
    expect((error as WebCodecsEncoderError).codec).toBe("avc1.640028");
    expect((error as Error).message).toBe(
      "WebCodecs H.264 encoder (avc1.640028) failed: EncodingError: GPU process crashed"
    );
    expect((error as Error).cause).toBeInstanceOf(DOMException);
    await expect(encoder.finalize()).rejects.toBe(error);
    expect(MockVideoFrame.instances.every((frame) => frame.closed)).toBe(true);
    encoder.close();
    encoder.close();
  });

  it("surfaces an error raised while flushing in finalize", async () => {
    behavior.autoOutput = false;
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 1 });
    await encoder.addFrame(makeCanvas(), 0);
    const mock = lastEncoder();
    mock.flush = async () => {
      mock.fail(new DOMException("Encoding failed", "EncodingError"));
      throw new DOMException("Aborted due to error", "AbortError");
    };
    await expect(encoder.finalize()).rejects.toThrow(
      "WebCodecs H.264 encoder (avc1.640028) failed: EncodingError: Encoding failed"
    );
  });

  it("reports configure() failures with the codec string", async () => {
    const encoder = createWebCodecsMp4Encoder({
      config: { ...config1080p, codec: "avc1.640033" },
      fps: 30,
      totalFrames: 1,
    });
    vi.spyOn(MockVideoEncoder.prototype, "configure").mockImplementationOnce(() => {
      throw new TypeError("Invalid codec");
    });
    await expect(encoder.addFrame(makeCanvas(), 0)).rejects.toThrow(
      "WebCodecs H.264 encoder (avc1.640033) could not be configured: TypeError: Invalid codec"
    );
    expect(MockVideoFrame.instances[0].closed).toBe(true);
  });

  it("closes the encoder and rejects with AbortError when the signal aborts", async () => {
    behavior.autoOutput = false;
    const controller = new AbortController();
    const encoder = createWebCodecsMp4Encoder({
      config: config1080p,
      fps: 30,
      totalFrames: 3,
      signal: controller.signal,
    });
    const canvas = makeCanvas();
    await encoder.addFrame(canvas, 0);
    const mock = lastEncoder();
    mock.encodeQueueSize = 50;
    const blocked = encoder.addFrame(canvas, 1);

    controller.abort();
    await expect(blocked).rejects.toMatchObject({ name: "AbortError" });
    expect(mock.state).toBe("closed");
    expect(mock.closeCalls).toBe(1);
    expect(MockVideoFrame.instances.every((frame) => frame.closeCount === 1)).toBe(true);
    await expect(encoder.addFrame(canvas, 2)).rejects.toMatchObject({ name: "AbortError" });
    await expect(encoder.finalize()).rejects.toMatchObject({ name: "AbortError" });
    encoder.close();
    expect(mock.closeCalls).toBe(1);
  });

  it("rejects immediately for an already-aborted signal without creating an encoder", async () => {
    const controller = new AbortController();
    controller.abort();
    const encoder = createWebCodecsMp4Encoder({
      config: config1080p,
      fps: 30,
      totalFrames: 1,
      signal: controller.signal,
    });
    await expect(encoder.addFrame(makeCanvas(), 0)).rejects.toMatchObject({ name: "AbortError" });
    expect(MockVideoEncoder.instances).toHaveLength(0);
    expect(MockVideoFrame.instances).toHaveLength(0);
  });

  it("aborting during finalize rejects with AbortError", async () => {
    behavior.autoOutput = false;
    const controller = new AbortController();
    const encoder = createWebCodecsMp4Encoder({
      config: config1080p,
      fps: 30,
      totalFrames: 1,
      signal: controller.signal,
    });
    await encoder.addFrame(makeCanvas(), 0);
    const mock = lastEncoder();
    mock.flush = () =>
      new Promise((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          queueMicrotask(() => reject(new DOMException("closed", "AbortError")))
        );
      });
    const finalizing = encoder.finalize();
    controller.abort();
    await expect(finalizing).rejects.toMatchObject({ name: "AbortError", message: "WebCodecs export was cancelled" });
    expect(mock.state).toBe("closed");
  });

  it("finalize returns a fast-start MP4 and close() is idempotent afterwards", async () => {
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 2 });
    const canvas = makeCanvas();
    await encoder.addFrame(canvas, 0);
    await encoder.addFrame(canvas, 1);
    const bytes = await encoder.finalize();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(String.fromCharCode(...bytes.subarray(4, 8))).toBe("ftyp");
    expect(topLevelBoxes(bytes)).toEqual(["ftyp", "moov", "mdat"]);
    const mock = lastEncoder();
    expect(mock.closeCalls).toBe(1);

    encoder.close();
    encoder.close();
    expect(mock.closeCalls).toBe(1);
    await expect(encoder.finalize()).rejects.toThrow("is closed");
    await expect(encoder.addFrame(canvas, 2)).rejects.toThrow("is closed");
  });

  it("close() before finalize releases the encoder and rejects later calls", async () => {
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 3 });
    await encoder.addFrame(makeCanvas(), 0);
    encoder.close();
    encoder.close();
    expect(lastEncoder().closeCalls).toBe(1);
    await expect(encoder.addFrame(makeCanvas(), 1)).rejects.toThrow(
      "WebCodecs H.264 encoder (avc1.640028) is closed"
    );
  });

  it("validates frame order, frame count and canvas size without poisoning the encoder", async () => {
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 2 });
    const canvas = makeCanvas();
    await expect(encoder.addFrame(canvas, 1)).rejects.toThrow("Expected frame 0, got 1");
    await expect(encoder.addFrame(makeCanvas(1280, 720), 0)).rejects.toThrow(
      "Canvas is 1280x720 but the encoder is configured for 1920x1080"
    );
    await encoder.addFrame(canvas, 0);
    await expect(encoder.finalize()).rejects.toThrow("cannot finalize after 1 of 2 frames");
    await encoder.addFrame(canvas, 1);
    await expect(encoder.addFrame(canvas, 2)).rejects.toThrow(RangeError);
    expect((await readMp4(await encoder.finalize())).packets).toHaveLength(2);
    await expect(encoder.finalize()).rejects.toThrow("is already finalized");
  });

  it("treats a failed canvas snapshot as retryable", async () => {
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 1 });
    const tainted = makeCanvas();
    class TaintedFrame extends MockVideoFrame {
      constructor(source: unknown, init: VideoFrameInit) {
        if (source === tainted) throw new DOMException("tainted", "SecurityError");
        super(source, init);
      }
    }
    vi.stubGlobal("VideoFrame", TaintedFrame);
    await expect(encoder.addFrame(tainted, 0)).rejects.toThrow(
      "could not read frame 0 from the canvas: SecurityError: tainted"
    );
    await encoder.addFrame(makeCanvas(), 0);
    expect((await readMp4(await encoder.finalize())).packets).toHaveLength(1);
  });

  it("validates construction arguments", () => {
    expect(() =>
      createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 0 })
    ).toThrow(RangeError);
    expect(() => createWebCodecsMp4Encoder({ config: config1080p, fps: 0, totalFrames: 1 })).toThrow(
      RangeError
    );
    expect(() =>
      createWebCodecsMp4Encoder({ config: { ...config1080p, codec: "" }, fps: 30, totalFrames: 1 })
    ).toThrow(TypeError);
  });

  it("maps Firefox's duration-shifted chunk timestamps back to exact frames", async () => {
    behavior.shiftTimestamps = true;
    const bytes = await encodeAll(30, 90);
    const mp4 = await readMp4(bytes);
    expect(mp4.packets).toHaveLength(90);
    mp4.packets.forEach((packet, frameIndex) => {
      expect(packet.timestamp).toBeCloseTo(frameIndex / 30, 9);
    });
  });

  it("matches WebKit's ±1µs-quantized frame timestamps by actual timestamp", async () => {
    // WebKit coerces the VideoFrame constructor timestamp by ±1µs (observed:
    // requested 4033333µs → frame reports 4033332µs) and chunks echo the
    // quantized value, so matching must use frame.timestamp, not the request.
    class QuantizedFrame extends MockVideoFrame {
      constructor(source: unknown, init: VideoFrameInit) {
        super(source, init);
        if (MockVideoFrame.instances.length % 3 === 0) {
          Object.defineProperty(this, "timestamp", { value: (init.timestamp ?? 0) - 1 });
        }
      }
    }
    vi.stubGlobal("VideoFrame", QuantizedFrame);
    const mp4 = await readMp4(await encodeAll(30, 90));
    expect(mp4.packets).toHaveLength(90);
    mp4.packets.forEach((packet, frameIndex) => {
      expect(packet.timestamp).toBeCloseTo(frameIndex / 30, 9);
    });
  });

  it("repairs a duplicated-NAL-header avcC before muxing", async () => {
    behavior.description = FIREFOX_AVCC;
    const mp4 = await readMp4(await encodeAll(30, 2));
    expect(mp4.description).toEqual(AVCC);
  });

  it("fails loudly on a chunk whose timestamp matches no submitted frame", async () => {
    behavior.autoOutput = false;
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 2 });
    const canvas = makeCanvas();
    await encoder.addFrame(canvas, 0);
    const mock = lastEncoder();
    mock.queued[0] = { ...mock.queued[0], timestamp: 12_345 };
    mock.emitNext();
    await expect(encoder.addFrame(canvas, 1)).rejects.toThrow(
      "WebCodecs H.264 encoder (avc1.640028) emitted a chunk with unexpected timestamp 12345µs"
    );
  });

  it("recreates an encoder reclaimed while idle and restarts with a key frame", async () => {
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 4 });
    const canvas = makeCanvas();
    await encoder.addFrame(canvas, 0);
    await encoder.addFrame(canvas, 1);
    await sleep(0); // let outputs drain so nothing is in flight
    const first = lastEncoder();
    first.fail(new DOMException("Codec reclaimed due to inactivity.", "QuotaExceededError"));

    await encoder.addFrame(canvas, 2);
    await encoder.addFrame(canvas, 3);
    expect(MockVideoEncoder.instances).toHaveLength(2);
    const second = lastEncoder();
    expect(second.encoded.map((record) => record.keyFrame)).toEqual([true, false]);
    const mp4 = await readMp4(await encoder.finalize());
    expect(mp4.packets.map((packet) => packet.type)).toEqual(["key", "delta", "key", "delta"]);
    expect(mp4.packets.map((packet) => packet.timestamp * 30)).toEqual([0, 1, 2, 3]);
  });

  it("treats reclamation with frames in flight as a failure", async () => {
    behavior.autoOutput = false;
    const encoder = createWebCodecsMp4Encoder({ config: config1080p, fps: 30, totalFrames: 2 });
    const canvas = makeCanvas();
    await encoder.addFrame(canvas, 0);
    lastEncoder().fail(new DOMException("Codec reclaimed due to inactivity.", "QuotaExceededError"));
    await expect(encoder.addFrame(canvas, 1)).rejects.toThrow(
      "WebCodecs H.264 encoder (avc1.640028) failed: QuotaExceededError: Codec reclaimed due to inactivity."
    );
  });
});

describe("repairAvcDecoderConfigurationRecord", () => {
  it("strips duplicated SPS/PPS header bytes and restores the reserved bits", () => {
    expect(repairAvcDecoderConfigurationRecord(FIREFOX_AVCC)).toEqual(AVCC);
  });

  it("keeps High-profile trailing extension bytes", () => {
    const extension = [0xfd, 0xf8, 0xf8, 0x00];
    expect(
      repairAvcDecoderConfigurationRecord(Uint8Array.from([...FIREFOX_AVCC, ...extension]))
    ).toEqual(Uint8Array.from([...AVCC, ...extension]));
  });

  it("returns well-formed or unparseable records unchanged", () => {
    expect(repairAvcDecoderConfigurationRecord(AVCC)).toBe(AVCC);
    const truncated = FIREFOX_AVCC.subarray(0, 10);
    expect(repairAvcDecoderConfigurationRecord(truncated)).toBe(truncated);
    const notVersion1 = Uint8Array.from([2, ...FIREFOX_AVCC.subarray(1)]);
    expect(repairAvcDecoderConfigurationRecord(notVersion1)).toBe(notVersion1);
  });
});

describe("createWebCodecsMp4Encoder audio track", () => {
  // jsdom has no AudioEncoder, so Mediabunny's AudioBufferSource.add is
  // stubbed at the prototype: the muxer, track wiring and finalize ordering
  // are still real.
  const fakeAudioBuffer = { duration: 2 } as AudioBuffer;

  it("adds an AAC track, awaits source.add before finalizing, and returns a valid MP4", async () => {
    const mediabunny = await import("mediabunny");
    const addSpy = vi
      .spyOn(mediabunny.AudioBufferSource.prototype, "add")
      .mockResolvedValue();
    const encoder = createWebCodecsMp4Encoder({
      config: config1080p,
      fps: 30,
      totalFrames: 2,
      audio: { buffer: fakeAudioBuffer, bitrate: 128_000 },
    });
    const canvas = makeCanvas();
    await encoder.addFrame(canvas, 0);
    await encoder.addFrame(canvas, 1);
    const mp4 = await readMp4(await encoder.finalize());
    expect(addSpy).toHaveBeenCalledWith(fakeAudioBuffer);
    expect(mp4.packets.map((packet) => packet.timestamp * 30)).toEqual([0, 1]);
  });

  it("turns an audio encoding failure into a WebCodecsEncoderError on finalize", async () => {
    const mediabunny = await import("mediabunny");
    let rejectAdd!: (error: unknown) => void;
    vi.spyOn(mediabunny.AudioBufferSource.prototype, "add").mockImplementation(
      () => new Promise<void>((_resolve, reject) => { rejectAdd = reject; })
    );
    const encoder = createWebCodecsMp4Encoder({
      config: config1080p,
      fps: 30,
      totalFrames: 1,
      audio: { buffer: fakeAudioBuffer, bitrate: 128_000 },
    });
    await encoder.addFrame(makeCanvas(), 0);
    rejectAdd(new Error("no AudioEncoder here"));
    await expect(encoder.finalize()).rejects.toThrow(
      "WebCodecs AAC audio encoding failed: no AudioEncoder here"
    );
  });
});
