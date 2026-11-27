import { Sandbox } from "@vercel/sandbox";
import {
  createRenderPlan,
  getTotalFrameCount,
  parseMarkdown,
  validateExportInput,
} from "@markdown-video/core";
import { z } from "zod";

import { getSandboxCliBundle, RenderSandboxBundleError } from "./bundle";

export const RENDER_SANDBOX_TEMPLATE_NAME = "mdv-render-template";
export const MAX_RENDER_DURATION_SECONDS = 30;
export const MAX_RENDER_VIDEO_BYTES = 6 * 1024 * 1024;
export const PREVIEW_FRAME_COUNT = 5;
export const PREVIEW_RESOLUTION = "720p";
export const SANDBOX_PREVIEW_TIMEOUT_MS = 20_000;
export const SANDBOX_VIDEO_TIMEOUT_MS = 45_000;
const SANDBOX_FORK_LIFETIME_MS = 10 * 60_000;
const JOB_CWD = "/vercel/job";
const SANDBOX_COMMAND_ENV = {
  // Sandbox command env maps must be self-contained enough for the renderer
  // even if the executor treats them as a replacement rather than an overlay.
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  HOME: JOB_CWD,
  XDG_CACHE_HOME: "/vercel/job/.cache",
  PLAYWRIGHT_BROWSERS_PATH: "/vercel/ms-playwright",
} as const;
const MAX_STDERR_CHARS = 1_000;

const markdownSchema = z
  .string()
  .min(1)
  .max(100_000)
  .refine(
    (markdown) => Buffer.byteLength(markdown, "utf8") <= 400_000,
    "Markdown must not exceed 400000 UTF-8 bytes"
  );

const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1", "4:3"]);
const localeSchema = z
  .string()
  .regex(/^[\p{L}\p{N}_.-]{1,64}$/u, "Use a locale code such as en, es, or pt-BR")
  .nullish();

const previewRequestSchema = z.strictObject({
  markdown: markdownSchema,
  times: z
    .array(z.number().finite().nonnegative().max(MAX_RENDER_DURATION_SECONDS))
    .min(3)
    .max(6)
    .optional(),
  aspectRatio: aspectRatioSchema.optional(),
  locale: localeSchema,
});

const videoOptionsSchema = z.strictObject({
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  quality: z.enum(["low", "medium", "high"]).optional(),
  speed: z.enum(["fastest", "fast", "balanced"]).optional(),
  fps: z.number().int().min(1).max(30).optional(),
  aspectRatio: aspectRatioSchema.optional(),
  locale: localeSchema,
});

const videoRequestSchema = z.strictObject({
  markdown: markdownSchema,
  options: videoOptionsSchema.optional(),
});

const previewResponseSchema = z.strictObject({
  duration: z.number().finite().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frames: z
    .array(
      z.strictObject({
        time: z.number().finite().nonnegative(),
        pngBase64: z.string().min(1),
      })
    )
    .min(3)
    .max(6),
});

export type SandboxPreviewInput = z.infer<typeof previewRequestSchema>;
export type SandboxVideoInput = z.infer<typeof videoRequestSchema>;
export type SandboxPreviewResponse = z.infer<typeof previewResponseSchema>;

export interface SandboxVideoResponse {
  mp4: Buffer;
  duration: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  sizeBytes: number;
}

export class RenderSandboxConfigurationError extends Error {
  constructor(message = "Vercel Sandbox rendering is not configured.") {
    super(message);
    this.name = "RenderSandboxConfigurationError";
  }
}

export class RenderSandboxRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderSandboxRequestError";
  }
}

type SandboxInstance = Awaited<ReturnType<typeof Sandbox.fork>>;
type SandboxFactory = Pick<typeof Sandbox, "fork">;

export interface SandboxRenderDependencies {
  sandboxFactory?: SandboxFactory;
  loadBundle?: () => Promise<Array<{ path: string; content: Uint8Array }>>;
  now?: () => number;
}

export function isRenderSandboxConfigured(env = process.env) {
  if (env.VERCEL_OIDC_TOKEN) return true;
  return Boolean(env.VERCEL_TOKEN && env.VERCEL_TEAM_ID && env.VERCEL_PROJECT_ID);
}

function sandboxCredentials(env = process.env) {
  if (env.VERCEL_OIDC_TOKEN) return {};
  const token = env.VERCEL_TOKEN;
  const teamId = env.VERCEL_TEAM_ID;
  const projectId = env.VERCEL_PROJECT_ID;
  if (token && teamId && projectId) return { token, teamId, projectId };
  throw new RenderSandboxConfigurationError(
    "Vercel Sandbox rendering is not configured. Set VERCEL_OIDC_TOKEN on Vercel, or VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID for API-token authentication."
  );
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown, label: string): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new RenderSandboxRequestError(
      `Invalid ${label} request${issue ? `: ${issue.message}` : "."}`
    );
  }
  return parsed.data;
}

function parseMarkdownScenes(markdown: string) {
  try {
    return parseMarkdown(markdown);
  } catch (error) {
    throw new RenderSandboxRequestError(
      `Could not parse markdown input: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function validateDuration(markdown: string, fps = 24) {
  const scenes = parseMarkdownScenes(markdown);
  const duration = scenes.reduce((total, scene) => total + scene.duration, 0);
  if (duration > MAX_RENDER_DURATION_SECONDS) {
    throw new RenderSandboxRequestError(
      `Video duration ${duration}s exceeds the ${MAX_RENDER_DURATION_SECONDS}s render cap.`
    );
  }
  const validation = validateExportInput({
    sceneCount: scenes.length,
    totalDuration: duration,
    fps,
  });
  if (!validation.valid) {
    throw new RenderSandboxRequestError(validation.reason ?? "Invalid render input.");
  }
  return duration;
}

/** Match the worker's inclusive first/final-frame preview spread. */
export function selectSandboxPreviewTimes(totalDuration: number, count = PREVIEW_FRAME_COUNT) {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    throw new RenderSandboxRequestError("Video duration must be positive before previewing.");
  }
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, index) => (index / (count - 1)) * totalDuration);
}

export function normalizeSandboxPreviewTimes(
  requestedTimes: number[] | undefined,
  totalDuration: number
) {
  const times = requestedTimes
    ? [...requestedTimes].sort((a, b) => a - b)
    : selectSandboxPreviewTimes(totalDuration);
  return times.map((time) => Math.min(time, totalDuration));
}

function sanitizeStderr(stderr: string) {
  return stderr
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_STDERR_CHARS);
}

function isAbortLike(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

function timeoutController(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  return {
    signal: controller.signal,
    expired: () => controller.signal.aborted,
    clear: () => clearTimeout(timer),
  };
}

function cleanupSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function cleanupSandbox(sandbox: SandboxInstance) {
  const stopTimeout = cleanupSignal(10_000);
  const stopError = await sandbox
    .stop({ signal: stopTimeout.signal })
    .then(() => null)
    .catch((error: unknown) => error);
  stopTimeout.clear();

  const deleteTimeout = cleanupSignal(10_000);
  const deleteError = await sandbox
    .delete({ deleteOrphanSnapshots: true, signal: deleteTimeout.signal })
    .then(() => null)
    .catch((error: unknown) => error);
  deleteTimeout.clear();

  // Delete is the terminal cleanup operation. If it succeeds, a transient
  // stop/API race did not leak the fork and should not fail the render.
  return deleteError ? [stopError, deleteError].filter(Boolean) : [];
}

async function withSandboxFork<T>(
  timeoutMs: number,
  operation: string,
  dependencies: SandboxRenderDependencies,
  run: (sandbox: SandboxInstance, signal: AbortSignal) => Promise<T>
): Promise<T> {
  const factory = dependencies.sandboxFactory ?? Sandbox;
  const timeout = timeoutController(timeoutMs);
  let sandbox: SandboxInstance | null = null;
  let primaryError: unknown = null;

  try {
    const sourceSandbox =
      process.env.MDV_RENDER_SANDBOX_TEMPLATE?.trim() || RENDER_SANDBOX_TEMPLATE_NAME;
    sandbox = await factory.fork({
      sourceSandbox,
      persistent: false,
      timeout: SANDBOX_FORK_LIFETIME_MS,
      networkPolicy: "deny-all",
      ...sandboxCredentials(),
      signal: timeout.signal,
    });
    return await run(sandbox, timeout.signal);
  } catch (error) {
    primaryError = error;
    if (timeout.expired() || isAbortLike(error)) {
      throw new RenderSandboxRequestError(
        `Vercel Sandbox ${operation} exceeded the ${Math.floor(timeoutMs / 1000)}s hard timeout.`
      );
    }
    if (
      error instanceof RenderSandboxRequestError ||
      error instanceof RenderSandboxConfigurationError ||
      error instanceof RenderSandboxBundleError
    ) {
      throw error;
    }
    throw new RenderSandboxRequestError(
      `Vercel Sandbox ${operation} failed: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    timeout.clear();
    if (sandbox) {
      const cleanupErrors = await cleanupSandbox(sandbox);
      if (cleanupErrors.length > 0 && primaryError === null) {
        throw new RenderSandboxRequestError(
          `Vercel Sandbox ${operation} completed but cleanup failed; the fork may not have been deleted.`
        );
      }
    }
  }
}

async function runCliCommand(
  sandbox: SandboxInstance,
  args: string[],
  timeoutMs: number,
  signal: AbortSignal,
  operation: string
) {
  const started = Date.now();
  const command = await sandbox.runCommand({
    cmd: "node",
    args,
    cwd: JOB_CWD,
    timeoutMs,
    signal,
    env: SANDBOX_COMMAND_ENV,
  });
  const [stdout, stderr] = await Promise.all([command.stdout(), command.stderr()]);
  if (command.exitCode !== 0) {
    const detail = sanitizeStderr(stderr);
    const elapsed = Date.now() - started;
    const timedOut = elapsed >= timeoutMs - 100;
    throw new RenderSandboxRequestError(
      `Vercel Sandbox CLI ${operation} ${timedOut ? "timed out" : `exited with code ${command.exitCode}`}${detail ? `: ${detail}` : "."}`
    );
  }
  return stdout;
}

async function prepareJob(
  sandbox: SandboxInstance,
  markdown: string,
  signal: AbortSignal,
  loadBundle: NonNullable<SandboxRenderDependencies["loadBundle"]>
) {
  const bundle = await loadBundle();
  await sandbox.writeFiles(
    [...bundle, { path: "job/input.md", content: markdown }],
    { signal }
  );
}

function optionalCliOption(args: string[], flag: string, value: string | null | undefined) {
  if (value !== undefined && value !== null) args.push(flag, value);
}

function validatePngBase64(frame: { time: number; pngBase64: string }) {
  const prefix = Buffer.from(frame.pngBase64.slice(0, 24), "base64");
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (prefix.length < 8 || !prefix.subarray(0, 8).equals(pngMagic)) {
    throw new RenderSandboxRequestError(
      `Vercel Sandbox CLI returned malformed PNG data for preview frame ${frame.time}s.`
    );
  }
}

export async function renderSandboxPreview(
  rawInput: SandboxPreviewInput,
  dependencies: SandboxRenderDependencies = {}
): Promise<SandboxPreviewResponse> {
  const input = parseInput(previewRequestSchema, rawInput, "sandbox preview");
  const duration = validateDuration(input.markdown);
  const times = normalizeSandboxPreviewTimes(input.times, duration);

  return withSandboxFork(
    SANDBOX_PREVIEW_TIMEOUT_MS,
    "preview render",
    dependencies,
    async (sandbox, signal) => {
      await prepareJob(sandbox, input.markdown, signal, dependencies.loadBundle ?? getSandboxCliBundle);
      const args = [
        "cli.js",
        "preview",
        "input.md",
        "--json",
        "--times",
        times.map((time) => String(time)).join(","),
        "--resolution",
        PREVIEW_RESOLUTION,
        "--deny-remote-network",
      ];
      optionalCliOption(args, "--aspect-ratio", input.aspectRatio);
      optionalCliOption(args, "--locale", input.locale);
      const stdout = await runCliCommand(
        sandbox,
        args,
        SANDBOX_PREVIEW_TIMEOUT_MS,
        signal,
        "preview"
      );

      let json: unknown;
      try {
        json = JSON.parse(stdout);
      } catch {
        throw new RenderSandboxRequestError("Vercel Sandbox CLI did not return preview JSON.");
      }
      const parsed = previewResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new RenderSandboxRequestError("Vercel Sandbox CLI returned malformed preview data.");
      }
      parsed.data.frames.forEach(validatePngBase64);
      return parsed.data;
    }
  );
}

function validateMp4(mp4: Buffer) {
  if (mp4.byteLength === 0) {
    throw new RenderSandboxRequestError("Vercel Sandbox CLI returned an empty mp4.");
  }
  if (mp4.byteLength > MAX_RENDER_VIDEO_BYTES) {
    throw new RenderSandboxRequestError(
      `Rendered video is ${mp4.byteLength} bytes, exceeding the ${MAX_RENDER_VIDEO_BYTES}-byte cap.`
    );
  }
  if (mp4.byteLength < 12 || mp4.subarray(4, 8).toString("ascii") !== "ftyp") {
    throw new RenderSandboxRequestError("Vercel Sandbox CLI returned malformed mp4 data.");
  }
}

export async function renderSandboxVideo(
  rawInput: SandboxVideoInput,
  dependencies: SandboxRenderDependencies = {}
): Promise<SandboxVideoResponse> {
  const input = parseInput(videoRequestSchema, rawInput, "sandbox video");
  const options = input.options ?? {};
  const resolution = options.resolution ?? "720p";
  const quality = options.quality ?? "medium";
  const speed = options.speed ?? "fast";
  const fps = options.fps ?? 24;
  const duration = validateDuration(input.markdown, fps);

  return withSandboxFork(
    SANDBOX_VIDEO_TIMEOUT_MS,
    "video render",
    dependencies,
    async (sandbox, signal) => {
      await prepareJob(sandbox, input.markdown, signal, dependencies.loadBundle ?? getSandboxCliBundle);
      const args = [
        "cli.js",
        "render",
        "input.md",
        "--output",
        "output.mp4",
        "--overwrite",
        "--resolution",
        resolution,
        "--quality",
        quality,
        "--speed",
        speed,
        "--fps",
        String(fps),
        "--deny-remote-network",
      ];
      optionalCliOption(args, "--aspect-ratio", options.aspectRatio);
      optionalCliOption(args, "--locale", options.locale);
      await runCliCommand(sandbox, args, SANDBOX_VIDEO_TIMEOUT_MS, signal, "video render");

      const mp4 = await sandbox.readFileToBuffer(
        { path: "output.mp4", cwd: JOB_CWD },
        { signal }
      );
      if (!mp4) {
        throw new RenderSandboxRequestError("Vercel Sandbox CLI did not produce output.mp4.");
      }
      validateMp4(mp4);
      const plan = createRenderPlan({
        resolution,
        projectAspectRatio: options.aspectRatio ?? "16:9",
        quality,
      });
      return {
        mp4,
        duration,
        width: plan.width,
        height: plan.height,
        fps,
        totalFrames: getTotalFrameCount(duration, fps),
        sizeBytes: mp4.byteLength,
      };
    }
  );
}
