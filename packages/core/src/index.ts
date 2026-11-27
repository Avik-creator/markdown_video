// Public surface of @markdown-video/core.
//
// The package is intentionally framework-independent: every export here is
// pure TypeScript types, values, or functions that can run in Next.js, Vite,
// browsers, and modern Node.js. React components, editor state, persistence,
// MCP transport, DOM capture, and ffmpeg process/worker machinery are owned by
// their consuming applications.

// Authoritative directive schema and schema-derived value types/tables.
export * from "./directive-schema.js";

// Framework-independent document, scene, project, export, and template types.
// The singular schema-backed unions (AnimationType, TransitionType, AspectRatio,
// and friends) are exported directly by directive-schema above, so they are not
// repeated here.
export type {
  SceneType,
  AspectRatioType,
  TextAlign,
  CodeHighlight,
  CodeAnnotation,
  SceneText,
  SceneCode,
  SceneTerminal,
  TerminalCommand,
  SceneDiff,
  DiffLine,
  SceneChart,
  ChartDataItem,
  SceneMockup,
  SceneCallout,
  TimelineElement,
  CameraKeyframe,
  SceneCamera,
  SceneParticles,
  ScenePresenter,
  Chapter,
  VideoVariables,
  SceneImage,
  SceneEmoji,
  SceneQR,
  SceneCountdown,
  SceneProgress,
  SourceRange,
  SceneSourceMap,
  Scene,
  LocalizationStrings,
  MusicTrack,
  ExportSettings,
  VideoProject,
  TimelineSegment,
  Template,
} from "./types.js";

// Markdown parsing and timeline computation.
export {
  parseMarkdown,
  parseMarkdownFull,
  getTimelineSegments,
  getSceneAtTime,
} from "./parser/index.js";
export type { ParseResult } from "./parser/index.js";

// Pure caption extraction and SRT/WebVTT sidecar serialization. Cue timing is
// derived from the same timeline segments used for preview/export.
export {
  TEXT_STAGGER_DELAY_CHILDREN_SECONDS,
  normalizeCaptionText,
  generateCaptions,
  getCaptionCueAtTime,
  escapeVttText,
  serializeSrt,
  serializeVtt,
  generateCaptionSidecars,
} from "./captions.js";
export type {
  CaptionCue,
  CaptionSource,
  GenerateCaptionsOptions,
  CaptionSidecars,
} from "./captions.js";

// Shared ffmpeg argv/filter fragments for optional document music. These are
// pure data builders; host renderers still own process spawning and path I/O.
export {
  formatFfmpegSeconds,
  formatFfmpegGain,
  getEffectiveMusicFade,
  buildMusicAudioFilter,
  buildMusicInputArgs,
  buildMusicOutputArgs,
  captionSidecarPathsForOutput,
} from "./music-ffmpeg.js";
export type { CaptionSidecarPaths } from "./music-ffmpeg.js";

// Parser tables retained for authoring UI and editor tooling. The uppercase
// plural arrays are schema-derived compatibility names; new consumers can use
// the singular *_VALUES tables exported by directive-schema directly.
export {
  SCENE_COLORS,
  TEXT_FONT_FAMILIES,
  CODE_FONT_FAMILIES,
  ANIMATION_TYPES,
  TRANSITION_TYPES,
  TEXT_SIZES,
  CODE_FONT_SIZES,
  PARTICLE_TYPES,
  PARTICLE_INTENSITIES,
  DEVICE_TYPES,
  CHART_TYPES,
  CAMERA_EFFECTS,
  PAN_DIRECTIONS,
  SHAKE_INTENSITIES,
  PRESENTER_POSITIONS,
  PRESENTER_SIZES,
  PRESENTER_SHAPES,
  EMOJI_ANIMATIONS,
  COUNTDOWN_STYLES,
  PROGRESS_STYLES,
  CALLOUT_ARROWS,
  CALLOUT_STYLES,
  LAYOUT_SPLIT_DIRECTIONS,
  MOCKUP_CONTENT_TYPES,
  IMAGE_FIT_OPTIONS,
  IMAGE_POSITIONS,
  EXPORT_FORMATS,
  ASPECT_RATIOS,
  EXPORT_QUALITIES,
  DEFAULTS,
  REGEX_PATTERNS,
  DELIMITERS,
  PROPERTY_KEYS,
  SPECIAL_VALUES,
  DIRECTIVE_CASES,
  CASE_SENSITIVE_VALUES,
  KEYWORD_ALIASES,
  SCENE_DIRECTIVES,
} from "./parser/constants.js";

// Source-level directive helpers used by editor completions and tooling.
export {
  MAX_VARIABLE_EXPANSION_CHARS,
  VariableExpansionLimitError,
  normalizeDirective,
  parseDirective,
  collectVariableDefinitions,
  createVariableExpansionBudget,
  isSceneDirective,
  substituteVariables,
} from "./parser/utils.js";
export type { ParsedDirective, VariableExpansionBudget } from "./parser/utils.js";

// Localization parsing and resolution.
export {
  LOCALIZATION_TOKEN_PATTERN,
  isLocalizationToken,
  stripLocalizationQuotes,
  parseLocalizationStringsBlock,
  mergeLocalizationStrings,
  resolveEffectiveLocale,
  resolveLocalizedString,
  resolveSceneTextContent,
} from "./parser/i18n.js";
export type {
  ParsedLocalizationStringsBlock,
  EffectiveLocaleInput,
  LocalizedStringInput,
  SceneTextResolutionContext,
} from "./parser/i18n.js";

// Pure markdown validation. The MCP transport remains in apps/web.
export {
  validateMarkdownSyntax,
  KNOWN_DIRECTIVES,
  closestDirective,
  quickSyntaxCheck,
  getSyntaxSuggestions,
} from "./validation.js";
export type { ValidationError, ValidationResult } from "./validation.js";

// Schema-generated directive documentation used by both MCP tools and the editor.
export {
  getAllDirectives,
  getDirectiveDoc,
  getQuickReference,
  getExamplesByCategory,
  searchDocumentation,
} from "./documentation.js";
export type { DirectiveDoc, PropertyDoc } from "./documentation.js";

// Isomorphic share-link payload codec.
export {
  MAX_SHARE_URL_LENGTH,
  MAX_SHARE_MARKDOWN_BYTES,
  getUtf8ByteLength,
  isShareDocumentTooLarge,
  encodeShareMarkdown,
  decodeShareMarkdownPayload,
  getInlineShareLinkLength,
  canUseInlineShareLink,
  buildInlineShareLink,
} from "./share-link.js";
export type {
  ShareMarkdownPayloadFormat,
  ShareMarkdownDecodeError,
  ShareMarkdownDecodeResult,
} from "./share-link.js";

// Logical scene-composition geometry.
export {
  SCENE_ASPECT_RATIO_DIMENSIONS,
  FIXED_RENDER_LAYOUT_WIDTH,
  RENDER_LAYOUT_SHORT_SIDE,
  LOGICAL_ROOT_FONT_SIZE_PX,
  getSceneAspectRatioDimensions,
  getRenderLayoutDimensions,
} from "./render-layout.js";

// Output render geometry and deterministic frame-count planning.
export {
  getExportDimensions,
  getExportAspectRatio,
  getFrameEncoding,
  getVideoEncodingSettings,
  createRenderPlan,
  getFrameFileName,
  normalizeOutputFps,
  getTotalFrameCount,
  validateExportInput,
} from "./render-plan.js";
export type {
  FrameEncoding,
  VideoEncodingSettings,
  RenderPlan,
  ExportValidationResult,
} from "./render-plan.js";
