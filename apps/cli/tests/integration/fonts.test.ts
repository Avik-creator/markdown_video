import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { PNG } from "pngjs"
import { chromium, type Browser } from "playwright"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { serveRenderPage, type RenderPageServer } from "../../src/static-server.js"

const integration = describe.skipIf(process.env.MV_SKIP_INTEGRATION === "1")
const testDir = path.dirname(fileURLToPath(import.meta.url))
const cliDir = path.resolve(testDir, "../..")
const fixturePath = path.join(cliDir, "fixtures/render-fixture.md")

const TEXT_FONTS = [
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

const EMOJI_FONT_VARIABLE = "--font-emoji"
const EMOJI_FONT_FAMILY = "Noto Color Emoji"

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

    const checks = await page.evaluate(
      ({ fontRows, emojiVariable, emojiFamily }) => {
        const rootStyle = getComputedStyle(document.documentElement)
        return {
          text: fontRows.map(([variable, family]) => ({
            variable,
            family,
            variableDefined: rootStyle.getPropertyValue(variable).trim().length > 0,
            regular: document.fonts.check(`16px "${family}"`),
            bold: document.fonts.check(`700 16px "${family}"`),
          })),
          emoji: {
            variableDefined: rootStyle.getPropertyValue(emojiVariable).trim().length > 0,
            regular: document.fonts.check(`16px "${emojiFamily}"`, "😀"),
          },
        }
      },
      {
        fontRows: TEXT_FONTS,
        emojiVariable: EMOJI_FONT_VARIABLE,
        emojiFamily: EMOJI_FONT_FAMILY,
      },
    )

    for (const check of checks.text) {
      expect(check.variableDefined, check.variable).toBe(true)
      expect(check.regular, `${check.family} regular`).toBe(true)
      expect(check.bold, `${check.family} bold`).toBe(true)
    }
    expect(checks.emoji.variableDefined, EMOJI_FONT_VARIABLE).toBe(true)
    expect(checks.emoji.regular, `${EMOJI_FONT_FAMILY} emoji probe`).toBe(true)
    await page.close()
  }, 60_000)

  it("renders color emoji when fontconfig exposes no system fonts", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "mv-empty-fontconfig-"))
    const fontconfigPath = path.join(tempDir, "fonts.conf")
    writeFileSync(
      fontconfigPath,
      `<?xml version="1.0"?>
<fontconfig>
  <dir>${path.join(tempDir, "no-fonts")}</dir>
  <cachedir>${path.join(tempDir, "cache")}</cachedir>
</fontconfig>
`,
    )

    // Chromium resolves platform fonts through fontconfig on Linux. Giving the
    // browser process a configuration with no real font directories makes this
    // pixel assertion depend on the bundled webfont rather than the host OS.
    // macOS Chromium uses CoreText instead, so there the assertion remains a
    // useful color-render regression test but is not a system-font isolation proof.
    const processEnv = Object.fromEntries(
      Object.entries(process.env).filter(([, value]) => value !== undefined),
    ) as Record<string, string>
    const isolatedBrowser = await chromium.launch({
      headless: true,
      env: { ...processEnv, FONTCONFIG_FILE: fontconfigPath },
    })

    try {
      const page = await isolatedBrowser.newPage({ viewport: { width: 700, height: 500 } })
      await page.goto(`${server.url}/?aspect=16:9`)
      await page.waitForFunction(() => window.__mv)
      const markdown = "!scene\n!duration 1\n!emoji 😀 size:xl\n"
      const duration = await page.evaluate((source) => window.__mv!.load(source), markdown)
      expect(duration).toBe(1)
      await page.evaluate(() => window.__mv!.seek(0.5))

      const emojiFontLoaded = await page.evaluate(
        (family) => document.fonts.check(`400 16px "${family}"`, "😀"),
        EMOJI_FONT_FAMILY,
      )
      expect(emojiFontLoaded).toBe(true)

      const screenshot = await page.locator("[data-scene-preview=true]").screenshot()
      const png = PNG.sync.read(screenshot)
      let saturatedYellowPixels = 0
      for (let i = 0; i < png.data.length; i += 4) {
        const red = png.data[i] ?? 0
        const green = png.data[i + 1] ?? 0
        const blue = png.data[i + 2] ?? 0
        if (red > 180 && green > 110 && green < 230 && blue < 130) {
          saturatedYellowPixels++
        }
      }
      expect(saturatedYellowPixels).toBeGreaterThan(500)
      await page.close()
    } finally {
      await isolatedBrowser.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  }, 60_000)
})
