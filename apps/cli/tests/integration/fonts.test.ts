import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { chromium, type Browser } from "playwright"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { serveRenderPage, type RenderPageServer } from "../../src/static-server.js"

const integration = describe.skipIf(process.env.MV_SKIP_INTEGRATION === "1")
const testDir = path.dirname(fileURLToPath(import.meta.url))
const cliDir = path.resolve(testDir, "../..")
const fixturePath = path.join(cliDir, "fixtures/render-fixture.md")

const FONTS = [
  ["--font-inter", "Inter"],
  ["--font-playfair", "Playfair Display"],
  ["--font-merriweather-family", "Merriweather"],
  ["--font-ibm-plex-family", "IBM Plex Mono"],
  ["--font-geist-mono", "Geist Mono"],
  ["--font-jetbrains-family", "JetBrains Mono"],
  ["--font-fira-family", "Fira Code"],
  ["--font-source-code-family", "Source Code Pro"],
  ["--font-inconsolata-family", "Inconsolata"],
] as const

let server: RenderPageServer
let browser: Browser

beforeAll(async () => {
  server = await serveRenderPage()
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await server?.close()
})

integration("font contract", () => {
  it("loads every scene font family before capture", async () => {
    const page = await browser.newPage()
    await page.goto(`${server.url}/?aspect=16:9`)
    await page.waitForFunction(() => window.__mv)
    const duration = await page.evaluate(
      (markdown) => window.__mv!.load(markdown),
      readFileSync(fixturePath, "utf8"),
    )
    expect(duration).toBe(4)

    const checks = await page.evaluate((fontRows) => {
      const rootStyle = getComputedStyle(document.documentElement)
      return fontRows.map(([variable, family]) => ({
        variable,
        family,
        variableDefined: rootStyle.getPropertyValue(variable).trim().length > 0,
        regular: document.fonts.check(`16px "${family}"`),
        bold: document.fonts.check(`700 16px "${family}"`),
      }))
    }, FONTS)

    for (const check of checks) {
      expect(check.variableDefined, check.variable).toBe(true)
      expect(check.regular, `${check.family} regular`).toBe(true)
      expect(check.bold, `${check.family} bold`).toBe(true)
    }
    await page.close()
  }, 60_000)
})
