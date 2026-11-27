import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class RenderSandboxBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderSandboxBundleError";
  }
}

export interface SandboxBundleFile {
  path: string;
  content: Uint8Array;
}

const BUNDLE_RELATIVE_PATH = path.join("lib", "render-sandbox", "cli-bundle");
const MAX_BUNDLE_BYTES = 24 * 1024 * 1024;

function moduleDirectory() {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }
}

export function sandboxBundleDirectoryCandidates(cwd = process.cwd()) {
  const candidates = [
    path.join(cwd, BUNDLE_RELATIVE_PATH),
    path.join(cwd, "apps", "web", BUNDLE_RELATIVE_PATH),
  ];
  const moduleDir = moduleDirectory();
  if (moduleDir) {
    // Source layout: apps/web/lib/render-sandbox/bundle.ts. This path is a
    // development fallback; production tracing is rooted at process.cwd().
    candidates.push(path.join(moduleDir, "cli-bundle"));
  }
  return [...new Set(candidates)];
}

async function existingBundleDirectory(cwd = process.cwd()) {
  const candidates = sandboxBundleDirectoryCandidates(cwd);
  for (const candidate of candidates) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isDirectory()) return candidate;
  }
  throw new RenderSandboxBundleError(
    "The Vercel Sandbox CLI bundle is missing. Run `pnpm --filter @markdown-video/web stage:render-sandbox-cli` before starting or building apps/web."
  );
}

async function validateBundleLayout(bundleDir: string) {
  const required = [
    "cli.js",
    "package.json",
    "manifest.json",
    path.join("render-page", "index.html"),
    path.join("node_modules", "playwright-core", "package.json"),
    path.join("node_modules", "playwright-core", "lib", "coreBundle.js"),
  ];
  for (const relative of required) {
    const info = await stat(path.join(bundleDir, relative)).catch(() => null);
    if (!info?.isFile()) {
      throw new RenderSandboxBundleError(
        `The Vercel Sandbox CLI bundle at ${bundleDir} is incomplete (missing ${relative}). Regenerate it with the stage:render-sandbox-cli script.`
      );
    }
  }
}

async function collectFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, absolute)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolute).split(path.sep).join("/"));
    } else if (entry.isSymbolicLink()) {
      throw new RenderSandboxBundleError(
        `The Vercel Sandbox CLI bundle contains an unsupported symlink: ${absolute}`
      );
    }
  }
  return files;
}

export async function loadSandboxCliBundle(
  explicitBundleDir?: string
): Promise<SandboxBundleFile[]> {
  const bundleDir = explicitBundleDir ?? (await existingBundleDirectory());
  await validateBundleLayout(bundleDir);
  const relativePaths = (await collectFiles(bundleDir)).sort();
  const files: SandboxBundleFile[] = [];
  let totalBytes = 0;

  for (const relativePath of relativePaths) {
    const content = new Uint8Array(await readFile(path.join(bundleDir, relativePath)));
    totalBytes += content.byteLength;
    if (totalBytes > MAX_BUNDLE_BYTES) {
      throw new RenderSandboxBundleError(
        `The Vercel Sandbox CLI bundle exceeds the ${MAX_BUNDLE_BYTES}-byte transport cap.`
      );
    }
    files.push({ path: `job/${relativePath}`, content });
  }
  return files;
}

let bundlePromise: Promise<SandboxBundleFile[]> | null = null;

export function getSandboxCliBundle() {
  bundlePromise ??= loadSandboxCliBundle().catch((error) => {
    bundlePromise = null;
    throw error;
  });
  return bundlePromise;
}
