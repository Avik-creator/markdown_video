// Public surface of @markdown-video/scenes.
//
// The package is the reusable React scene-rendering layer: scene components,
// overlays, transitions, camera transforms, deterministic sceneTime animation
// math, and the logical-frame composition shared by the Next.js editor and
// headless render hosts. It is deliberately free of editor state (no zustand
// store), framework coupling (no next/* imports), and wall-clock-dependent
// rendering: identical (scene, sceneTime) inputs produce identical markup.
//
// Host integration contracts (fonts, Tailwind scanning, localization) are
// documented in the package README.

// Class-name joining helper shared by scene components. Not editor-coupled:
// hosts can use it for their own composition chrome as well.
export { cn } from "./cn.js";
export type { ClassValue } from "./cn.js";

// Deterministic sceneTime animation math: pure functions that pin spring,
// countdown, terminal-typing, stagger and cursor-pulse state to scene time.
export {
  springProgress,
  countdownDigitState,
  computeTerminalCommandStates,
  staggeredLineProgress,
  pulseOpacityAtTime,
  TERMINAL_OUTPUT_FADE_DELAY,
  TERMINAL_OUTPUT_FADE_DURATION,
} from "./utils/animation-math.js";
export type {
  SpringParams,
  CountdownDigitState,
  TerminalCommandInput,
  TerminalCommandState,
} from "./utils/animation-math.js";

// Camera keyframe/effect resolution as a pure (camera, sceneTime) transform.
export {
  getCameraTransform,
  cameraTransformToCss,
  IDENTITY_CAMERA_TRANSFORM,
} from "./utils/camera-transform.js";
export type { CameraTransform } from "./utils/camera-transform.js";

// Camera wrapper component applying the deterministic camera transform.
export { CameraWrapper } from "./components/CameraWrapper.js";

// Frame overlays: particles, callout, presenter, timeline elements and the
// shared typing cursor. All are pure functions of their props plus sceneTime.
export { ParticleEffect } from "./components/ParticleEffect.js";
export { CalloutOverlay } from "./components/CalloutOverlay.js";
export { PresenterOverlay } from "./components/PresenterOverlay.js";
export { TimelineElementsOverlay } from "./components/TimelineElementsOverlay.js";
export { TypingCursor } from "./components/TypingCursor.js";

// Deterministic typing-effect hook shared by typewriter scenes.
export { useTypingEffect } from "./hooks/useTypingEffect.js";

// Text/code animation and scene transition variant tables.
export {
  textSizeClasses,
  animationVariants,
  transitionVariants,
} from "./utils/constants.js";

// Scene font-family resolution against host-provided CSS variables. The
// variable contract is documented in the package README.
export {
  textFontFamilyStyles,
  codeFontFamilyStyles,
} from "./utils/fonts.js";
export type { FontFamilyStyle } from "./utils/fonts.js";

// Deterministic variant interpolation for sceneTime-driven transitions.
export { interpolateValue, interpolateVariantState } from "./utils/interpolate.js";

// Split-layout math for composite scenes.
export {
  normalizeSplitRatio,
  splitGridStyle,
  materializeSplitPanel,
  DEFAULT_SPLIT_RATIO,
} from "./utils/split-layout.js";
export type {
  SplitDirection,
  SplitSide,
  SplitPanel,
} from "./utils/split-layout.js";

// Timeline-element visual state as a pure function of scene time.
export {
  timelineElementVisualState,
  TIMELINE_ELEMENT_ENTER_DURATION,
  TIMELINE_ELEMENT_EXIT_DURATION,
} from "./utils/timeline-animation.js";
export type { TimelineVisualState } from "./utils/timeline-animation.js";

// Transition timing normalization and deterministic progress.
export {
  normalizeTransitionDuration,
  transitionProgress,
  DEFAULT_TRANSITION_DURATION,
} from "./utils/transition.js";

// Lightweight syntax highlighting for code scenes.
export { highlightSyntax } from "./utils/code-highlighting.js";
