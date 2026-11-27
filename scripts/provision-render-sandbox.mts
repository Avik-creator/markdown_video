#!/usr/bin/env node
/**
 * Provision the persistent Vercel Sandbox template used by apps/web's sandbox
 * render backend. Run from the repository root:
 *
 *   node scripts/provision-render-sandbox.mts
 *
 * Authentication is either VERCEL_OIDC_TOKEN or the explicit triple
 * VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID. The script deliberately
 * fails before invoking the SDK when neither form is present so local runs do
 * not unexpectedly enter an interactive device-authorization flow.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRequire = createRequire(path.join(repoRoot, "apps", "web", "package.json"));
const { Sandbox } = webRequire("@vercel/sandbox");
const { loadSandboxCliBundle } = await import(
  new URL("../apps/web/lib/render-sandbox/bundle.ts", import.meta.url).href
);

const TEMPLATE_NAME = process.env.MDV_RENDER_SANDBOX_TEMPLATE?.trim() || "mdv-render-template";
const JOB_DIR = "/vercel/sandbox/job";
const PLAYWRIGHT_BROWSERS_PATH = "/vercel/sandbox/ms-playwright";
// Hobby sandboxes cap at 45 minutes; keep the template valid on every plan.
const TEMPLATE_TIMEOUT_MS = 45 * 60 * 1000;
const smokeMarkdown = `!scene
!duration 1
!text
Sandbox smoke test
`;

function credentials() {
  if (process.env.VERCEL_OIDC_TOKEN) return {};
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token && teamId && projectId) return { token, teamId, projectId };
  throw new Error(
    "Missing Vercel Sandbox credentials. Set VERCEL_OIDC_TOKEN, or set VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID. The script will not start an interactive login flow."
  );
}

function redactCommandValue(value) {
  return value.length > 160 ? `${value.slice(0, 160)}…` : value;
}

async function run(sandbox, cmd, args, options = {}) {
  const printable = [cmd, ...args].map(redactCommandValue).join(" ");
  console.log(`\n$ ${printable}`);
  const result = await sandbox.runCommand({
    cmd,
    args,
    cwd: options.cwd,
    sudo: options.sudo === true,
    env: options.env,
    timeoutMs: options.timeoutMs ?? 5 * 60 * 1000,
    stdout: process.stdout,
    stderr: process.stderr,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Command failed with exit code ${result.exitCode}: ${printable}`);
  }
}

async function runCapture(sandbox, cmd, args, options = {}) {
  const printable = [cmd, ...args].map(redactCommandValue).join(" ");
  console.log(`\n$ ${printable}`);
  const result = await sandbox.runCommand({
    cmd,
    args,
    cwd: options.cwd,
    sudo: options.sudo === true,
    env: options.env,
    timeoutMs: options.timeoutMs ?? 5 * 60 * 1000,
  });
  const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()]);
  if (options.printOutput !== false) {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  }
  if (result.exitCode !== 0) {
    throw new Error(`Command failed with exit code ${result.exitCode}: ${printable}`);
  }
  return { stdout, stderr };
}

function assertMp4(buffer) {
  if (!buffer || buffer.byteLength < 12 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") {
    throw new Error("Smoke render did not produce a valid MP4 file in the sandbox.");
  }
}

async function provision(sandbox) {
  console.log("Staging the current CLI bundle locally…");
  const staged = spawnSync(
    process.execPath,
    [path.join(repoRoot, "apps", "web", "scripts", "stage-render-sandbox-cli.mjs")],
    { cwd: repoRoot, stdio: "inherit", env: process.env }
  );
  if (staged.status !== 0) {
    throw new Error("Could not stage the CLI bundle. Build the workspace first with `pnpm build`.");
  }

  const bundle = await loadSandboxCliBundle(
    path.join(repoRoot, "apps", "web", "lib", "render-sandbox", "cli-bundle")
  );
  console.log(`Uploading ${bundle.length} CLI bundle files plus the smoke-test markdown…`);
  await sandbox.writeFiles([
    ...bundle,
    { path: "job/smoke.md", content: smokeMarkdown },
  ]);

  await sandbox.update({
    persistent: true,
    timeout: TEMPLATE_TIMEOUT_MS,
    networkPolicy: "allow-all",
    env: {
      PLAYWRIGHT_BROWSERS_PATH,
    },
    snapshotExpiration: 0,
    keepLastSnapshots: {
      count: 1,
      expiration: 0,
      deleteEvicted: true,
    },
  });

  const runtimeEnv = {
    PLAYWRIGHT_BROWSERS_PATH,
    PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    HOME: JOB_DIR,
    XDG_CACHE_HOME: `${JOB_DIR}/.cache`,
  };
  await run(sandbox, "apt-get", ["update"], {
    sudo: true,
    timeoutMs: 8 * 60 * 1000,
  });
  await run(sandbox, "apt-get", ["install", "-y", "--no-install-recommends", "ffmpeg"], {
    sudo: true,
    timeoutMs: 8 * 60 * 1000,
  });
  await run(sandbox, "node", ["cli.js", "install-browser"], {
    cwd: JOB_DIR,
    env: runtimeEnv,
    timeoutMs: 10 * 60 * 1000,
  });
  await run(sandbox, "node", ["node_modules/playwright-core/cli.js", "install-deps", "chromium"], {
    cwd: JOB_DIR,
    sudo: true,
    timeoutMs: 10 * 60 * 1000,
  });

  console.log("\nRunning the doctor acceptance gate…");
  await runCapture(sandbox, "node", ["cli.js", "doctor"], {
    cwd: JOB_DIR,
    env: runtimeEnv,
    timeoutMs: 60 * 1000,
  });

  console.log("\nRunning exact-frame preview smoke test…");
  const preview = await runCapture(
    sandbox,
    "node",
    [
      "cli.js",
      "preview",
      "smoke.md",
      "--json",
      "--times",
      "0,0.5,1",
      "--resolution",
      "480p",
      "--deny-remote-network",
    ],
    { cwd: JOB_DIR, env: runtimeEnv, timeoutMs: 60 * 1000, printOutput: false }
  );
  if (!preview.stdout.trim().startsWith("{")) {
    throw new Error("Preview smoke test did not emit a JSON object on stdout.");
  }
  const previewJson = JSON.parse(preview.stdout);
  if (!Array.isArray(previewJson.frames) || previewJson.frames.length !== 3) {
    throw new Error("Preview smoke test did not return exactly three frames.");
  }

  console.log("\nRunning MP4 render smoke test…");
  await runCapture(
    sandbox,
    "node",
    [
      "cli.js",
      "render",
      "smoke.md",
      "--output",
      "smoke.mp4",
      "--overwrite",
      "--resolution",
      "480p",
      "--quality",
      "low",
      "--speed",
      "fastest",
      "--fps",
      "12",
      "--deny-remote-network",
    ],
    { cwd: JOB_DIR, env: runtimeEnv, timeoutMs: 90 * 1000 }
  );
  const mp4 = await sandbox.readFileToBuffer({ path: "smoke.mp4", cwd: JOB_DIR });
  assertMp4(mp4);
  console.log(`Smoke render produced a valid ${mp4.byteLength}-byte MP4.`);
}

async function main() {
  console.log(`Provisioning Vercel Sandbox template "${TEMPLATE_NAME}"…`);
  const sandbox = await Sandbox.getOrCreate({
    name: TEMPLATE_NAME,
    image: "vercel/sandbox/universal:latest",
    persistent: true,
    timeout: TEMPLATE_TIMEOUT_MS,
    resources: { vcpus: 2 },
    networkPolicy: "allow-all",
    env: {
      PLAYWRIGHT_BROWSERS_PATH,
    },
    snapshotExpiration: 0,
    keepLastSnapshots: {
      count: 1,
      expiration: 0,
      deleteEvicted: true,
    },
    tags: {
      purpose: "markdown-video-render",
    },
    ...credentials(),
  });

  let provisioned = false;
  try {
    await provision(sandbox);
    provisioned = true;
  } finally {
    if (provisioned) {
      console.log("\nStopping the persistent template so its provisioned filesystem is snapshotted…");
      const stopped = await sandbox.stop();
      console.log(
        `Template stopped.${stopped.snapshot?.id ? ` Snapshot: ${stopped.snapshot.id}` : " The API did not report a snapshot id; verify snapshot state before deploying."}`
      );
    } else {
      console.error(
        "\nProvisioning failed before the acceptance gate. The template sandbox was left to its normal timeout rather than snapshotting a known-good state. Re-run this script after fixing the failure."
      );
    }
  }
  console.log(`Vercel Sandbox template "${TEMPLATE_NAME}" is provisioned and ready for forks.`);
}

main().catch((error) => {
  console.error(`\nProvisioning failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
