import { createHash } from "node:crypto"

import {
  parseMarkdownFull,
  type Scene,
  type SceneType,
} from "@markdown-video/core"

export const DIFF_REPORT_SCHEMA_VERSION = 1
export const DEFAULT_UNCHANGED_THRESHOLD_PERCENT = 0.1
export const DEFAULT_OUTLIER_THRESHOLD_PERCENT = 25
export const MODIFIED_OUTLIER_MIN_CONTENT_SIMILARITY = 0.9
export const DEFAULT_SAMPLES_PER_SCENE = 2
export const MAX_SAMPLES_PER_SCENE = 3

/**
 * A changed percent below 0.1 is treated as noise/identical. The remaining
 * boundaries are deliberately powers of five and match the human labels in
 * the report: [0.1,5) minor, [5,25) moderate, and 25+ heavy.
 */
export type RenderChangeClass = "identical" | "minor" | "moderate" | "heavy"

export type SceneAlignmentStatus =
  | "unchanged-content"
  | "modified"
  | "added"
  | "removed"
  | "retimed"

export interface DiffSceneDescriptor {
  /** Zero-based scene index within its own document version. */
  index: number
  type: SceneType
  /** Seconds from the start of that document version. */
  startTime: number
  duration: number
  /** SHA-256 over canonical, volatile-field-free scene content. */
  contentHash: string
}

interface SceneFingerprint extends DiffSceneDescriptor {
  canonicalContent: unknown
}

export interface DiffDocumentFingerprint {
  scenes: SceneFingerprint[]
  totalDuration: number
}

export interface SceneAlignmentRow {
  status: SceneAlignmentStatus
  old: DiffSceneDescriptor | null
  new: DiffSceneDescriptor | null
  /** Recursive content similarity in [0,1]; null for added/removed rows. */
  contentSimilarity: number | null
  /** new.startTime - old.startTime for matched rows, otherwise null. */
  positionDeltaSeconds: number | null
  /** new.duration - old.duration for matched rows, otherwise null. */
  durationDeltaSeconds: number | null
}

export interface SceneFrameSamplePlan {
  rowIndex: number
  sampleIndex: number
  fraction: number
  oldTime: number
  newTime: number
}

export interface FrameSamplePlan {
  samples: SceneFrameSamplePlan[]
  /** Parallel to samples; pass directly to the exact-frame capture API. */
  oldTimes: number[]
  /** Parallel to samples; pass directly to the exact-frame capture API. */
  newTimes: number[]
}

export interface DiffThresholds {
  /**
   * Percent at which a matched scene with unchanged content is unexpected.
   * Zero means any non-zero pixel difference is unexpected.
   */
  unchangedPercent: number
  /**
   * Percent at which a high-similarity modified scene is considered a
   * magnitude outlier.
   */
  modifiedOutlierPercent: number
}

export interface FrameDiffSampleResult {
  sampleIndex: number
  fraction: number
  oldTime: number
  newTime: number
  width: number
  height: number
  totalPixels: number
  mismatchedPixels: number
  changePercent: number
  comparisonImagePath: string | null
}

export interface SceneDiffReportRow {
  status: SceneAlignmentStatus
  old: DiffSceneDescriptor | null
  new: DiffSceneDescriptor | null
  contentSimilarity: number | null
  timing: {
    positionDeltaSeconds: number | null
    durationDeltaSeconds: number | null
  }
  comparison: {
    classification: RenderChangeClass
    meanChangePercent: number
    maxFrameChangePercent: number
    samples: FrameDiffSampleResult[]
  } | null
  unexpected: boolean
  unexpectedReasons: string[]
}

export interface DiffReport {
  version: typeof DIFF_REPORT_SCHEMA_VERSION
  verdict: "pass" | "fail"
  inputs: {
    old: { path: string; sceneCount: number; duration: number }
    new: { path: string; sceneCount: number; duration: number }
  }
  settings: {
    resolution: string
    aspectRatio: string
    locale: string | null
    samplesPerScene: number
    pixelmatchThreshold: number
    unchangedThresholdPercent: number
    modifiedOutlierPercent: number
    modifiedOutlierMinContentSimilarity: number
  }
  dimensions: { width: number; height: number } | null
  summary: {
    alignedPairs: number
    unchangedContent: number
    modified: number
    added: number
    removed: number
    retimed: number
    comparedScenes: number
    comparedFramePairs: number
    capturedFrames: number
    comparisonImagesWritten: number
    unexpectedScenes: number
    maxMeanChangePercent: number
    elapsedSeconds: number
    oldRenderElapsedSeconds: number
    newRenderElapsedSeconds: number
  }
  scenes: SceneDiffReportRow[]
}

type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | CanonicalJson[]
  | { [key: string]: CanonicalJson }

function stripVolatileKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripVolatileKeys(entry))
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "id" || key === "sourceMap" || child === undefined) continue
      result[key] = stripVolatileKeys(child)
    }
    return result
  }
  return value
}

function canonicalize(value: unknown): CanonicalJson {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry))
  }
  if (value !== null && typeof value === "object") {
    const input = value as Record<string, unknown>
    const result: { [key: string]: CanonicalJson } = {}
    for (const key of Object.keys(input).sort()) {
      const child = input[key]
      if (child === undefined) continue
      result[key] = canonicalize(child)
    }
    return result
  }
  return null
}

function stableStringify(value: unknown) {
  return JSON.stringify(canonicalize(value))
}

/**
 * Canonical content used for hashing and similarity. Random parser ids and
 * source maps are never semantic. The top-level duration is excluded so a
 * pure duration edit can be classified as retimed rather than modified.
 *
 * An implicit parser-assigned background is also excluded because it is a
 * function of scene position (SCENE_COLORS[index]), not document content.
 * That choice is deliberate: moving a scene whose background was implicit is
 * aligned as unchanged/retimed content, while pixel comparison can still
 * surface the real positional color change. An explicit !background remains
 * part of content.
 */
export function canonicalSceneContent(scene: Scene) {
  const stripped = stripVolatileKeys(scene) as Record<string, unknown>
  delete stripped.duration
  if (!scene.sourceMap?.background) {
    delete stripped.background
  }
  return canonicalize(stripped)
}

export function hashSceneContent(scene: Scene) {
  return createHash("sha256")
    .update(stableStringify(canonicalSceneContent(scene)))
    .digest("hex")
}

/** Parse with the real document parser and fingerprint every scene. */
export function fingerprintDiffDocument(markdown: string): DiffDocumentFingerprint {
  const parsed = parseMarkdownFull(markdown)
  let startTime = 0
  const scenes = parsed.scenes.map((scene, index) => {
    const canonicalContent = canonicalSceneContent(scene)
    const fingerprint: SceneFingerprint = {
      index,
      type: scene.type,
      startTime,
      duration: scene.duration,
      contentHash: createHash("sha256")
        .update(stableStringify(canonicalContent))
        .digest("hex"),
      canonicalContent,
    }
    startTime += scene.duration
    return fingerprint
  })

  return { scenes, totalDuration: startTime }
}

function tokenize(text: string) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

function characterBigrams(text: string) {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim()
  if (normalized.length === 0) return []
  if (normalized.length === 1) return [normalized]
  const bigrams: string[] = []
  for (let index = 0; index < normalized.length - 1; index += 1) {
    bigrams.push(normalized.slice(index, index + 2))
  }
  return bigrams
}

function multisetDice(a: readonly string[], b: readonly string[]) {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0

  const counts = new Map<string, number>()
  for (const item of a) counts.set(item, (counts.get(item) ?? 0) + 1)
  let intersection = 0
  for (const item of b) {
    const count = counts.get(item) ?? 0
    if (count > 0) {
      intersection += 1
      counts.set(item, count - 1)
    }
  }
  return (2 * intersection) / (a.length + b.length)
}

function stringSimilarity(a: string, b: string) {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0
  return Math.max(
    multisetDice(tokenize(a), tokenize(b)),
    multisetDice(characterBigrams(a), characterBigrams(b)),
  )
}

function numberSimilarity(a: number, b: number) {
  if (a === b) return 1
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  const scale = Math.max(Math.abs(a), Math.abs(b), 1)
  return Math.max(0, 1 - Math.abs(a - b) / scale)
}

function arraySimilarity(a: readonly unknown[], b: readonly unknown[]): number {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0

  // Most scene arrays are short (terminal commands, annotations, chart data).
  // For those, use LCS-style ordered matching so one inserted line does not
  // make every subsequent line look unrelated. Very large arrays fall back to
  // positional scoring to bound the quadratic cost.
  if (a.length * b.length <= 10_000) {
    const rows = a.length + 1
    const columns = b.length + 1
    const dp: number[][] = Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => 0),
    )
    for (let i = a.length - 1; i >= 0; i -= 1) {
      for (let j = b.length - 1; j >= 0; j -= 1) {
        const match = dp[i + 1]![j + 1]! + similarityValue(a[i], b[j])
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!, match)
      }
    }
    return (2 * dp[0]![0]!) / (a.length + b.length)
  }

  const length = Math.max(a.length, b.length)
  const shared = Math.min(a.length, b.length)
  let sum = 0
  for (let index = 0; index < shared; index += 1) {
    sum += similarityValue(a[index], b[index])
  }
  return sum / length
}

/**
 * Content-bearing objects and strings matter more than incidental scalar
 * metadata. The weights are heuristic, but they are intentionally explicit so
 * alignment behavior can be audited and tuned without hidden magic.
 */
const SIMILARITY_KEY_WEIGHTS: Record<string, number> = {
  type: 2,
  text: 7,
  code: 7,
  terminal: 7,
  diff: 7,
  split: 7,
  mockup: 6,
  chart: 6,
  image: 5,
  qr: 4,
  emoji: 4,
  countdown: 3,
  progress: 3,
  content: 8,
  commands: 8,
  changes: 8,
  data: 6,
  src: 5,
  url: 5,
  emojiChar: 5,
  background: 2,
  transition: 2,
  camera: 2,
  particles: 2,
  presenter: 1,
  chapter: 1,
  locale: 1,
}

function weightForKey(key: string) {
  return SIMILARITY_KEY_WEIGHTS[key] ?? 1
}

function objectSimilarity(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  if (keys.size === 0) return 1

  let weightedSum = 0
  let totalWeight = 0
  for (const key of keys) {
    const weight = weightForKey(key)
    totalWeight += weight
    const aHas = Object.prototype.hasOwnProperty.call(a, key)
    const bHas = Object.prototype.hasOwnProperty.call(b, key)
    if (aHas && bHas) {
      weightedSum += weight * similarityValue(a[key], b[key])
    }
  }
  return totalWeight === 0 ? 1 : weightedSum / totalWeight
}

function similarityValue(a: unknown, b: unknown): number {
  if (a === b) return 1
  if (a === null || a === undefined || b === null || b === undefined) return 0
  if (typeof a === "string" && typeof b === "string") {
    return stringSimilarity(a, b)
  }
  if (typeof a === "number" && typeof b === "number") {
    return numberSimilarity(a, b)
  }
  if (typeof a === "boolean" || typeof b === "boolean") {
    return a === b ? 1 : 0
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return arraySimilarity(a, b)
  }
  if (
    !Array.isArray(a) &&
    !Array.isArray(b) &&
    typeof a === "object" &&
    typeof b === "object"
  ) {
    return objectSimilarity(
      a as Record<string, unknown>,
      b as Record<string, unknown>,
    )
  }
  return 0
}

/** Recursive canonical-content similarity in the inclusive range [0,1]. */
export function sceneContentSimilarity(a: Scene, b: Scene) {
  return similarityValue(canonicalSceneContent(a), canonicalSceneContent(b))
}

function canonicalSimilarity(a: unknown, b: unknown) {
  return similarityValue(a, b)
}

function publicDescriptor(scene: SceneFingerprint): DiffSceneDescriptor {
  return {
    index: scene.index,
    type: scene.type,
    startTime: scene.startTime,
    duration: scene.duration,
    contentHash: scene.contentHash,
  }
}

function positionSimilarity(
  oldScene: SceneFingerprint,
  newScene: SceneFingerprint,
  oldCount: number,
  newCount: number,
) {
  const oldCenter = (oldScene.index + 0.5) / oldCount
  const newCenter = (newScene.index + 0.5) / newCount
  return 1 - Math.abs(oldCenter - newCenter)
}

const MODIFIED_ALIGNMENT_MIN_SCORE = 0.5
const MODIFIED_ALIGNMENT_MIN_CONTENT_SIMILARITY = 0.2
const TIMING_EPSILON_SECONDS = 1e-9

interface MutablePair {
  oldScene: SceneFingerprint
  newScene: SceneFingerprint
  similarity: number
}

function makeAlignedRow(pair: MutablePair): SceneAlignmentRow {
  const positionDeltaSeconds = pair.newScene.startTime - pair.oldScene.startTime
  const durationDeltaSeconds = pair.newScene.duration - pair.oldScene.duration
  const timingChanged =
    Math.abs(positionDeltaSeconds) > TIMING_EPSILON_SECONDS ||
    Math.abs(durationDeltaSeconds) > TIMING_EPSILON_SECONDS

  return {
    status:
      pair.similarity === 1
        ? timingChanged
          ? "retimed"
          : "unchanged-content"
        : "modified",
    old: publicDescriptor(pair.oldScene),
    new: publicDescriptor(pair.newScene),
    contentSimilarity: pair.similarity,
    positionDeltaSeconds,
    durationDeltaSeconds,
  }
}

function rowOrderKey(row: SceneAlignmentRow) {
  const oldIndex = row.old?.index ?? Number.MAX_SAFE_INTEGER
  const newIndex = row.new?.index ?? Number.MAX_SAFE_INTEGER
  return Math.min(oldIndex, newIndex)
}

/**
 * Align scenes in two phases:
 *
 * 1. Exact canonical-content hashes are matched one-to-one, independently of
 *    sequence position. Within duplicate hash groups old and new occurrences
 *    are zipped in document order. This makes moves and reorderings visible
 *    without mistaking stable scenes for edits, while truly duplicated scenes
 *    remain inherently ambiguous.
 * 2. Remaining old/new scenes of the same type receive a recursive content
 *    similarity score plus a small positional prior. Candidates are consumed
 *    greedily in descending score order. A pair must clear both a minimum
 *    content similarity and a combined score; whatever remains is reported as
 *    removed/added rather than force-aligned.
 *
 * This is a heuristic edit script, not a proof of author intent. In
 * particular, deleting one scene and inserting an unrelated scene nearby can
 * look like a modification, and duplicated scenes cannot be assigned
 * unambiguously. Those limitations are preferable to index-only alignment,
 * which misclassifies every downstream scene after a single insertion.
 */
export function alignSceneFingerprints(
  oldScenes: readonly SceneFingerprint[],
  newScenes: readonly SceneFingerprint[],
): SceneAlignmentRow[] {
  const matchedOld = new Set<number>()
  const matchedNew = new Set<number>()
  const pairs: MutablePair[] = []

  const oldByHash = new Map<string, SceneFingerprint[]>()
  const newByHash = new Map<string, SceneFingerprint[]>()
  for (const scene of oldScenes) {
    const group = oldByHash.get(scene.contentHash) ?? []
    group.push(scene)
    oldByHash.set(scene.contentHash, group)
  }
  for (const scene of newScenes) {
    const group = newByHash.get(scene.contentHash) ?? []
    group.push(scene)
    newByHash.set(scene.contentHash, group)
  }

  for (const [hash, oldGroup] of oldByHash) {
    const newGroup = newByHash.get(hash) ?? []
    const count = Math.min(oldGroup.length, newGroup.length)
    for (let index = 0; index < count; index += 1) {
      const oldScene = oldGroup[index]!
      const newScene = newGroup[index]!
      matchedOld.add(oldScene.index)
      matchedNew.add(newScene.index)
      pairs.push({ oldScene, newScene, similarity: 1 })
    }
  }

  const unmatchedOld = oldScenes.filter((scene) => !matchedOld.has(scene.index))
  const unmatchedNew = newScenes.filter((scene) => !matchedNew.has(scene.index))
  const candidates: Array<{
    oldScene: SceneFingerprint
    newScene: SceneFingerprint
    similarity: number
    score: number
    indexDistance: number
  }> = []

  for (const oldScene of unmatchedOld) {
    for (const newScene of unmatchedNew) {
      if (oldScene.type !== newScene.type) continue
      const similarity = canonicalSimilarity(
        oldScene.canonicalContent,
        newScene.canonicalContent,
      )
      if (similarity < MODIFIED_ALIGNMENT_MIN_CONTENT_SIMILARITY) continue
      const positional = positionSimilarity(
        oldScene,
        newScene,
        oldScenes.length,
        newScenes.length,
      )
      const score = similarity * 0.88 + positional * 0.12
      if (score < MODIFIED_ALIGNMENT_MIN_SCORE) continue
      candidates.push({
        oldScene,
        newScene,
        similarity,
        score,
        indexDistance: Math.abs(oldScene.index - newScene.index),
      })
    }
  }

  candidates.sort((a, b) =>
    b.score - a.score ||
    a.indexDistance - b.indexDistance ||
    a.oldScene.index - b.oldScene.index ||
    a.newScene.index - b.newScene.index,
  )
  for (const candidate of candidates) {
    if (matchedOld.has(candidate.oldScene.index)) continue
    if (matchedNew.has(candidate.newScene.index)) continue
    matchedOld.add(candidate.oldScene.index)
    matchedNew.add(candidate.newScene.index)
    pairs.push({
      oldScene: candidate.oldScene,
      newScene: candidate.newScene,
      similarity: candidate.similarity,
    })
  }

  const rows: SceneAlignmentRow[] = pairs.map((pair) => makeAlignedRow(pair))
  for (const scene of oldScenes) {
    if (matchedOld.has(scene.index)) continue
    rows.push({
      status: "removed",
      old: publicDescriptor(scene),
      new: null,
      contentSimilarity: null,
      positionDeltaSeconds: null,
      durationDeltaSeconds: null,
    })
  }
  for (const scene of newScenes) {
    if (matchedNew.has(scene.index)) continue
    rows.push({
      status: "added",
      old: null,
      new: publicDescriptor(scene),
      contentSimilarity: null,
      positionDeltaSeconds: null,
      durationDeltaSeconds: null,
    })
  }

  const statusTieBreak: Record<SceneAlignmentStatus, number> = {
    removed: 0,
    added: 1,
    "unchanged-content": 2,
    retimed: 2,
    modified: 2,
  }
  rows.sort((a, b) =>
    rowOrderKey(a) - rowOrderKey(b) ||
    statusTieBreak[a.status] - statusTieBreak[b.status] ||
    (a.old?.index ?? -1) - (b.old?.index ?? -1) ||
    (a.new?.index ?? -1) - (b.new?.index ?? -1),
  )
  return rows
}

export const SAMPLE_FRACTIONS: Record<number, readonly number[]> = {
  1: [0.5],
  2: [0.5, 0.8],
  3: [0.4, 0.65, 0.85],
}

export function validateSamplesPerScene(value: number) {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_SAMPLES_PER_SCENE
  ) {
    throw new Error(
      `Samples per scene must be an integer from 1 through ${MAX_SAMPLES_PER_SCENE}.`,
    )
  }
}

/**
 * Build paired fractional scene sample times. Fractions are deliberately in
 * the middle/late part of a scene rather than at 0 or 1, avoiding hard scene
 * boundaries. Very short scenes can still overlap their entrance transition;
 * that is inherent to fractional sampling and is documented in the README.
 */
export function createFrameSamplePlan(
  rows: readonly SceneAlignmentRow[],
  samplesPerScene: number,
): FrameSamplePlan {
  validateSamplesPerScene(samplesPerScene)
  const fractions = SAMPLE_FRACTIONS[samplesPerScene]!
  const samples: SceneFrameSamplePlan[] = []

  rows.forEach((row, rowIndex) => {
    if (!row.old || !row.new) return
    fractions.forEach((fraction, sampleIndex) => {
      samples.push({
        rowIndex,
        sampleIndex,
        fraction,
        oldTime: row.old!.startTime + row.old!.duration * fraction,
        newTime: row.new!.startTime + row.new!.duration * fraction,
      })
    })
  })

  return {
    samples,
    oldTimes: samples.map((sample) => sample.oldTime),
    newTimes: samples.map((sample) => sample.newTime),
  }
}

export function classifyRenderChange(changePercent: number): RenderChangeClass {
  if (changePercent < 0.1) return "identical"
  if (changePercent < 5) return "minor"
  if (changePercent < 25) return "moderate"
  return "heavy"
}

export function aggregateChangePercents(percents: readonly number[]) {
  if (percents.length === 0) {
    return { meanChangePercent: 0, maxFrameChangePercent: 0 }
  }
  const total = percents.reduce((sum, percent) => sum + percent, 0)
  return {
    meanChangePercent: total / percents.length,
    maxFrameChangePercent: Math.max(...percents),
  }
}

/**
 * Conservative CI semantics:
 *
 * - added/removed scenes are explicit structural edits and are never failures
 *   by themselves;
 * - modified scenes are expected to look different, except when a very small
 *   content delta (similarity >= 0.9) coincides with a large pixel delta;
 * - unchanged-content and retimed scenes have no source-content explanation
 *   for a pixel difference, so they fail at the much stricter unchanged
 *   threshold.
 */
export function unexpectedReasonsForScene({
  status,
  contentSimilarity,
  maxFrameChangePercent,
  thresholds,
}: {
  status: SceneAlignmentStatus
  contentSimilarity: number | null
  maxFrameChangePercent: number
  thresholds: DiffThresholds
}) {
  const reasons: string[] = []
  const hasChange = maxFrameChangePercent > 0

  if (
    (status === "unchanged-content" || status === "retimed") &&
    hasChange &&
    maxFrameChangePercent >= thresholds.unchangedPercent
  ) {
    reasons.push(
      `unchanged scene content rendered ${maxFrameChangePercent.toFixed(3)}% different`,
    )
  }

  if (
    status === "modified" &&
    hasChange &&
    contentSimilarity !== null &&
    contentSimilarity >= MODIFIED_OUTLIER_MIN_CONTENT_SIMILARITY &&
    maxFrameChangePercent >= thresholds.modifiedOutlierPercent
  ) {
    reasons.push(
      `small content edit (similarity ${contentSimilarity.toFixed(3)}) produced a ${maxFrameChangePercent.toFixed(3)}% render change`,
    )
  }

  return reasons
}

export function countAlignmentStatuses(rows: readonly SceneDiffReportRow[]) {
  return {
    unchangedContent: rows.filter((row) => row.status === "unchanged-content").length,
    modified: rows.filter((row) => row.status === "modified").length,
    added: rows.filter((row) => row.status === "added").length,
    removed: rows.filter((row) => row.status === "removed").length,
    retimed: rows.filter((row) => row.status === "retimed").length,
  }
}
