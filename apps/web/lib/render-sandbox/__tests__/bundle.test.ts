import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadSandboxCliBundle, RenderSandboxBundleError } from "../bundle";

let temporaryDirs: string[] = [];

async function makeBundleFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "mdv-bundle-test-"));
  temporaryDirs.push(root);
  await mkdir(path.join(root, "render-page"), { recursive: true });
  await mkdir(path.join(root, "node_modules", "playwright-core", "lib"), { recursive: true });
  await writeFile(path.join(root, "cli.js"), "cli");
  await writeFile(path.join(root, "package.json"), "{}");
  await writeFile(path.join(root, "manifest.json"), "{}");
  await writeFile(path.join(root, "render-page", "index.html"), "html");
  await writeFile(path.join(root, "node_modules", "playwright-core", "package.json"), "{}");
  await writeFile(path.join(root, "node_modules", "playwright-core", "lib", "coreBundle.js"), "core");
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirs = [];
});

describe("loadSandboxCliBundle", () => {
  it("loads a complete bundle recursively with job-relative portable paths", async () => {
    const root = await makeBundleFixture();
    await mkdir(path.join(root, "render-page", "fonts"), { recursive: true });
    await writeFile(path.join(root, "render-page", "fonts", "font.woff2"), "font");

    const files = await loadSandboxCliBundle(root);
    const paths = files.map((file) => file.path);
    expect(paths).toContain("job/cli.js");
    expect(paths).toContain("job/render-page/fonts/font.woff2");
    expect(paths).toContain("job/node_modules/playwright-core/lib/coreBundle.js");
    expect(paths.every((filePath) => !filePath.startsWith("/") && !filePath.includes("\\"))).toBe(true);
    expect(files.find((file) => file.path === "job/cli.js")?.content).toEqual(
      new Uint8Array(Buffer.from("cli"))
    );
  });

  it("fails closed with a clear error when required runtime files are missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mdv-incomplete-bundle-test-"));
    temporaryDirs.push(root);
    await expect(loadSandboxCliBundle(root)).rejects.toThrow(RenderSandboxBundleError);
    await expect(loadSandboxCliBundle(root)).rejects.toThrow(/incomplete/);
  });

  it("rejects symlinks rather than silently transporting ambiguous files", async () => {
    const root = await makeBundleFixture();
    await symlink(path.join(root, "cli.js"), path.join(root, "linked.js"));
    await expect(loadSandboxCliBundle(root)).rejects.toThrow(/symlink/);
  });
});
