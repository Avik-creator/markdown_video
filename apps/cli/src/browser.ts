import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"

import { chromium, type Browser } from "playwright"

import { RenderError } from "./errors.js"

const require = createRequire(import.meta.url)
const playwrightPackageJson = require("playwright/package.json") as { version: string }

export const PLAYWRIGHT_VERSION = playwrightPackageJson.version

export const CHROMIUM_LAUNCH_ARGS = [
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-extensions",
  "--disable-sync",
  "--hide-scrollbars",
  "--mute-audio",
]

export interface ChromiumCheck {
  ok: boolean
  executablePath?: string | undefined
  version?: string | undefined
  detail: string
  error?: string | undefined
}

export function chromiumInstallInstructions() {
  return [
    "Install the Playwright-managed Chromium build:",
    "  markdown-video install-browser",
    "On Linux, install Chromium together with its system libraries:",
    "  markdown-video install-browser --with-deps",
    `Equivalent explicit command: npx playwright@${PLAYWRIGHT_VERSION} install chromium`,
    "If you use a system Chrome/Chromium instead, pass `--chromium /path/to/browser`.",
  ].join("\n")
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function firstUsefulLine(message: string) {
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  return lines[0] ?? "unknown Chromium launch failure"
}

function expectedExecutablePath(executablePath: string | undefined) {
  if (executablePath) return executablePath
  try {
    return chromium.executablePath()
  } catch {
    return undefined
  }
}

async function launchChromium(executablePath?: string | undefined): Promise<Browser> {
  return chromium.launch({
    headless: true,
    timeout: 10_000,
    ...(executablePath ? { executablePath } : {}),
    args: CHROMIUM_LAUNCH_ARGS,
  })
}

export async function checkChromium(
  executablePath?: string | undefined,
): Promise<ChromiumCheck> {
  const expectedPath = expectedExecutablePath(executablePath)
  let browser: Browser | null = null
  try {
    browser = await launchChromium(executablePath)
    const version = browser.version()
    return {
      ok: true,
      ...(expectedPath ? { executablePath: expectedPath } : {}),
      ...(version ? { version } : {}),
      detail: version ? `Chromium ${version}` : "Chromium launches successfully",
    }
  } catch (error) {
    const message = errorText(error)
    return {
      ok: false,
      ...(expectedPath ? { executablePath: expectedPath } : {}),
      detail: firstUsefulLine(message),
      error: message,
    }
  } finally {
    if (browser) await browser.close().catch(() => undefined)
  }
}

export function chromiumLaunchFailureMessage(
  error: unknown,
  executablePath?: string | undefined,
) {
  const detail = firstUsefulLine(errorText(error))
  if (executablePath) {
    return [
      `Could not launch the Chromium executable "${executablePath}": ${detail}`,
      "",
      "Verify that --chromium points at a compatible Chrome/Chromium executable,",
      "or omit --chromium and use the Playwright-managed browser.",
      "",
      chromiumInstallInstructions(),
    ].join("\n")
  }

  return [
    `Playwright Chromium is not ready: ${detail}`,
    "",
    chromiumInstallInstructions(),
  ].join("\n")
}

export async function openChromium(executablePath?: string | undefined) {
  try {
    return await launchChromium(executablePath)
  } catch (error) {
    throw new RenderError(chromiumLaunchFailureMessage(error, executablePath), {
      cause: error instanceof Error ? error : undefined,
    })
  }
}

export async function installPlaywrightChromium({
  withDeps = false,
}: {
  withDeps?: boolean | undefined
} = {}) {
  const packageJsonPath = require.resolve("playwright/package.json")
  const cliPath = path.join(path.dirname(packageJsonPath), "cli.js")
  const args = [
    cliPath,
    "install",
    ...(withDeps ? ["--with-deps"] : []),
    "chromium",
  ]

  const result = await new Promise<{
    code: number | null
    signal: NodeJS.Signals | null
    error?: Error | undefined
  }>((resolve) => {
    const child = spawn(process.execPath, args, {
      stdio: "inherit",
      shell: false,
    })
    let error: Error | undefined
    child.once("error", (spawnError) => {
      error = spawnError
    })
    child.once("close", (code, signal) => {
      resolve({ code, signal, ...(error ? { error } : {}) })
    })
  })

  if (result.error) {
    throw new RenderError(
      `Could not start the Playwright installer: ${result.error.message}`,
      { cause: result.error },
    )
  }
  if (result.code !== 0) {
    const reason = result.signal
      ? `terminated with signal ${result.signal}`
      : `exited with code ${String(result.code)}`
    throw new RenderError(`Chromium installation ${reason}.`)
  }
}
