import { existsSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"

import {
  comparePngBuffers,
  createSideBySideComparisonPng,
  DIFF_PIXELMATCH_THRESHOLD,
} from "./diff-image.js"
import {
  aggregateChangePercents,
  alignSceneFingerprints,
  classifyRenderChange,
  countAlignmentStatuses,
  createFrameSamplePlan,
  DEFAULT_OUTLIER_THRESHOLD_PERCENT,
  DEFAULT_SAMPLES_PER_SCENE,
  DEFAULT_UNCHANGED_THRESHOLD_PERCENT,
  DIFF_REPORT_SCHEMA_VERSION,
  fingerprintDiffDocument,
  MAX_SAMPLES_PER_SCENE,
  MODIFIED_OUTLIER_MIN_CONTENT_SIMILARITY,
  unexpectedReasonsForScene,
  type DiffReport,
  type DiffSceneDescriptor,
  type DiffThresholds,
  type FrameDiffSampleResult,
  type SceneDiffReportRow,
} from "./diff-model.js"
import {
  diffComparisonImageFileName,
  prepareDiffOutputDir,
  writeDiffComparisonImage,
} from "./diff-output.js"
import { RenderError, throwIfAborted, UsageError } from "./errors.js"
import { MAX_MARKDOWN_BYTES, renderExactFrames } from "./render.js"
import { resolveRenderSettings } from "./settings.js"

export const DIFF_UNEXPECTED_CHANGES_EXIT_CODE = 3

export interface DiffDocumentsOptions {
  oldMarkdown: string
  newMarkdown: string
  /** Display paths used in machine output; they do not have to be resolved paths. */
  oldPath: string
  newPath: string
  cwd?: string | undefined
  resolution?: string | undefined
  aspectRatio?: string | undefined
  locale?: string | null | undefined
  chromiumExecutablePath?: string | undefined
  /** See RenderVideoOptions.allowRemoteNetwork in render.ts. */
  allowRemoteNetwork?: boolean | undefined
  samplesPerScene?: number | undefined
  unchangedThresholdPercent?: number | undefined
  modifiedOutlierPercent?: number | undefined
  outDir?: string | null | undefined
  overwrite?: boolean | undefined
  allowOutsideCwd?: boolean | undefined
  signal?: AbortSignal | undefined
}

export interface DiffDocumentsResult {
  report: DiffReport
  /** 0 when verdict is pass, 3 when unexpected visual changes were found. */
  exitCode: 0 | typeof DIFF_UNEXPECTED_CHANGES_EXIT_CODE
  comparisonImagePaths: string[]
}

function validatePercentThreshold(value: number, optionName: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new UsageError(
      `Invalid ${optionName} value "${value}". Expected a number from 0 through 100.`,
    )
  }
}

function validateDiffMarkdown(markdown: string, label: "old" | "new") {
  if (!markdown.trim()) {
    throw new UsageError(`The ${label} markdown input is empty.`)
  }
  const bytes = Buffer.byteLength(markdown, "utf8")
  if (bytes > MAX_MARKDOWN_BYTES) {
    throw new UsageError(
      `The ${label} markdown input is ${bytes} bytes; the limit is ${MAX_MARKDOWN_BYTES} bytes.`,
    )
  }
}

function fingerprintInput(markdown: string, label: "old" | "new") {
  validateDiffMarkdown(markdown, label)
  try {
    const fingerprint = fingerprintDiffDocument(markdown)
    if (fingerprint.scenes.length === 0 || fingerprint.totalDuration <= 0) {
      throw new UsageError(
        `The ${label} markdown input must contain at least one scene with positive duration.`,
      )
    }
    return fingerprint
  } catch (error) {
    if (error instanceof UsageError) throw error
    throw new UsageError(
      `Could not parse ${label} markdown input: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

function comparisonFileNameForSample({
  rows,
  rowIndex,
  sampleIndex,
}: {
  rows: readonly { old: DiffSceneDescriptor | null; new: DiffSceneDescriptor | null }[]
  rowIndex: number
  sampleIndex: number
}) {
  const row = rows[rowIndex]
  if (!row?.old || !row.new) {
    throw new RenderError(`Internal diff error: sample references unaligned scene row ${rowIndex}.`)
  }
  return diffComparisonImageFileName({
    oldIndex: row.old.index,
    newIndex: row.new.index,
    sampleIndex,
  })
}

function validateSamplesOption(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_SAMPLES_PER_SCENE) {
    throw new UsageError(
      `Invalid --samples-per-scene value "${value}". Expected an integer from 1 through ${MAX_SAMPLES_PER_SCENE}.`,
    )
  }
}

/**
 * Render and compare two markdown documents. The orchestration deliberately
 * captures only the fractional scene samples needed by the alignment rows:
 * no full mp4/GIF render and no ffmpeg process is involved. Each non-empty
 * capture batch is one renderExactFrames call, so all frames for a version
 * share one Chromium instance, one static asset server, and one font warmup.
 */
export async function diffDocuments(
  options: DiffDocumentsOptions,
): Promise<DiffDocumentsResult> {
  const started = performance.now()
  const samplesPerScene = options.samplesPerScene ?? DEFAULT_SAMPLES_PER_SCENE
  validateSamplesOption(samplesPerScene)

  const thresholds: DiffThresholds = {
    unchangedPercent:
      options.unchangedThresholdPercent ?? DEFAULT_UNCHANGED_THRESHOLD_PERCENT,
    modifiedOutlierPercent:
      options.modifiedOutlierPercent ?? DEFAULT_OUTLIER_THRESHOLD_PERCENT,
  }
  validatePercentThreshold(thresholds.unchangedPercent, "--threshold")
  validatePercentThreshold(thresholds.modifiedOutlierPercent, "--outlier-threshold")

  const settings = resolveRenderSettings({
    resolution: options.resolution,
    aspectRatio: options.aspectRatio,
    locale: options.locale,
    quality: "high",
    speed: "balanced",
    format: "mp4",
    fps: 30,
  })
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const oldDocument = fingerprintInput(options.oldMarkdown, "old")
  const newDocument = fingerprintInput(options.newMarkdown, "new")
  const alignmentRows = alignSceneFingerprints(oldDocument.scenes, newDocument.scenes)
  const samplePlan = createFrameSamplePlan(alignmentRows, samplesPerScene)

  let outputDirectory: string | null = null
  if (options.outDir) {
    outputDirectory = await prepareDiffOutputDir({
      outputDir: options.outDir,
      cwd,
      allowOutsideCwd: options.allowOutsideCwd ?? false,
    })

    // Collision preflight happens before expensive browser capture. The final
    // writes still use wx when overwrite is false, so this is defense in
    // depth rather than a check-then-write replacement.
    if (!options.overwrite) {
      for (const sample of samplePlan.samples) {
        const fileName = comparisonFileNameForSample({
          rows: alignmentRows,
          rowIndex: sample.rowIndex,
          sampleIndex: sample.sampleIndex,
        })
        const filePath = path.join(outputDirectory, fileName)
        if (existsSync(filePath)) {
          throw new UsageError(
            `Diff comparison image already exists: ${filePath} (use --overwrite to replace it).`,
          )
        }
      }
    }
  }

  throwIfAborted(options.signal)
  let oldCapture = null
  let newCapture = null
  if (samplePlan.samples.length > 0) {
    oldCapture = await renderExactFrames({
      markdown: options.oldMarkdown,
      times: samplePlan.oldTimes,
      resolution: settings.resolution,
      aspectRatio: settings.aspectRatio,
      locale: settings.locale,
      chromiumExecutablePath: options.chromiumExecutablePath,
      allowRemoteNetwork: options.allowRemoteNetwork ?? true,
      signal: options.signal,
    })
    throwIfAborted(options.signal)
    newCapture = await renderExactFrames({
      markdown: options.newMarkdown,
      times: samplePlan.newTimes,
      resolution: settings.resolution,
      aspectRatio: settings.aspectRatio,
      locale: settings.locale,
      chromiumExecutablePath: options.chromiumExecutablePath,
      allowRemoteNetwork: options.allowRemoteNetwork ?? true,
      signal: options.signal,
    })
  }

  const samplesByRow = new Map<number, FrameDiffSampleResult[]>()
  const comparisonImagePaths: string[] = []
  if (oldCapture && newCapture) {
    if (
      oldCapture.frames.length !== samplePlan.samples.length ||
      newCapture.frames.length !== samplePlan.samples.length
    ) {
      throw new RenderError("Frame capture count did not match the diff sample plan.")
    }

    for (const [captureIndex, sample] of samplePlan.samples.entries()) {
      throwIfAborted(options.signal)
      const oldFrame = oldCapture.frames[captureIndex]
      const newFrame = newCapture.frames[captureIndex]
      if (!oldFrame || !newFrame) {
        throw new RenderError(`Missing captured frame for diff sample ${captureIndex + 1}.`)
      }

      const pixelComparison = comparePngBuffers({
        oldPng: oldFrame.png,
        newPng: newFrame.png,
        threshold: DIFF_PIXELMATCH_THRESHOLD,
      })
      let comparisonImagePath: string | null = null
      if (outputDirectory) {
        const composite = createSideBySideComparisonPng({
          oldPng: oldFrame.png,
          newPng: newFrame.png,
          diffPng: pixelComparison.diffPng,
        })
        comparisonImagePath = await writeDiffComparisonImage({
          png: composite,
          directory: outputDirectory,
          fileName: comparisonFileNameForSample({
            rows: alignmentRows,
            rowIndex: sample.rowIndex,
            sampleIndex: sample.sampleIndex,
          }),
          overwrite: options.overwrite ?? false,
        })
        comparisonImagePaths.push(comparisonImagePath)
      }

      const measurement: FrameDiffSampleResult = {
        sampleIndex: sample.sampleIndex,
        fraction: sample.fraction,
        oldTime: sample.oldTime,
        newTime: sample.newTime,
        width: pixelComparison.width,
        height: pixelComparison.height,
        totalPixels: pixelComparison.totalPixels,
        mismatchedPixels: pixelComparison.mismatchedPixels,
        changePercent: pixelComparison.changePercent,
        comparisonImagePath,
      }
      const rowSamples = samplesByRow.get(sample.rowIndex) ?? []
      rowSamples.push(measurement)
      samplesByRow.set(sample.rowIndex, rowSamples)
    }
  }

  const sceneRows: SceneDiffReportRow[] = alignmentRows.map((row, rowIndex) => {
    const base = {
      status: row.status,
      old: row.old,
      new: row.new,
      contentSimilarity: row.contentSimilarity,
      timing: {
        positionDeltaSeconds: row.positionDeltaSeconds,
        durationDeltaSeconds: row.durationDeltaSeconds,
      },
    }
    if (!row.old || !row.new) {
      return {
        ...base,
        comparison: null,
        unexpected: false,
        unexpectedReasons: [],
      }
    }

    const measurements = [...(samplesByRow.get(rowIndex) ?? [])].sort(
      (a, b) => a.sampleIndex - b.sampleIndex,
    )
    if (samplePlan.samples.length > 0 && measurements.length === 0) {
      throw new RenderError(`No frame measurements were produced for aligned scene row ${rowIndex}.`)
    }
    const aggregate = aggregateChangePercents(
      measurements.map((measurement) => measurement.changePercent),
    )
    const unexpectedReasons = unexpectedReasonsForScene({
      status: row.status,
      contentSimilarity: row.contentSimilarity,
      maxFrameChangePercent: aggregate.maxFrameChangePercent,
      thresholds,
    })

    return {
      ...base,
      comparison: {
        classification: classifyRenderChange(aggregate.meanChangePercent),
        meanChangePercent: aggregate.meanChangePercent,
        maxFrameChangePercent: aggregate.maxFrameChangePercent,
        samples: measurements,
      },
      unexpected: unexpectedReasons.length > 0,
      unexpectedReasons,
    }
  })

  const statusCounts = countAlignmentStatuses(sceneRows)
  const unexpectedScenes = sceneRows.filter((row) => row.unexpected).length
  const alignedPairs = sceneRows.filter((row) => row.old && row.new).length
  const comparedFramePairs = samplePlan.samples.length
  const elapsedSeconds = (performance.now() - started) / 1000
  const verdict = unexpectedScenes === 0 ? "pass" : "fail"

  const report: DiffReport = {
    version: DIFF_REPORT_SCHEMA_VERSION,
    verdict,
    inputs: {
      old: {
        path: options.oldPath,
        sceneCount: oldDocument.scenes.length,
        duration: oldDocument.totalDuration,
      },
      new: {
        path: options.newPath,
        sceneCount: newDocument.scenes.length,
        duration: newDocument.totalDuration,
      },
    },
    settings: {
      resolution: settings.resolution,
      aspectRatio: settings.aspectRatio,
      locale: settings.locale,
      samplesPerScene,
      pixelmatchThreshold: DIFF_PIXELMATCH_THRESHOLD,
      unchangedThresholdPercent: thresholds.unchangedPercent,
      modifiedOutlierPercent: thresholds.modifiedOutlierPercent,
      modifiedOutlierMinContentSimilarity: MODIFIED_OUTLIER_MIN_CONTENT_SIMILARITY,
    },
    dimensions: oldCapture
      ? { width: oldCapture.width, height: oldCapture.height }
      : null,
    summary: {
      alignedPairs,
      unchangedContent: statusCounts.unchangedContent,
      modified: statusCounts.modified,
      added: statusCounts.added,
      removed: statusCounts.removed,
      retimed: statusCounts.retimed,
      comparedScenes: sceneRows.filter((row) => row.comparison !== null).length,
      comparedFramePairs,
      capturedFrames: (oldCapture?.frames.length ?? 0) + (newCapture?.frames.length ?? 0),
      comparisonImagesWritten: comparisonImagePaths.length,
      unexpectedScenes,
      maxMeanChangePercent: Math.max(
        0,
        ...sceneRows.map((row) => row.comparison?.meanChangePercent ?? 0),
      ),
      elapsedSeconds,
      oldRenderElapsedSeconds: oldCapture?.elapsedSeconds ?? 0,
      newRenderElapsedSeconds: newCapture?.elapsedSeconds ?? 0,
    },
    scenes: sceneRows,
  }

  return {
    report,
    exitCode: unexpectedScenes === 0 ? 0 : DIFF_UNEXPECTED_CHANGES_EXIT_CODE,
    comparisonImagePaths,
  }
}
