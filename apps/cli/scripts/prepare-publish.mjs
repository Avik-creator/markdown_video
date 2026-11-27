import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(cliDir, "../..")
const distDir = path.join(cliDir, "dist")
const outputDir = path.resolve(cliDir, process.argv[2] ?? ".npm-publish")

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}

async function requireFile(filePath, remediation) {
  const stats = await stat(filePath).catch(() => null)
  if (!stats?.isFile()) {
    throw new Error(`${filePath} is missing. ${remediation}`)
  }
}

async function listFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath))
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }
  return files
}

async function validateDist() {
  await requireFile(
    path.join(distDir, "cli.js"),
    "Run `pnpm --filter markdown-video... build` first.",
  )
  await requireFile(
    path.join(distDir, "index.js"),
    "Run `pnpm --filter markdown-video... build` first.",
  )
  await requireFile(
    path.join(distDir, "index.d.ts"),
    "Run `pnpm --filter markdown-video... build` first.",
  )
  await requireFile(
    path.join(distDir, "render-page", "index.html"),
    "The embedded render-page payload is missing; rebuild the CLI.",
  )
  await requireFile(
    path.join(distDir, "render-page", "font-provenance.json"),
    "The embedded font provenance metadata is missing; rebuild the CLI.",
  )
  await requireFile(
    path.join(distDir, "render-page", "OFL-1.1.txt"),
    "The embedded font license is missing; rebuild the CLI.",
  )

  const cli = await readFile(path.join(distDir, "cli.js"), "utf8")
  if (!cli.startsWith("#!/usr/bin/env node\n")) {
    throw new Error("dist/cli.js does not start with the required node shebang.")
  }

  const files = await listFiles(distDir)
  const fontCount = files.filter((file) => file.endsWith(".woff2")).length
  if (fontCount !== 80) {
    throw new Error(`dist contains ${fontCount} WOFF2 files; expected exactly 80.`)
  }

  for (const file of files.filter((file) => file.endsWith(".js") || file.endsWith(".d.ts"))) {
    const contents = await readFile(file, "utf8")
    if (/(?:from\s*|import\s*|require\()\s*["']@markdown-video\//.test(contents)) {
      throw new Error(`${path.relative(distDir, file)} still imports an unpublished workspace package.`)
    }
  }

  const declarations = await readFile(path.join(distDir, "index.d.ts"), "utf8")
  if (/^(?:import|export)\b[^\n]*\bfrom\s*["']/m.test(declarations)) {
    throw new Error("dist/index.d.ts is not self-contained; inspect the tsup declaration bundling configuration.")
  }

  return { files, fontCount }
}

function publishManifest(source) {
  const manifest = { ...source }
  delete manifest.private
  delete manifest.devDependencies
  delete manifest.scripts

  const serialized = JSON.stringify(manifest)
  if (serialized.includes("workspace:")) {
    throw new Error("Publish manifest still contains a workspace: protocol specifier.")
  }
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    if (name.startsWith("@markdown-video/")) {
      throw new Error(`Publish manifest still depends on private workspace package ${name}.`)
    }
  }
  if (!manifest.dependencies?.["playwright-core"]) {
    throw new Error("Publish manifest must retain the playwright-core runtime dependency.")
  }
  if (manifest.publishConfig?.access !== "public") {
    throw new Error("publishConfig.access must be public.")
  }
  return manifest
}

async function main() {
  if (outputDir === cliDir || outputDir === repoRoot || isInside(outputDir, distDir) || isInside(distDir, outputDir)) {
    throw new Error(`Refusing to use publish staging directory ${outputDir}; choose a directory outside dist/.`)
  }

  const { fontCount } = await validateDist()
  const sourceManifest = JSON.parse(await readFile(path.join(cliDir, "package.json"), "utf8"))
  const manifest = publishManifest(sourceManifest)

  await rm(outputDir, { recursive: true, force: true })
  await mkdir(outputDir, { recursive: true })
  await cp(distDir, path.join(outputDir, "dist"), { recursive: true })
  await cp(path.join(cliDir, "README.md"), path.join(outputDir, "README.md"))
  await cp(path.join(repoRoot, "LICENSE"), path.join(outputDir, "LICENSE"))
  await writeFile(
    path.join(outputDir, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )

  const stagedFiles = await listFiles(outputDir)
  let byteCount = 0
  for (const file of stagedFiles) {
    byteCount += (await stat(file)).size
  }
  console.log(
    `Staged npm artifact at ${outputDir} (${stagedFiles.length} files, ${byteCount} bytes, ${fontCount} verified embedded fonts).`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
