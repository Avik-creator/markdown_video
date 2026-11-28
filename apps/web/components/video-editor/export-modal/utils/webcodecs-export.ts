// WebCodecs H.264 encoding + Mediabunny MP4 muxing for browser MP4 export.
//
// We own the VideoEncoder directly and hand its encoded chunks to Mediabunny's
// EncodedVideoPacketSource. That keeps the exact codec string,
// VideoEncoderConfig, per-frame microsecond timestamps, key-frame cadence and
// encode-queue backpressure under this module's control. Mediabunny is only
// the MP4 muxer, writing a fast-start file (moov before mdat).
//
// Because we bypass Mediabunny's own encoder wrapper, we also handle the
// browser quirks it would otherwise absorb for us:
// - chunk timestamps are resolved back to the exact submitted frame, including
//   Firefox's AVC encoder, which shifts chunk timestamps by one frame duration;
// - a malformed avcC with a duplicated SPS/PPS NAL header byte (seen from
//   Firefox's encoder, and it plays black in Chrome) is repaired;
// - an encoder that Chrome reclaimed while idle (for example because the
//   export tab was in the background) is recreated, but only when no frames
//   were in flight. Otherwise it fails loudly.
//
// Mediabunny is large (its full minified bundle is about 750 KB), so it is
// loaded with a dynamic import when an encoder is created. Feature detection
// and config selection add nothing to the editor bundle.

import type {
  BufferTarget,
  EncodedPacket,
  EncodedVideoPacketSource,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

export type WebCodecsExportQuality = "low" | "medium" | "high" | "ultra";

/**
 * Target bits per pixel per frame for each export quality. Unknown quality
 * strings fall back to "high", the same as getVideoEncodingSettings.
 */
export const WEBCODECS_BITS_PER_PIXEL: Readonly<Record<WebCodecsExportQuality, number>> =
  Object.freeze({
    low: 0.04,
    medium: 0.07,
    high: 0.1,
    ultra: 0.15,
  });

/** Encode requests allowed in the queue before addFrame waits for a dequeue. */
export const WEBCODECS_MAX_ENCODE_QUEUE_SIZE = 8;

/**
 * Fallback poll interval while waiting for the encoder queue to drain. The
 * `dequeue` event normally wakes us first. This timer only guards against
 * engines that never fire it, and it does not use requestAnimationFrame, so it
 * keeps running when the tab is hidden.
 */
const BACKPRESSURE_POLL_MS = 25;

type H264Profile = "high" | "main" | "baseline";

interface H264LevelLimits {
  /** MaxMBPS: macroblock processing rate (Table A-1). */
  maxMacroblocksPerSecond: number;
  /** MaxFS: frame size in macroblocks (Table A-1). */
  maxFrameSizeMacroblocks: number;
  /** MaxBR in kbit/s for Baseline/Main; High allows 1.25x (Table A-1/A-2). */
  maxBitrateKbps: number;
}

// ITU-T H.264 Annex A, Table A-1, restricted to the levels we offer.
const H264_LEVEL_LIMITS = {
  "3.1": { maxMacroblocksPerSecond: 108_000, maxFrameSizeMacroblocks: 3_600, maxBitrateKbps: 14_000 },
  "4.0": { maxMacroblocksPerSecond: 245_760, maxFrameSizeMacroblocks: 8_192, maxBitrateKbps: 20_000 },
  "4.2": { maxMacroblocksPerSecond: 522_240, maxFrameSizeMacroblocks: 8_704, maxBitrateKbps: 50_000 },
  "5.1": { maxMacroblocksPerSecond: 983_040, maxFrameSizeMacroblocks: 36_864, maxBitrateKbps: 240_000 },
} as const satisfies Record<string, H264LevelLimits>;

export type WebCodecsH264Level = keyof typeof H264_LEVEL_LIMITS;

export interface WebCodecsH264Candidate {
  codec: string;
  profile: H264Profile;
  level: WebCodecsH264Level;
}

// Codec strings tried, in order of preference: the lowest level that can
// carry the output wins, so the encoded stream claims no more capability than
// it needs. High@4.0 covers 1080p30, High@4.2 covers 1080p60, and only
// 1440p/4K outputs fall through to High@5.1.
export const WEBCODECS_H264_CANDIDATES: readonly WebCodecsH264Candidate[] = Object.freeze([
  { codec: "avc1.640028", profile: "high", level: "4.0" },
  { codec: "avc1.64002A", profile: "high", level: "4.2" },
  { codec: "avc1.640033", profile: "high", level: "5.1" },
  { codec: "avc1.4D4028", profile: "main", level: "4.0" },
  { codec: "avc1.42001F", profile: "baseline", level: "3.1" },
]);

export interface WebCodecsVideoParams {
  width: number;
  height: number;
  fps: number;
  /** "low" | "medium" | "high" | "ultra"; anything else falls back to "high". */
  quality: string;
}

function resolveBitsPerPixel(quality: string): number {
  return Object.prototype.hasOwnProperty.call(WEBCODECS_BITS_PER_PIXEL, quality)
    ? WEBCODECS_BITS_PER_PIXEL[quality as WebCodecsExportQuality]
    : WEBCODECS_BITS_PER_PIXEL.high;
}

/** Target bitrate in bits per second: round(width * height * fps * bpp). */
export function getWebCodecsBitrate({ width, height, fps, quality }: WebCodecsVideoParams): number {
  return Math.round(width * height * fps * resolveBitsPerPixel(quality));
}

/**
 * Whether an H.264 level can carry this frame size, frame rate and bitrate.
 * Checks frame size (MaxFS), per-dimension size (sqrt(8 * MaxFS) macroblocks),
 * macroblock rate (MaxMBPS) and bitrate (MaxBR, x1.25 for High profile).
 */
export function h264LevelSupports(
  candidate: Pick<WebCodecsH264Candidate, "profile" | "level">,
  { width, height, fps, bitrate }: { width: number; height: number; fps: number; bitrate: number }
): boolean {
  const limits: H264LevelLimits = H264_LEVEL_LIMITS[candidate.level];
  const widthMacroblocks = Math.ceil(width / 16);
  const heightMacroblocks = Math.ceil(height / 16);
  const frameSizeMacroblocks = widthMacroblocks * heightMacroblocks;
  const maxDimensionMacroblocks = Math.sqrt(8 * limits.maxFrameSizeMacroblocks);
  const bitrateFactor = candidate.profile === "high" ? 1.25 : 1;
  return (
    frameSizeMacroblocks <= limits.maxFrameSizeMacroblocks &&
    widthMacroblocks <= maxDimensionMacroblocks &&
    heightMacroblocks <= maxDimensionMacroblocks &&
    frameSizeMacroblocks * fps <= limits.maxMacroblocksPerSecond &&
    bitrate <= limits.maxBitrateKbps * 1000 * bitrateFactor
  );
}

/** Candidates whose level can carry the requested output, in preference order. */
export function getEligibleWebCodecsH264Candidates(
  params: WebCodecsVideoParams
): WebCodecsH264Candidate[] {
  const bitrate = getWebCodecsBitrate(params);
  return WEBCODECS_H264_CANDIDATES.filter((candidate) =>
    h264LevelSupports(candidate, { ...params, bitrate })
  );
}

/** Synchronous feature check: true when the WebCodecs video encode classes exist. */
export function isWebCodecsExportSupported(): boolean {
  return typeof VideoEncoder === "function" && typeof VideoFrame === "function";
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer, got ${value}`);
  }
}

function assertPositiveFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive number, got ${value}`);
  }
}

/**
 * Pick the first H.264 config that the browser's VideoEncoder supports. Codec
 * strings whose level cannot carry the output are skipped without asking the
 * browser. Returns null when WebCodecs is missing, the dimensions are odd
 * (H.264 4:2:0 needs even dimensions), or no candidate is supported.
 */
export async function selectWebCodecsVideoConfig(
  params: WebCodecsVideoParams
): Promise<VideoEncoderConfig | null> {
  const { width, height, fps } = params;
  assertPositiveInteger(width, "width");
  assertPositiveInteger(height, "height");
  assertPositiveFinite(fps, "fps");

  if (!isWebCodecsExportSupported() || typeof VideoEncoder.isConfigSupported !== "function") {
    return null;
  }
  if (width % 2 !== 0 || height % 2 !== 0) return null;

  const bitrate = getWebCodecsBitrate(params);
  for (const candidate of getEligibleWebCodecsH264Candidates(params)) {
    const config: VideoEncoderConfig = {
      codec: candidate.codec,
      width,
      height,
      bitrate,
      framerate: fps,
      latencyMode: "quality",
      hardwareAcceleration: "no-preference",
      avc: { format: "avc" },
    };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return config;
    } catch {
      // Engines throw TypeError for configs they cannot parse. Treat it as
      // unsupported and try the next candidate.
    }
  }
  return null;
}

/** Presentation timestamp of a frame in microseconds, computed from its index. */
export function getWebCodecsFrameTimestampUs(frameIndex: number, fps: number): number {
  return Math.round((frameIndex * 1_000_000) / fps);
}

/** Frame duration in microseconds. */
export function getWebCodecsFrameDurationUs(fps: number): number {
  return Math.round(1_000_000 / fps);
}

/** Key frame every two seconds of frames (at least every frame). */
export function getWebCodecsKeyFrameInterval(fps: number): number {
  return Math.max(1, Math.round(fps * 2));
}

/** Encoder, muxer or lifecycle failure. `codec` is the configured codec string. */
export class WebCodecsEncoderError extends Error {
  readonly codec: string;

  constructor(message: string, codec: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "WebCodecsEncoderError";
    this.codec = codec;
  }
}

/**
 * Error or DOMException. DOMException is not always `instanceof Error` across
 * realms (jsdom, for example), so this checks its shape instead.
 */
function isErrorLike(error: unknown): error is Error {
  return (
    error instanceof Error ||
    (typeof error === "object" &&
      error !== null &&
      typeof (error as { name?: unknown }).name === "string" &&
      typeof (error as { message?: unknown }).message === "string")
  );
}

function describeError(error: unknown): string {
  if (isErrorLike(error)) {
    const { name, message } = error;
    return name && name !== "Error" ? `${name}: ${message}` : message;
  }
  return String(error);
}

function createAbortError(): Error {
  // DOMException's name is "AbortError", which isCancellationError recognizes.
  return new DOMException("WebCodecs export was cancelled", "AbortError");
}

function isCodecReclaimedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "QuotaExceededError" &&
    /reclaimed/i.test(String((error as { message?: unknown }).message ?? ""))
  );
}

function toUint8Array(source: AllowSharedBufferSource): Uint8Array {
  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }
  return new Uint8Array(source);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Repair an AVCDecoderConfigurationRecord whose SPS/PPS NAL units start with a
 * duplicated NAL header byte (`67 67 64 …` instead of `67 64 …`). Firefox's
 * encoder emits this, and Chrome plays the resulting MP4 as black frames.
 * Mediabunny applies the same fix in its own encoder wrapper; see
 * github.com/Vanilagy/mediabunny/issues/559. An SPS's second byte is
 * profile_idc, which is never 0x67, so two equal leading bytes reliably mean
 * the header is duplicated. Returns the input unchanged when it is well formed
 * or cannot be parsed.
 */
export function repairAvcDecoderConfigurationRecord(record: Uint8Array): Uint8Array {
  if (record.byteLength < 7 || record[0] !== 1) return record;

  const readParameterSets = (start: number, count: number) => {
    const sets: Uint8Array[] = [];
    let offset = start;
    for (let i = 0; i < count; i++) {
      if (offset + 2 > record.byteLength) return null;
      const length = (record[offset] << 8) | record[offset + 1];
      offset += 2;
      if (offset + length > record.byteLength) return null;
      sets.push(record.subarray(offset, offset + length));
      offset += length;
    }
    return { sets, end: offset };
  };

  const sps = readParameterSets(6, record[5] & 0x1f);
  if (!sps || sps.end >= record.byteLength) return record;
  const pps = readParameterSets(sps.end + 1, record[sps.end]);
  if (!pps) return record;

  const hasDuplicatedHeader = (set: Uint8Array) => set.byteLength >= 2 && set[0] === set[1];
  if (sps.sets.length === 0 || !hasDuplicatedHeader(sps.sets[0])) return record;

  const strip = (set: Uint8Array) => (hasDuplicatedHeader(set) ? set.subarray(1) : set);
  const fixedSps = sps.sets.map(strip);
  const fixedPps = pps.sets.map(strip);
  const trailing = record.subarray(pps.end);

  const parts: number[] = [
    record[0],
    record[1],
    record[2],
    record[3],
    0xfc | (record[4] & 0x03), // reserved '111111' + lengthSizeMinusOne
    0xe0 | fixedSps.length, // reserved '111' + numOfSequenceParameterSets
  ];
  for (const set of fixedSps) parts.push(set.byteLength >> 8, set.byteLength & 0xff, ...set);
  parts.push(fixedPps.length);
  for (const set of fixedPps) parts.push(set.byteLength >> 8, set.byteLength & 0xff, ...set);
  parts.push(...trailing);
  return Uint8Array.from(parts);
}

export interface CreateWebCodecsMp4EncoderOptions {
  /** A config returned by selectWebCodecsVideoConfig. */
  config: VideoEncoderConfig;
  /** Output frame rate. Frame timestamps are derived from frame indices. */
  fps: number;
  /** Exact number of frames that will be added before finalize(). */
  totalFrames: number;
  /** Aborting closes the encoder and rejects pending and future calls with an AbortError. */
  signal?: AbortSignal;
}

export interface WebCodecsMp4Encoder {
  /**
   * Snapshot `canvas` as frame `frameIndex` and queue it for encoding. Frames
   * must be added in order, starting at 0. The canvas is copied synchronously
   * when addFrame is called, so it can be redrawn right away. Await each call:
   * the promise is the backpressure signal and resolves once the encoder queue
   * has room again.
   */
  addFrame(canvas: HTMLCanvasElement | OffscreenCanvas, frameIndex: number): Promise<void>;
  /** Flush the encoder, finalize the fast-start MP4 and return its bytes. */
  finalize(): Promise<Uint8Array>;
  /** Release the encoder and muxer. Idempotent and safe after finalize or failure. */
  close(): void;
}

type EncoderLifecycle = "active" | "finalizing" | "finalized" | "closed";

/**
 * Create a WebCodecs H.264 encoder that muxes into an in-memory fast-start MP4.
 * Throws synchronously only for invalid arguments. Encoder, muxer and abort
 * failures reject the next addFrame() or finalize() call.
 */
export function createWebCodecsMp4Encoder({
  config,
  fps,
  totalFrames,
  signal,
}: CreateWebCodecsMp4EncoderOptions): WebCodecsMp4Encoder {
  if (!config || typeof config.codec !== "string" || config.codec.length === 0) {
    throw new TypeError("A VideoEncoderConfig with a codec string is required");
  }
  assertPositiveInteger(config.width, "config.width");
  assertPositiveInteger(config.height, "config.height");
  assertPositiveFinite(fps, "fps");
  assertPositiveInteger(totalFrames, "totalFrames");

  const codec = config.codec;
  const frameDurationUs = getWebCodecsFrameDurationUs(fps);
  const keyFrameInterval = getWebCodecsKeyFrameInterval(fps);

  let lifecycle: EncoderLifecycle = "active";
  let failure: Error | null = null;
  let nextFrameIndex = 0;

  let encoder: VideoEncoder | null = null;
  let encoderReclaimed = false;
  let forceNextKeyFrame = false;
  // Timestamps of frames sent to the current encoder instance that have not
  // been output yet, mapped back to their frame indices.
  const pendingFrames = new Map<number, number>();
  // Microsecond shift between chunk timestamps and frame timestamps, measured
  // on the first output: 0 normally, one frame duration for Firefox AVC.
  let chunkTimestampShiftUs: number | null = null;
  let firstTimestampOfInstance: number | null = null;
  let firstDescription: Uint8Array | null = null;

  let output: Output<Mp4OutputFormat, BufferTarget> | null = null;
  let videoSource: EncodedVideoPacketSource | null = null;
  let PacketClass: typeof EncodedPacket | null = null;
  let muxTail: Promise<void> = Promise.resolve();
  let addTail: Promise<void> = Promise.resolve();
  const wakeups = new Set<() => void>();

  const wakeAll = () => {
    for (const wake of Array.from(wakeups)) wake();
  };

  const encoderError = (message: string, cause?: unknown) =>
    new WebCodecsEncoderError(`WebCodecs H.264 encoder (${codec}) ${message}`, codec, { cause });

  const cancelOutput = () => {
    const current = output;
    if (!current || current.state === "finalized" || current.state === "canceled") return;
    void Promise.resolve()
      .then(() => current.cancel())
      .catch(() => {});
  };

  const releaseResources = () => {
    signal?.removeEventListener("abort", onAbort);
    if (encoder && encoder.state !== "closed") {
      try {
        encoder.close();
      } catch {
        // Already closed by the engine.
      }
    }
    cancelOutput();
    wakeAll();
  };

  const fail = (error: unknown) => {
    if (!failure) {
      failure = isErrorLike(error) ? error : encoderError(`failed: ${describeError(error)}`, error);
    }
    releaseResources();
  };

  function onAbort() {
    fail(createAbortError());
  }

  const throwIfFailedOrClosed = () => {
    if (failure) throw failure;
    if (lifecycle === "closed") throw encoderError("is closed");
  };

  /** Entry check for addFrame/finalize: only an active encoder accepts calls. */
  const throwIfUnusable = () => {
    throwIfFailedOrClosed();
    if (lifecycle !== "active") throw encoderError("is already finalized");
  };

  const ready: Promise<void> = (async () => {
    const mediabunny = await import("mediabunny");
    if (failure) return;
    const target = new mediabunny.BufferTarget();
    const nextOutput = new mediabunny.Output({
      format: new mediabunny.Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
    const source = new mediabunny.EncodedVideoPacketSource("avc");
    // frameRate makes the track timescale equal to the frame rate, so every
    // index-derived timestamp lands exactly on a tick.
    nextOutput.addVideoTrack(source, { frameRate: fps });
    output = nextOutput;
    videoSource = source;
    PacketClass = mediabunny.EncodedPacket;
    await nextOutput.start();
    if (failure) cancelOutput();
  })().catch((error: unknown) => {
    fail(
      new WebCodecsEncoderError(
        `WebCodecs MP4 muxer (${codec}) failed to start: ${describeError(error)}`,
        codec,
        { cause: error }
      )
    );
  });

  const resolveFrameIndex = (chunk: EncodedVideoChunk): number => {
    if (chunkTimestampShiftUs === null) {
      // Decode order begins with the forced key frame, so the very first
      // chunk belongs to the first frame sent to the encoder.
      if (chunk.timestamp === firstTimestampOfInstance) {
        chunkTimestampShiftUs = 0;
      } else if (
        firstTimestampOfInstance !== null &&
        chunk.timestamp - frameDurationUs === firstTimestampOfInstance
      ) {
        chunkTimestampShiftUs = frameDurationUs;
      }
    }
    const frameTimestamp = chunk.timestamp - (chunkTimestampShiftUs ?? 0);
    const frameIndex = pendingFrames.get(frameTimestamp);
    if (frameIndex === undefined) {
      throw encoderError(
        `emitted a chunk with unexpected timestamp ${chunk.timestamp}µs that matches no submitted frame`
      );
    }
    pendingFrames.delete(frameTimestamp);
    return frameIndex;
  };

  const normalizeMetadata = (
    meta: EncodedVideoChunkMetadata | undefined
  ): EncodedVideoChunkMetadata | undefined => {
    const decoderConfig = meta?.decoderConfig;
    if (!decoderConfig?.description) return meta;
    const description = repairAvcDecoderConfigurationRecord(
      toUint8Array(decoderConfig.description)
    );
    if (firstDescription && !bytesEqual(firstDescription, description)) {
      // MP4 holds a single avcC, so a mid-stream parameter-set change (for
      // example from a recreated encoder) would corrupt playback.
      throw encoderError("changed its H.264 parameter sets mid-stream");
    }
    firstDescription ??= description.slice();
    return { ...meta, decoderConfig: { ...decoderConfig, description } };
  };

  const handleOutput = (
    instance: VideoEncoder,
    chunk: EncodedVideoChunk,
    meta: EncodedVideoChunkMetadata | undefined
  ) => {
    if (instance !== encoder || failure || lifecycle === "closed") return;
    try {
      const frameIndex = resolveFrameIndex(chunk);
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      const packetMeta = normalizeMetadata(meta);
      const Packet = PacketClass;
      const source = videoSource;
      if (!Packet || !source) throw encoderError("produced output before the muxer started");
      // Exact rational seconds; with frameRate = fps the muxer stores frameIndex ticks.
      const packet = new Packet(data, chunk.type, frameIndex / fps, 1 / fps);
      muxTail = muxTail
        .then(() => (failure ? undefined : source.add(packet, packetMeta)))
        .catch((error: unknown) => {
          fail(
            new WebCodecsEncoderError(
              `WebCodecs MP4 muxer (${codec}) rejected frame ${frameIndex}: ${describeError(error)}`,
              codec,
              { cause: error }
            )
          );
        });
    } catch (error) {
      fail(error instanceof WebCodecsEncoderError ? error : encoderError(`output failed: ${describeError(error)}`, error));
    }
  };

  const handleEncoderError = (instance: VideoEncoder, error: DOMException) => {
    if (instance !== encoder || failure || lifecycle === "closed" || lifecycle === "finalized") {
      return;
    }
    if (isCodecReclaimedError(error) && pendingFrames.size === 0) {
      // The engine reclaimed an idle encoder. Nothing was in flight, so no
      // frame is lost. The next addFrame recreates it and forces a key frame.
      encoderReclaimed = true;
      wakeAll();
      return;
    }
    fail(encoderError(`failed: ${describeError(error)}`, error));
  };

  const ensureEncoder = (): VideoEncoder => {
    if (encoder && !encoderReclaimed) return encoder;
    if (encoder) {
      if (encoder.state !== "closed") encoder.close();
      forceNextKeyFrame = true;
    }
    encoderReclaimed = false;
    firstTimestampOfInstance = null;
    const instance: VideoEncoder = new VideoEncoder({
      output: (chunk, meta) => handleOutput(instance, chunk, meta),
      error: (error) => handleEncoderError(instance, error),
    });
    encoder = instance;
    try {
      instance.configure(config);
    } catch (error) {
      throw encoderError(`could not be configured: ${describeError(error)}`, error);
    }
    return instance;
  };

  const waitForDequeue = (instance: VideoEncoder) =>
    new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        instance.removeEventListener?.("dequeue", done);
        wakeups.delete(done);
        resolve();
      };
      const timer = setTimeout(done, BACKPRESSURE_POLL_MS);
      instance.addEventListener?.("dequeue", done);
      wakeups.add(done);
    });

  const encodeFrame = async (frame: VideoFrame, frameIndex: number, timestamp: number) => {
    await ready;
    for (;;) {
      // finalize() may already be waiting on this frame, so "finalizing" is fine here.
      throwIfFailedOrClosed();
      const instance = ensureEncoder();
      if (instance.encodeQueueSize <= WEBCODECS_MAX_ENCODE_QUEUE_SIZE) break;
      await waitForDequeue(instance);
    }
    const instance = ensureEncoder();
    const keyFrame = forceNextKeyFrame || frameIndex % keyFrameInterval === 0;
    pendingFrames.set(timestamp, frameIndex);
    firstTimestampOfInstance ??= timestamp;
    try {
      instance.encode(frame, { keyFrame });
    } catch (error) {
      throw encoderError(`rejected frame ${frameIndex}: ${describeError(error)}`, error);
    }
    forceNextKeyFrame = false;
    // Lets the muxer apply its own backpressure. muxTail never rejects.
    await muxTail;
    if (failure) throw failure;
  };

  if (signal?.aborted) {
    fail(createAbortError());
  } else {
    signal?.addEventListener("abort", onAbort, { once: true });
  }

  return {
    async addFrame(canvas, frameIndex) {
      throwIfUnusable();
      if (!Number.isInteger(frameIndex) || frameIndex !== nextFrameIndex) {
        throw new RangeError(`Expected frame ${nextFrameIndex}, got ${frameIndex}`);
      }
      if (frameIndex >= totalFrames) {
        throw new RangeError(`Frame ${frameIndex} exceeds the declared ${totalFrames} frames`);
      }
      if (canvas.width !== config.width || canvas.height !== config.height) {
        throw new RangeError(
          `Canvas is ${canvas.width}x${canvas.height} but the encoder is configured for ${config.width}x${config.height}`
        );
      }

      // Snapshot synchronously, before any await, so the caller may redraw
      // the shared canvas immediately. A failed snapshot (for example a
      // tainted canvas throwing SecurityError) is not fatal. It consumes no
      // frame index, so the caller may retry this index with another canvas.
      const timestamp = getWebCodecsFrameTimestampUs(frameIndex, fps);
      let frame: VideoFrame;
      try {
        frame = new VideoFrame(canvas, { timestamp, duration: frameDurationUs, alpha: "discard" });
      } catch (error) {
        throw encoderError(`could not read frame ${frameIndex} from the canvas: ${describeError(error)}`, error);
      }
      nextFrameIndex += 1;

      // Serialize encodes so frames always reach the encoder in order.
      const previous = addTail;
      let release!: () => void;
      addTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      try {
        await previous;
        await encodeFrame(frame, frameIndex, timestamp);
      } catch (error) {
        // Past this point every error is fatal: the encoder's frame sequence
        // can no longer be trusted.
        fail(error);
        throw failure ?? error;
      } finally {
        frame.close();
        release();
      }
    },

    async finalize() {
      throwIfUnusable();
      if (nextFrameIndex !== totalFrames) {
        throw encoderError(`cannot finalize after ${nextFrameIndex} of ${totalFrames} frames`);
      }
      lifecycle = "finalizing";
      try {
        await addTail;
        await ready;
        if (failure) throw failure;
        const instance = encoder;
        if (instance && !encoderReclaimed) {
          try {
            await instance.flush();
          } catch (error) {
            // A reclaim while idle is benign; anything else is a failure.
            if (!(encoderReclaimed && pendingFrames.size === 0)) {
              throw failure ?? encoderError(`flush failed: ${describeError(error)}`, error);
            }
          }
        }
        if (failure) throw failure;
        if (pendingFrames.size > 0) {
          throw encoderError(`never emitted ${pendingFrames.size} submitted frame(s)`);
        }
        await muxTail;
        if (failure) throw failure;

        const currentOutput = output;
        if (!currentOutput) throw encoderError("has no muxer output");
        await currentOutput.finalize();
        if (failure) throw failure;
        const buffer = currentOutput.target.buffer;
        if (!buffer) throw encoderError("muxer produced no MP4 data");

        lifecycle = "finalized";
        releaseResources();
        return new Uint8Array(buffer);
      } catch (error) {
        fail(error);
        throw failure ?? error;
      }
    },

    close() {
      if (lifecycle === "closed") return;
      lifecycle = "closed";
      releaseResources();
    },
  };
}
