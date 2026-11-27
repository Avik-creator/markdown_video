import { spawnSync } from "node:child_process"
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(webRoot, "../..")
const cliRoot = path.join(repoRoot, "apps", "cli")
const cliDist = path.join(cliRoot, "dist")
const bundleDir = path.join(webRoot, "lib", "render-sandbox", "cli-bundle")

async function requireFile(filePath, message) {
  const result = await stat(filePath).catch(() => null)
  if (!result?.isFile()) {
    throw new Error(message)
  }
}

function shouldCopyPlaywrightFile(source, playgroundRoot) {
  const relative = path.relative(playgroundRoot, source).split(path.sep).join("/")
  if (relative === "types" || relative.startsWith("types/")) return false
  if (relative === "lib/vite" || relative.startsWith("lib/vite/")) return false
  return true
}

async function copyFiltered(source, destination, root, filter) {
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination, {
    recursive: true,
    filter: (candidate) => filter(candidate, root),
  })
}

async function main() {
  await requireFile(
    path.join(cliDist, "cli.js"),
    `CLI build is missing at ${cliDist}. Run: pnpm --filter markdown-video... build`,
  )
  await requireFile(
    path.join(cliDist, "render-page", "index.html"),
    `Embedded render-page assets are missing at ${cliDist}. Run: pnpm --filter markdown-video... build`,
  )

  const cliRequire = createRequire(path.join(cliDist, "cli.js"))
  const playwrightPackageJsonPath = cliRequire.resolve("playwright-core/package.json")
  const playwrightRoot = path.dirname(playwrightPackageJsonPath)
  const playwrightPackageJson = JSON.parse(await readFile(playwrightPackageJsonPath, "utf8"))
  const cliPackageJson = JSON.parse(await readFile(path.join(cliRoot, "package.json"), "utf8"))

  await rm(bundleDir, { recursive: true, force: true })
  await mkdir(bundleDir, { recursive: true })

  const distEntries = await readdir(cliDist, { withFileTypes: true })
  const runtimeJs = distEntries
    .filter((entry) => entry.isFile() && /^(cli|chunk-.+)\.js$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
  if (!runtimeJs.includes("cli.js") || runtimeJs.length < 2) {
    throw new Error(`CLI runtime JavaScript is incomplete in ${cliDist}.`)
  }

  for (const file of runtimeJs) {
    await cp(path.join(cliDist, file), path.join(bundleDir, file))
  }
  await cp(path.join(cliRoot, "package.json"), path.join(bundleDir, "package.json"))
  await cp(
    path.join(cliDist, "render-page"),
    path.join(bundleDir, "render-page"),
    { recursive: true },
  )
  await mkdir(path.join(bundleDir, "node_modules"), { recursive: true })
  await copyFiltered(
    playwrightRoot,
    path.join(bundleDir, "node_modules", "playwright-core"),
    playwrightRoot,
    shouldCopyPlaywrightFile,
  )

  const manifest = {
    cliName: cliPackageJson.name,
    cliVersion: cliPackageJson.version,
    playwrightCoreVersion: playwrightPackageJson.version,
    layout: "flat-cli-bundle-v1",
    notes: "Generated at build time; do not edit or commit.",
  }
  await writeFile(
    path.join(bundleDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  )

  let fileCount = 0
  let byteCount = 0
  async function measure(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await measure(entryPath)
      } else if (entry.isFile()) {
        fileCount += 1
        byteCount += (await stat(entryPath)).size
      }
    }
  }
  const versionCheck = spawnSync(process.execPath, [path.join(bundleDir, "cli.js"), "--version"], {
    encoding: "utf8",
  })
  if (versionCheck.status !== 0 || !versionCheck.stdout.trim()) {
    throw new Error(
      `Staged CLI bundle failed its --version smoke check: ${versionCheck.stderr || versionCheck.stdout || "no output"}`,
    )
  }

  await measure(bundleDir)
  console.log(
    `Staged markdown-video sandbox CLI bundle: ${fileCount} files, ${(byteCount / 1024 / 1024).toFixed(1)} MiB (playwright-core ${playwrightPackageJson.version}).`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
