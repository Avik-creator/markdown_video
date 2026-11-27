import { createHash } from "node:crypto"
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const EXPECTED_FONT_FACE_COUNT = 80
const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function hashMultiset(entries) {
  const counts = new Map()
  for (const [hash, file] of entries) {
    const existing = counts.get(hash) ?? { count: 0, files: [] }
    existing.count += 1
    existing.files.push(file)
    counts.set(hash, existing)
  }
  return counts
}

function compareHashMultisets(actualEntries, expectedEntries) {
  const actual = hashMultiset(actualEntries)
  const expected = hashMultiset(expectedEntries)
  const problems = []

  for (const [hash, expectedRecord] of expected) {
    const actualCount = actual.get(hash)?.count ?? 0
    if (actualCount !== expectedRecord.count) {
      problems.push(
        `hash ${hash} appears ${actualCount} time(s) in the Vite output but ${expectedRecord.count} time(s) in font provenance`,
      )
    }
  }
  for (const [hash, actualRecord] of actual) {
    if (!expected.has(hash)) {
      problems.push(
        `Vite output file(s) ${actualRecord.files.join(", ")} have unprovenanced SHA-256 ${hash}`,
      )
    }
  }
  return problems
}

function fontReferencesFromCss(css) {
  const references = []
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g)) {
    references.push(match[1])
  }
  return references
}

async function readProvenance(renderPackageDir) {
  const provenancePath = path.join(renderPackageDir, "src", "fonts", "provenance.json")
  const provenance = JSON.parse(await readFile(provenancePath, "utf8"))
  const expected = []
  for (const family of provenance.families ?? []) {
    for (const file of family.files ?? []) {
      if (typeof file.sha256 === "string" && typeof file.file === "string") {
        expected.push([file.sha256, file.file])
      }
    }
  }
  if (expected.length !== EXPECTED_FONT_FACE_COUNT) {
    throw new Error(
      `Font provenance contains ${expected.length} files; expected ${EXPECTED_FONT_FACE_COUNT}.`,
    )
  }
  return { expected, provenancePath }
}

async function verifyBuiltFonts(renderDist, renderPackageDir) {
  const assetsDir = path.join(renderDist, "assets")
  const assetEntries = await readdir(assetsDir, { withFileTypes: true })
  const cssFiles = assetEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .map((entry) => path.join(assetsDir, entry.name))
  if (cssFiles.length === 0) {
    throw new Error(`No CSS asset found in ${assetsDir}.`)
  }

  const referencedFiles = new Set()
  for (const cssFile of cssFiles) {
    const css = await readFile(cssFile, "utf8")
    for (const reference of fontReferencesFromCss(css)) {
      const decoded = decodeURIComponent(reference)
      const resolved = path.resolve(path.dirname(cssFile), decoded)
      if (!resolved.startsWith(`${assetsDir}${path.sep}`)) {
        throw new Error(`Font reference escapes the asset directory: ${reference}`)
      }
      referencedFiles.add(resolved)
    }
  }

  if (referencedFiles.size !== EXPECTED_FONT_FACE_COUNT) {
    throw new Error(
      `Render-page CSS references ${referencedFiles.size} font files; expected ${EXPECTED_FONT_FACE_COUNT}.`,
    )
  }

  const actual = []
  for (const fontPath of [...referencedFiles].sort()) {
    const contents = await readFile(fontPath)
    actual.push([sha256(contents), path.basename(fontPath)])
  }

  const { expected } = await readProvenance(renderPackageDir)
  const problems = compareHashMultisets(actual, expected)
  if (problems.length > 0) {
    throw new Error(`Built font assets do not match SHA-256 provenance:\n- ${problems.join("\n- ")}`)
  }

  return actual.length
}

async function main() {
  const renderPackageJson = require.resolve("@markdown-video/render-page/package.json")
  const renderPackageDir = path.dirname(renderPackageJson)
  const renderDist = path.join(renderPackageDir, "dist")
  const indexHtml = path.join(renderDist, "index.html")
  if (!(await stat(indexHtml).catch(() => null))?.isFile()) {
    throw new Error(
      `Render-page build is missing at ${renderDist}. Run: pnpm --filter @markdown-video/render-page build`,
    )
  }

  const fontCount = await verifyBuiltFonts(renderDist, renderPackageDir)
  const destination = path.join(cliDir, "dist", "render-page")
  await rm(destination, { recursive: true, force: true })
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(renderDist, destination, { recursive: true })
  await writeFile(
    path.join(destination, "font-provenance.json"),
    await readFile(path.join(renderPackageDir, "src", "fonts", "provenance.json")),
  )
  await writeFile(
    path.join(destination, "OFL-1.1.txt"),
    await readFile(path.join(renderPackageDir, "src", "fonts", "OFL-1.1.txt")),
  )
  console.log(
    `Embedded render page with ${fontCount} SHA-256-verified font files in ${path.relative(cliDir, destination)}.`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
