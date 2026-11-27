import { createHash } from "node:crypto"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  compareSha256Multisets,
  inspectRenderPageAssets,
} from "./render-assets.js"

let tempDir: string | null = null

async function fixture({
  css = "@font-face{src:url(./font-a.woff2) format(\"woff2\")}",
  fontFiles = { "font-a.woff2": Buffer.from("font-a") },
  provenanceHashes,
}: {
  css?: string
  fontFiles?: Record<string, Buffer>
  provenanceHashes?: string[]
} = {}) {
  tempDir = await mkdtemp(path.join(tmpdir(), "mv-render-assets-"))
  await mkdir(path.join(tempDir, "assets"), { recursive: true })
  await writeFile(path.join(tempDir, "index.html"), "<html></html>")
  await writeFile(path.join(tempDir, "assets", "index.js"), "console.log('render')")
  await writeFile(path.join(tempDir, "assets", "index.css"), css)
  for (const [name, contents] of Object.entries(fontFiles)) {
    await writeFile(path.join(tempDir, "assets", name), contents)
  }
  if (provenanceHashes) {
    await writeFile(
      path.join(tempDir, "font-provenance.json"),
      JSON.stringify({
        families: [
          {
            files: provenanceHashes.map((hash, index) => ({
              sha256: hash,
              file: `./font-${index}.woff2`,
            })),
          },
        ],
      }),
    )
  }
  return tempDir
}

function hash(text: string) {
  return createHash("sha256").update(text).digest("hex")
}

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true })
  tempDir = null
})

describe("inspectRenderPageAssets", () => {
  it("verifies resolvable CSS font references against SHA-256 provenance", async () => {
    const root = await fixture({ provenanceHashes: [hash("font-a")] })
    const inspection = await inspectRenderPageAssets(root)

    expect(inspection.ok).toBe(true)
    expect(inspection.hashVerification).toBe("verified")
    expect(inspection.fontReferenceCount).toBe(1)
    expect(inspection.fontFileCount).toBe(1)
    expect(inspection.provenanceFontCount).toBe(1)
    expect(inspection.problems).toEqual([])
  })

  it("fails when a CSS-referenced font is missing", async () => {
    const root = await fixture({
      fontFiles: {},
      provenanceHashes: [],
    })
    const inspection = await inspectRenderPageAssets(root)

    expect(inspection.ok).toBe(false)
    expect(inspection.missingFontReferences).toEqual(["./font-a.woff2"])
    expect(inspection.problems.join("\n")).toContain("missing")
  })

  it("fails when a bundled font hash is absent from provenance", async () => {
    const root = await fixture({ provenanceHashes: [hash("different-font")] })
    const inspection = await inspectRenderPageAssets(root)

    expect(inspection.ok).toBe(false)
    expect(inspection.hashVerification).toBe("failed")
    expect(inspection.problems.join("\n")).toContain("absent from provenance")
  })

  it("rejects font URLs that escape the asset directory", async () => {
    const root = await fixture({
      css: "@font-face{src:url(../font-a.woff2)}",
      provenanceHashes: [hash("font-a")],
    })
    const inspection = await inspectRenderPageAssets(root)

    expect(inspection.ok).toBe(false)
    expect(inspection.problems.join("\n")).toContain("escapes the asset directory")
  })
})

describe("compareSha256Multisets", () => {
  it("compares multiplicity rather than treating hashes as a set", () => {
    expect(compareSha256Multisets(["a", "a"], ["a"])).not.toEqual([])
    expect(compareSha256Multisets(["a", "a"], ["a", "a"])).toEqual([])
  })
})
