export {
  parseCliArgs,
  parseDiffCliArgs,
  parsePreviewCliArgs,
  type CliArgs,
  type DiffCliArgs,
  type PreviewCliArgs,
} from "./args.js"
export {
  diffDocuments,
  DIFF_UNEXPECTED_CHANGES_EXIT_CODE,
  type DiffDocumentsOptions,
  type DiffDocumentsResult,
} from "./diff.js"
export type {
  DiffReport,
  DiffSceneDescriptor,
  FrameDiffSampleResult,
  SceneAlignmentStatus,
  SceneDiffReportRow,
} from "./diff-model.js"
export { buildFfmpegArgs, startFfmpeg } from "./ffmpeg.js"
export {
  expectedOutputExtension,
  resolveInputPath,
  resolveOutputPath,
} from "./paths.js"
export {
  DEFAULT_PREVIEW_FRAME_COUNT,
  MAX_PREVIEW_FRAME_COUNT,
  renderFrames,
  renderVideo,
  renderVideoToBuffer,
  type RenderedFrame,
  type RenderFramesOptions,
  type RenderFramesResult,
  type RenderProgress,
  type RenderVideoBufferOptions,
  type RenderVideoBufferResult,
  type RenderVideoOptions,
  type RenderVideoResult,
} from "./render.js"
export {
  EXPORT_SPEED_VALUES,
  RESOLUTION_VALUES,
  resolveRenderSettings,
  type ExportResolution,
  type ExportSpeed,
  type RenderSettings,
} from "./settings.js"
export { serveRenderPage } from "./static-server.js"
export {
  RenderCancelledError,
  RenderError,
  UsageError,
} from "./errors.js"
