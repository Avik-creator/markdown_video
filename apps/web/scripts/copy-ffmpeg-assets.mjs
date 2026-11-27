import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(appRoot, "public", "ffmpeg");

async function readPackageVersion(packageDirectory) {
  const packageJson = JSON.parse(
    await readFile(path.join(packageDirectory, "package.json"), "utf8"),
  );
  return packageJson.version;
}

async function copyAssets() {
  const ffmpegPackage = path.join(appRoot, "node_modules", "@ffmpeg", "ffmpeg");
  const corePackage = path.join(appRoot, "node_modules", "@ffmpeg", "core");
  const [ffmpegVersion, coreVersion] = await Promise.all([
    readPackageVersion(ffmpegPackage),
    readPackageVersion(corePackage),
  ]);

  if (ffmpegVersion !== "0.12.15" || coreVersion !== "0.12.10") {
    throw new Error(
      `Unexpected ffmpeg asset versions (control ${ffmpegVersion}, core ${coreVersion}); audit the new assets before updating this script`,
    );
  }

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(path.join(outputRoot, "control"), { recursive: true });
  await mkdir(path.join(outputRoot, "worker"), { recursive: true });
  await mkdir(path.join(outputRoot, "core"), { recursive: true });

  const copies = [
    [
      path.join(ffmpegPackage, "dist", "umd", "ffmpeg.js"),
      path.join(outputRoot, "control", "ffmpeg.js"),
    ],
    // Deliberately do not copy the UMD worker chunk (814.ffmpeg.js). We always
    // pass the audited module worker explicitly; omitting the unused classic
    // fallback makes a future caller failure local instead of silently
    // falling back to a worker whose embedded default core URL is a CDN.
    [
      path.join(corePackage, "dist", "esm", "ffmpeg-core.js"),
      path.join(outputRoot, "core", "ffmpeg-core.js"),
    ],
    [
      path.join(corePackage, "dist", "esm", "ffmpeg-core.wasm"),
      path.join(outputRoot, "core", "ffmpeg-core.wasm"),
    ],
  ];

  // worker.js imports only const.js and errors.js as sibling ES modules.
  for (const moduleName of ["const.js", "errors.js", "worker.js"]) {
    copies.push([
      path.join(ffmpegPackage, "dist", "esm", moduleName),
      path.join(outputRoot, "worker", moduleName),
    ]);
  }

  await Promise.all(copies.map(([source, destination]) => copyFile(source, destination)));

  // The upstream default core URL is only a fallback because the application
  // always passes an explicit same-origin coreURL. Rewrite it anyway so even
  // a future caller regression fails closed or stays same-origin rather than
  // silently reintroducing a CDN dependency inside the worker.
  const workerConstPath = path.join(outputRoot, "worker", "const.js");
  const workerConst = await readFile(workerConstPath, "utf8");
  const cdnCoreUrlLine =
    'export const CORE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.js`;';
  if (!workerConst.includes(cdnCoreUrlLine)) {
    throw new Error("Could not neutralize the ffmpeg worker CDN fallback");
  }
  await writeFile(
    workerConstPath,
    workerConst.replace(
      cdnCoreUrlLine,
      'export const CORE_URL = "/ffmpeg/core/ffmpeg-core.js";',
    ),
  );
}

copyAssets().catch((error) => {
  console.error("Failed to copy ffmpeg browser assets:", error);
  process.exitCode = 1;
});
