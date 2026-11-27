import { createHash } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

export interface RenderPageAssetInspection {
  ok: boolean
  rootDir: string
  indexHtmlPresent: boolean
  assetDirectoryPresent: boolean
  cssFileCount: number
  jsFileCount: number
  fontReferenceCount: number
  fontFileCount: number
  missingFontReferences: string[]
  unreferencedFontFiles: string[]
  provenanceFontCount?: number | undefined
  hashVerification: "verified" | "unavailable" | "failed"
  problems: string[]
}

interface FontProvenanceFile {
  families?: Array<{
    files?: Array<{ sha256?: unknown; file?: unknown }>
  }>
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

async function listFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true })
  const files: string[] = []
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

function isInside(rootDir: string, candidate: string) {
  const relative = path.relative(rootDir, candidate)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function fontReferencesFromCss(css: string) {
  const references: string[] = []
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g)) {
    if (match[1]) references.push(match[1])
  }
  return references
}

function hashCounts(hashes: string[]) {
  const counts = new Map<string, number>()
  for (const hash of hashes) {
    counts.set(hash, (counts.get(hash) ?? 0) + 1)
  }
  return counts
}

export function compareSha256Multisets(actualHashes: string[], expectedHashes: string[]) {
  const actual = hashCounts(actualHashes)
  const expected = hashCounts(expectedHashes)
  const problems: string[] = []

  for (const [hash, expectedCount] of expected) {
    const actualCount = actual.get(hash) ?? 0
    if (actualCount !== expectedCount) {
      problems.push(
        `SHA-256 ${hash} appears ${actualCount} time(s) in bundled fonts but ${expectedCount} time(s) in provenance`,
      )
    }
  }
  for (const [hash, actualCount] of actual) {
    if (!expected.has(hash)) {
      problems.push(`SHA-256 ${hash} appears ${actualCount} time(s) in bundled fonts but is absent from provenance`)
    }
  }
  return problems
}

function provenanceHashes(provenance: FontProvenanceFile) {
  const hashes: string[] = []
  for (const family of provenance.families ?? []) {
    for (const file of family.files ?? []) {
      if (typeof file.sha256 === "string") hashes.push(file.sha256)
    }
  }
  return hashes
}

/**
 * Inspect the immutable render-page payload. Besides checking that every CSS
 * font URL resolves, this compares the complete bundled WOFF2 SHA-256 multiset
 * with the provenance metadata copied into the package at build time. That
 * catches truncated tarballs, corrupt extraction, and accidental font loss even
 * though Vite rewrites font filenames with its own shorter content hashes.
 */
export async function inspectRenderPageAssets(rootDir: string): Promise<RenderPageAssetInspection> {
  const problems: string[] = []
  const missingFontReferences: string[] = []
  const unreferencedFontFiles: string[] = []
  const indexHtmlPresent = (await stat(path.join(rootDir, "index.html")).catch(() => null))?.isFile() === true
  if (!indexHtmlPresent) problems.push("index.html is missing")

  const assetsDir = path.join(rootDir, "assets")
  const assetDirectoryPresent = (await stat(assetsDir).catch(() => null))?.isDirectory() === true
  if (!assetDirectoryPresent) problems.push("assets directory is missing")

  let assetFiles: string[] = []
  if (assetDirectoryPresent) {
    assetFiles = await listFiles(assetsDir)
  }
  const cssFiles = assetFiles.filter((file) => file.endsWith(".css"))
  const jsFiles = assetFiles.filter((file) => file.endsWith(".js"))
  const fontFiles = assetFiles.filter((file) => file.endsWith(".woff2"))
  if (cssFiles.length === 0) problems.push("no CSS asset is present")
  if (jsFiles.length === 0) problems.push("no JavaScript asset is present")

  const referencedFontPaths = new Map<string, string>()
  for (const cssFile of cssFiles) {
    const css = await readFile(cssFile, "utf8")
    for (const reference of fontReferencesFromCss(css)) {
      try {
        const resolved = path.resolve(path.dirname(cssFile), decodeURIComponent(reference))
        if (!isInside(assetsDir, resolved)) {
          problems.push(`font reference escapes the asset directory: ${reference}`)
          continue
        }
        referencedFontPaths.set(resolved, reference)
      } catch {
        problems.push(`font reference is not valid URI text: ${reference}`)
      }
    }
  }
  if (referencedFontPaths.size === 0) problems.push("CSS does not reference any bundled WOFF2 fonts")

  const existingFontFiles = new Set(fontFiles)
  for (const [fontPath, reference] of referencedFontPaths) {
    if (!existingFontFiles.has(fontPath)) {
      missingFontReferences.push(reference)
    }
  }
  for (const fontFile of fontFiles) {
    if (!referencedFontPaths.has(fontFile)) {
      unreferencedFontFiles.push(path.basename(fontFile))
    }
  }
  if (missingFontReferences.length > 0) {
    problems.push(`${missingFontReferences.length} CSS-referenced font file(s) are missing`)
  }
  if (unreferencedFontFiles.length > 0) {
    problems.push(`${unreferencedFontFiles.length} bundled font file(s) are not referenced by CSS`)
  }

  const actualHashes: string[] = []
  for (const fontFile of fontFiles) {
    actualHashes.push(sha256(await readFile(fontFile)))
  }

  let hashVerification: RenderPageAssetInspection["hashVerification"] = "unavailable"
  let provenanceFontCount: number | undefined
  const provenancePath = path.join(rootDir, "font-provenance.json")
  if ((await stat(provenancePath).catch(() => null))?.isFile()) {
    try {
      const provenance = JSON.parse(await readFile(provenancePath, "utf8")) as FontProvenanceFile
      const expectedHashes = provenanceHashes(provenance)
      provenanceFontCount = expectedHashes.length
      const hashProblems = compareSha256Multisets(actualHashes, expectedHashes)
      if (hashProblems.length === 0) {
        hashVerification = "verified"
      } else {
        hashVerification = "failed"
        problems.push(...hashProblems.slice(0, 4))
        if (hashProblems.length > 4) {
          problems.push(`${hashProblems.length - 4} additional font hash mismatch(es) omitted`)
        }
      }
    } catch (error) {
      hashVerification = "failed"
      problems.push(
        `font provenance metadata is invalid: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  } else {
    problems.push("font provenance metadata is missing")
  }

  if (problems.length > 0) {
    return {
      ok: false,
      rootDir,
      indexHtmlPresent,
      assetDirectoryPresent,
      cssFileCount: cssFiles.length,
      jsFileCount: jsFiles.length,
      fontReferenceCount: referencedFontPaths.size,
      fontFileCount: fontFiles.length,
      missingFontReferences,
      unreferencedFontFiles,
      ...(provenanceFontCount !== undefined ? { provenanceFontCount } : {}),
      hashVerification,
      problems,
    }
  }

  return {
    ok: true,
    rootDir,
    indexHtmlPresent,
    assetDirectoryPresent,
    cssFileCount: cssFiles.length,
    jsFileCount: jsFiles.length,
    fontReferenceCount: referencedFontPaths.size,
    fontFileCount: fontFiles.length,
    missingFontReferences,
    unreferencedFontFiles,
    ...(provenanceFontCount !== undefined ? { provenanceFontCount } : {}),
    hashVerification,
    problems,
  }
}
