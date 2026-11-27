import { checkChromium, chromiumInstallInstructions } from "./browser.js"
import {
  checkFfmpeg,
  ffmpegInstallInstructions,
  type FFmpegCheck,
} from "./ffmpeg-check.js"
import { inspectRenderPageAssets } from "./render-assets.js"
import { resolveRenderPageDist } from "./static-server.js"

export interface DoctorOptions {
  ffmpegPath?: string | undefined
  chromiumExecutablePath?: string | undefined
}

export interface DoctorCheck {
  id: "node" | "render-assets" | "ffmpeg" | "chromium"
  name: string
  ok: boolean
  detail: string
  fix?: string | undefined
}

export interface DoctorReport {
  ok: boolean
  checks: DoctorCheck[]
}

function nodeCheck(): DoctorCheck {
  const major = Number.parseInt(process.versions.node.split(".", 1)[0] ?? "0", 10)
  const ok = major >= 20
  return {
    id: "node",
    name: "Node.js",
    ok,
    detail: `v${process.versions.node} (required: >=20)`,
    ...(ok
      ? {}
      : {
          fix: "Install Node.js 20 or newer from https://nodejs.org/ and run markdown-video again.",
        }),
  }
}

async function renderAssetsCheck(): Promise<DoctorCheck> {
  try {
    const rootDir = await resolveRenderPageDist()
    const inspection = await inspectRenderPageAssets(rootDir)
    if (inspection.ok) {
      return {
        id: "render-assets",
        name: "Render assets",
        ok: true,
        detail: `${inspection.fontFileCount} font files verified against SHA-256 provenance`,
      }
    }
    return {
      id: "render-assets",
      name: "Render assets",
      ok: false,
      detail: inspection.problems.slice(0, 3).join("; "),
      fix: "Reinstall markdown-video. In a source checkout, run: pnpm --filter markdown-video... build",
    }
  } catch (error) {
    return {
      id: "render-assets",
      name: "Render assets",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      fix: "Reinstall markdown-video. In a source checkout, run: pnpm --filter markdown-video... build",
    }
  }
}

function ffmpegFix(check: FFmpegCheck) {
  if (check.missingCapabilities.length > 0) {
    return [
      "The ffmpeg binary runs, but it cannot perform the exact H.264/AAC/GIF/music operations required.",
      ffmpegInstallInstructions(),
    ].join("\n")
  }
  return ffmpegInstallInstructions()
}

async function ffmpegCheck(executable: string): Promise<DoctorCheck> {
  const result = await checkFfmpeg(executable)
  return {
    id: "ffmpeg",
    name: "ffmpeg",
    ok: result.ok,
    detail: result.ok
      ? `${result.detail} (${executable})`
      : `${result.detail} (${executable})`,
    ...(result.ok ? {} : { fix: ffmpegFix(result) }),
  }
}

async function chromiumCheck(executablePath?: string | undefined): Promise<DoctorCheck> {
  const result = await checkChromium(executablePath)
  // Playwright's executablePath() reports the full Chrome binary even though
  // headless launches may use the sibling headless-shell binary. Only display
  // a path when the caller explicitly supplied it; otherwise the launch error
  // itself already names the exact executable Playwright needed.
  const location = executablePath &&
    result.executablePath &&
    !result.detail.includes(result.executablePath)
    ? ` — ${result.executablePath}`
    : ""
  return {
    id: "chromium",
    name: "Chromium",
    ok: result.ok,
    detail: `${result.detail}${location}`,
    ...(result.ok ? {} : { fix: chromiumInstallInstructions() }),
  }
}

export async function runDoctorChecks(options: DoctorOptions = {}): Promise<DoctorReport> {
  const checks = [
    nodeCheck(),
    await renderAssetsCheck(),
    await ffmpegCheck(options.ffmpegPath ?? process.env.FFMPEG_BIN ?? "ffmpeg"),
    await chromiumCheck(options.chromiumExecutablePath),
  ]
  return {
    ok: checks.every((check) => check.ok),
    checks,
  }
}

function indent(text: string) {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")
}

export function formatDoctorReport(report: DoctorReport) {
  const lines = ["markdown-video doctor", ""]
  for (const check of report.checks) {
    lines.push(`${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`)
    if (!check.ok && check.fix) {
      lines.push(indent(check.fix))
    }
  }
  lines.push("")
  const failed = report.checks.filter((check) => !check.ok).length
  lines.push(
    report.ok
      ? "All checks passed. markdown-video is ready to render."
      : `${failed} check${failed === 1 ? "" : "s"} need${failed === 1 ? "s" : ""} attention.`,
  )
  return `${lines.join("\n")}\n`
}
