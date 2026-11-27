import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  normalizeSandboxPreviewTimes,
  renderSandboxPreview,
  renderSandboxVideo,
  RenderSandboxRequestError,
  type SandboxRenderDependencies,
} from "../backend";

const MARKDOWN = "!scene\n!duration 2\n!text\nHi";
const PNG_BASE64 = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]).toString("base64");
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from("ftypisom"),
  Buffer.alloc(8),
]);

type Factory = NonNullable<SandboxRenderDependencies["sandboxFactory"]>;

const envKeys = [
  "VERCEL_OIDC_TOKEN",
  "VERCEL_TOKEN",
  "VERCEL_TEAM_ID",
  "VERCEL_PROJECT_ID",
  "MDV_RENDER_SANDBOX_TEMPLATE",
] as const;
let savedEnv: Record<string, string | undefined> = {};

function makeSandbox({
  stdout = "",
  stderr = "",
  exitCode = 0,
  mp4 = MP4,
}: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  mp4?: Buffer | null;
} = {}) {
  const commandParams: unknown[] = [];
  const sandbox = {
    writeFiles: vi.fn(async () => undefined),
    runCommand: vi.fn(async (params: unknown) => {
      commandParams.push(params);
      return {
        exitCode,
        stdout: async () => stdout,
        stderr: async () => stderr,
      };
    }),
    readFileToBuffer: vi.fn(async () => mp4),
    stop: vi.fn(async () => ({})),
    delete: vi.fn(async () => undefined),
  };
  return { sandbox, commandParams };
}

function makeDependencies(sandbox: ReturnType<typeof makeSandbox>["sandbox"]) {
  const fork = vi.fn(async () => sandbox);
  return {
    fork,
    dependencies: {
      sandboxFactory: { fork } as unknown as Factory,
      loadBundle: async () => [
        { path: "job/cli.js", content: new Uint8Array([1, 2, 3]) },
      ],
    } satisfies SandboxRenderDependencies,
  };
}

beforeEach(() => {
  savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
  process.env.VERCEL_OIDC_TOKEN = "test-oidc-token";
});

afterEach(() => {
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("normalizeSandboxPreviewTimes", () => {
  it("spreads five default times inclusively and sorts/clamps explicit times", () => {
    expect(normalizeSandboxPreviewTimes(undefined, 2)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(normalizeSandboxPreviewTimes([1.5, 0, 99], 2)).toEqual([0, 1.5, 2]);
  });
});

describe("renderSandboxPreview", () => {
  it("forks a non-persistent deny-all sandbox, runs the CLI safely, validates output, and cleans up", async () => {
    const payload = {
      duration: 2,
      width: 1280,
      height: 720,
      frames: [0, 0.5, 1].map((time) => ({ time, pngBase64: PNG_BASE64 })),
    };
    const { sandbox, commandParams } = makeSandbox({ stdout: JSON.stringify(payload) });
    const { fork, dependencies } = makeDependencies(sandbox);

    const result = await renderSandboxPreview(
      { markdown: MARKDOWN, times: [0, 0.5, 1], aspectRatio: "16:9", locale: "en" },
      dependencies
    );

    expect(result).toEqual(payload);
    expect(fork).toHaveBeenCalledOnce();
    expect(fork.mock.calls[0]?.[0]).toMatchObject({
      sourceSandbox: "mdv-render-template",
      persistent: false,
      timeout: 600_000,
      networkPolicy: "deny-all",
    });
    expect(sandbox.writeFiles).toHaveBeenCalledOnce();
    const files = sandbox.writeFiles.mock.calls[0]?.[0] as Array<{ path: string }>;
    expect(files.map((file) => file.path)).toEqual(["job/cli.js", "job/input.md"]);
    expect(files.every((file) => !file.path.startsWith("/") && !file.path.includes(".."))).toBe(true);

    const command = commandParams[0] as { cmd: string; args: string[]; cwd: string; timeoutMs: number };
    expect(command.cmd).toBe("node");
    expect(command.cwd).toBe("/vercel/sandbox/job");
    expect(command.timeoutMs).toBe(20_000);
    expect(command.args).toContain("--deny-remote-network");
    expect(command.args).toContain("--resolution");
    expect(command.args[command.args.indexOf("--resolution") + 1]).toBe("720p");
    expect(command.args[command.args.indexOf("--times") + 1]).toBe("0,0.5,1");
    expect(command.args).not.toContain("input.md;rm -rf /");
    expect(sandbox.stop).toHaveBeenCalledOnce();
    expect(sandbox.delete).toHaveBeenCalledWith({ deleteOrphanSnapshots: true });
  });

  it("uses five inclusive default preview times", async () => {
    const payload = {
      duration: 2,
      width: 1280,
      height: 720,
      frames: [0, 0.5, 1, 1.5, 2].map((time) => ({ time, pngBase64: PNG_BASE64 })),
    };
    const { sandbox, commandParams } = makeSandbox({ stdout: JSON.stringify(payload) });
    const { dependencies } = makeDependencies(sandbox);

    await renderSandboxPreview({ markdown: MARKDOWN }, dependencies);
    const command = commandParams[0] as { args: string[] };
    expect(command.args[command.args.indexOf("--times") + 1]).toBe("0,0.5,1,1.5,2");
  });

  it("rejects malformed CLI preview JSON and still stops/deletes the fork", async () => {
    const { sandbox } = makeSandbox({ stdout: "not-json" });
    const { dependencies } = makeDependencies(sandbox);

    await expect(renderSandboxPreview({ markdown: MARKDOWN }, dependencies)).rejects.toThrow(
      /did not return preview JSON/
    );
    expect(sandbox.stop).toHaveBeenCalledOnce();
    expect(sandbox.delete).toHaveBeenCalledOnce();
  });

  it("caps and sanitizes stderr for CLI failures", async () => {
    const longSecretLookingNoise = `  line\u0007 with controls ${"x".repeat(2_000)}  `;
    const { sandbox } = makeSandbox({ exitCode: 2, stderr: longSecretLookingNoise });
    const { dependencies } = makeDependencies(sandbox);

    let error: unknown;
    await renderSandboxPreview({ markdown: MARKDOWN }, dependencies).catch((caught) => {
      error = caught;
    });
    expect(error).toBeInstanceOf(RenderSandboxRequestError);
    const message = (error as Error).message;
    expect(message).toContain("exited with code 2");
    expect(message).not.toContain("\u0007");
    expect(message.length).toBeLessThan(1_200);
    expect(sandbox.delete).toHaveBeenCalledOnce();
  });

  it("rejects over-duration input before creating a fork", async () => {
    const { sandbox } = makeSandbox();
    const { fork, dependencies } = makeDependencies(sandbox);
    const longMarkdown = Array.from({ length: 8 }, () => "!scene\n!duration 4\n!text\nHi").join("\n");

    await expect(renderSandboxPreview({ markdown: longMarkdown }, dependencies)).rejects.toThrow(
      /exceeds the 30s render cap/
    );
    expect(fork).not.toHaveBeenCalled();
  });
});

describe("renderSandboxVideo", () => {
  it("renders with worker-compatible defaults and returns mp4 metadata", async () => {
    const { sandbox, commandParams } = makeSandbox();
    const { dependencies } = makeDependencies(sandbox);

    const result = await renderSandboxVideo({ markdown: MARKDOWN }, dependencies);

    const command = commandParams[0] as { args: string[]; timeoutMs: number };
    for (const [flag, value] of [
      ["--resolution", "720p"],
      ["--quality", "medium"],
      ["--speed", "fast"],
      ["--fps", "24"],
    ] as const) {
      expect(command.args[command.args.indexOf(flag) + 1]).toBe(value);
    }
    expect(command.args).toContain("--deny-remote-network");
    expect(command.timeoutMs).toBe(45_000);
    expect(result).toMatchObject({
      duration: 2,
      width: 1280,
      height: 720,
      fps: 24,
      totalFrames: 48,
      sizeBytes: MP4.byteLength,
    });
    expect(result.mp4.equals(MP4)).toBe(true);
    expect(sandbox.readFileToBuffer).toHaveBeenCalledWith(
      { path: "output.mp4", cwd: "/vercel/sandbox/job" },
      expect.objectContaining({})
    );
    expect(sandbox.stop).toHaveBeenCalledOnce();
    expect(sandbox.delete).toHaveBeenCalledOnce();
  });

  it("passes explicit render options through as CLI arguments", async () => {
    const { sandbox, commandParams } = makeSandbox();
    const { dependencies } = makeDependencies(sandbox);

    await renderSandboxVideo(
      {
        markdown: MARKDOWN,
        options: {
          resolution: "1080p",
          quality: "high",
          speed: "balanced",
          fps: 30,
          aspectRatio: "9:16",
          locale: "pt-BR",
        },
      },
      dependencies
    );
    const command = commandParams[0] as { args: string[] };
    for (const [flag, value] of [
      ["--resolution", "1080p"],
      ["--quality", "high"],
      ["--speed", "balanced"],
      ["--fps", "30"],
      ["--aspect-ratio", "9:16"],
      ["--locale", "pt-BR"],
    ] as const) {
      expect(command.args[command.args.indexOf(flag) + 1]).toBe(value);
    }
  });

  it("rejects malformed or oversized mp4 output", async () => {
    const malformed = makeSandbox({ mp4: Buffer.from("not an mp4") });
    const malformedDeps = makeDependencies(malformed.sandbox).dependencies;
    await expect(renderSandboxVideo({ markdown: MARKDOWN }, malformedDeps)).rejects.toThrow(
      /malformed mp4/
    );
    expect(malformed.sandbox.delete).toHaveBeenCalledOnce();

    const oversized = makeSandbox({ mp4: Buffer.concat([MP4, Buffer.alloc(6 * 1024 * 1024)]) });
    const oversizedDeps = makeDependencies(oversized.sandbox).dependencies;
    await expect(renderSandboxVideo({ markdown: MARKDOWN }, oversizedDeps)).rejects.toThrow(
      /exceeding the/
    );
    expect(oversized.sandbox.delete).toHaveBeenCalledOnce();
  });
});
