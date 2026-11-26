// Main markdown parser
// Parses custom markdown syntax into scene objects

import type {
  CameraKeyframe,
  Chapter,
  LocalizationStrings,
  MusicTrack,
  Scene,
  SceneSourceMap,
  VideoVariables,
} from "../types.js";
import type {
  AnimationType,
  CalloutArrow,
  CalloutStyle,
  CameraEffect,
  ChartType,
  CodeFontFamily,
  CodeFontSize,
  CountdownStyle,
  DeviceType,
  EmojiAnimation,
  ImageFit,
  ImagePosition,
  LayoutSplitDirection,
  MockupContentType,
  PanDirection,
  ParticleIntensity,
  ParticleType,
  PresenterPosition,
  PresenterShape,
  PresenterSize,
  ProgressStyle,
  ShakeIntensity,
  TextFontFamily,
  TextSize,
  TransitionType,
} from "../directive-schema.js";
import {
  assertNever,
  getCameraKeyframeProperty,
  isCanonicalDirectiveName,
  isOneOf,
} from "../directive-schema.js";
import {
  ANIMATION_TYPES,
  CALLOUT_ARROWS,
  CALLOUT_STYLES,
  CAMERA_EFFECTS,
  CHART_TYPES,
  CODE_FONT_FAMILIES,
  CODE_FONT_SIZES,
  COUNTDOWN_STYLES,
  DEVICE_TYPES,
  DIRECTIVE_CASES,
  DEFAULTS,
  DELIMITERS,
  EMOJI_ANIMATIONS,
  IMAGE_FIT_OPTIONS,
  IMAGE_POSITIONS,
  LAYOUT_SPLIT_DIRECTIONS,
  MOCKUP_CONTENT_TYPES,
  PAN_DIRECTIONS,
  PARTICLE_INTENSITIES,
  PARTICLE_TYPES,
  PRESENTER_POSITIONS,
  PRESENTER_SHAPES,
  PRESENTER_SIZES,
  PROGRESS_STYLES,
  SCENE_COLORS,
  SHAKE_INTENSITIES,
  TEXT_FONT_FAMILIES,
  TEXT_SIZES,
  TRANSITION_TYPES,
} from "./constants.js";
import {
  collectVariableDefinitions,
  generateId,
  isSceneDirective,
  parseDirective,
  substituteVariables,
} from "./utils.js";
import {
  isLocalizationToken,
  mergeLocalizationStrings,
  parseLocalizationStringsBlock,
} from "./i18n.js";
import {
  directivePropertyDefault,
  getInlinePropertyValue,
  parseAnnotations,
  parseBooleanValue,
  parseChartData,
  parseCodeBlock,
  parseDiffBlock,
  parseDirectiveEnum,
  parseDirectiveEnumOrDefault,
  parseDirectiveNumericValue,
  parseDirectivePropertyLine,
  parseHighlights,
  parseInlineArguments,
  parseLayoutChildren,
  parseTerminalBlock,
} from "./parsers/index.js";

export interface ParseResult {
  scenes: Scene[];
  chapters: Chapter[];
  variables: VideoVariables;
  /** Locale codes declared by the most recent non-empty document-level `!locales`. */
  locales: string[];
  /** Merged translations from every document-level `!strings` block. */
  localizationStrings: LocalizationStrings;
  /** First valid locale in `!locales`; no separate default-locale directive exists. */
  defaultLocale?: string;
  /** Most recent valid document-level `!music` directive, if one was declared. */
  music?: MusicTrack;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseMusicTrack(directiveArgs: string): MusicTrack | null {
  const { positional } = parseInlineArguments(directiveArgs);
  const src = firstInlineValue(positional, 0);
  if (!src) return null;

  const parsedVolume = parseDirectiveNumericValue(
    "music",
    "volume",
    getInlinePropertyValue("music", directiveArgs, "volume")
  );
  const parsedFade = parseDirectiveNumericValue(
    "music",
    "fade",
    getInlinePropertyValue("music", directiveArgs, "fade")
  );

  // The renderer remains deterministic even while the validator is reporting
  // an out-of-range document: out-of-range numeric values clamp into the
  // schema's bounds rather than becoming impossible gain/fade values.
  return {
    src,
    volume:
      parsedVolume === undefined
        ? DEFAULTS.musicVolume
        : clampNumber(parsedVolume, 0, 1),
    fade:
      parsedFade === undefined
        ? DEFAULTS.musicFade
        : clampNumber(parsedFade, 0, 30),
    loop:
      parseBooleanValue(getInlinePropertyValue("music", directiveArgs, "loop")) ??
      DEFAULTS.musicLoop,
  };
}

function consumeDirectiveTail(lines: string[], startIndex: number): number {
  let index = startIndex;
  while (index < lines.length) {
    const nextLine = lines[index].trim();
    if (
      nextLine.startsWith(DELIMITERS.DIRECTIVE_PREFIX) ||
      nextLine === DELIMITERS.SCENE_SEPARATOR
    ) {
      break;
    }
    index++;
  }
  return index;
}

function firstInlineValue(values: readonly string[], index: number): string | undefined {
  return values[index];
}

export function parseMarkdown(markdown: string): Scene[] {
  const result = parseMarkdownFull(markdown);
  return result.scenes;
}

export function parseMarkdownFull(markdown: string): ParseResult {
  return parseMarkdownInternal(markdown);
}

function parseMarkdownInternal(
  markdown: string,
  inheritedVariables: VideoVariables = {}
): ParseResult {
  const scenes: Scene[] = [];
  const chapters: Chapter[] = [];
  let locales: string[] = [];
  let music: MusicTrack | undefined;
  const localizationStrings: LocalizationStrings = {};
  const lines = markdown.split(/\r?\n/);
  // First pass: collect hoisted variable definitions. Nested layout parsing
  // inherits the parent's variables and can add document-local definitions.
  const variables: VideoVariables = collectVariableDefinitions(lines, inheritedVariables);
  let i = 0;
  let colorIndex = 0;
  let currentTime = 0;

  while (i < lines.length) {
    let line = lines[i].trim();

    // Variable substitution
    line = substituteVariables(line, variables);

    // Check for complete scene directive words (with aliases)
    const sceneDirective = isSceneDirective(line);

    if (sceneDirective) {
      const sceneStartLine = i + 1; // 1-indexed
      const sourceMap: SceneSourceMap = {
        scene: { startLine: sceneStartLine, endLine: sceneStartLine },
      };
      const scene: Scene = {
        id: generateId(),
        type: "text",
        duration: DEFAULTS.sceneDuration,
        background: SCENE_COLORS[colorIndex % SCENE_COLORS.length],
        sourceMap,
      };
      colorIndex++;
      i++;

      // Parse scene properties
      while (i < lines.length) {
        const currentLine = substituteVariables(lines[i].trim(), variables);

        // End of scene or next scene (check for complete scene aliases)
        const isNextScene = isSceneDirective(currentLine);
        if (isNextScene || currentLine === DELIMITERS.SCENE_SEPARATOR) {
          break;
        }

        // Parse directives
        if (currentLine.startsWith(DELIMITERS.DIRECTIVE_PREFIX)) {
          const parsedDirective = parseDirective(currentLine);
          const canonicalName = parsedDirective?.canonicalName;
          const directiveArgs = parsedDirective?.args || "";

          if (!canonicalName || !isCanonicalDirectiveName(canonicalName)) {
            i++;
            continue;
          }

          const directive = canonicalName;

          switch (directive) {
            case DIRECTIVE_CASES.CHAPTER: {
              const chapterLine = i + 1;
              const match = directiveArgs.match(/^"([^"]+)"/);
              if (match) {
                scene.chapter = match[1];
                chapters.push({
                  id: generateId(),
                  title: match[1],
                  time: currentTime,
                });
              }
              i++;
              i = consumeDirectiveTail(lines, i);
              sourceMap.chapter = { startLine: chapterLine, endLine: i };
              break;
            }

            case DIRECTIVE_CASES.TRANSITION: {
              const transitionLine = i + 1;
              const { positional } = parseInlineArguments(directiveArgs);
              const transitionType = parseDirectiveEnum<TransitionType>(
                "transition",
                "type",
                firstInlineValue(positional, 0),
                TRANSITION_TYPES
              );

              if (transitionType) {
                scene.transition = transitionType;
                scene.transitionDuration =
                  parseDirectiveNumericValue("transition", "duration", firstInlineValue(positional, 1)) ??
                  DEFAULTS.transitionDuration;
              }

              i++;
              i = consumeDirectiveTail(lines, i);
              sourceMap.transition = { startLine: transitionLine, endLine: i };
              break;
            }

            case DIRECTIVE_CASES.DURATION: {
              const durationLine = i + 1;
              const { positional } = parseInlineArguments(directiveArgs);
              const duration = parseDirectiveNumericValue("duration", "seconds", firstInlineValue(positional, 0));
              if (duration !== undefined) {
                scene.duration = duration;
              }
              i++;
              i = consumeDirectiveTail(lines, i);
              sourceMap.duration = { startLine: durationLine, endLine: i };
              break;
            }

            case DIRECTIVE_CASES.TEXT: {
              const textStartLine = i + 1;
              scene.type = "text";
              sourceMap.type = { startLine: textStartLine, endLine: textStartLine };
              const textContent: string[] = [];
              let animation: AnimationType = DEFAULTS.textAnimation;
              let size: TextSize = DEFAULTS.textSize;
              let color: string | undefined;
              let fontFamily: TextFontFamily | undefined;
              let stagger: number | undefined;
              let at: number | undefined;
              let duration: number | undefined;
              let i18nKey: string | undefined;

              // Check for inline format: !text "content" at:0s duration:1.5s
              const inlineMatch = directiveArgs.match(/^"([^"]+)"(.*)$/);
              if (inlineMatch) {
                const inlineContent = inlineMatch[1];
                const inlineParams = inlineMatch[2];
                const inlineAt = parseDirectiveNumericValue(
                  "text",
                  "at",
                  getInlinePropertyValue("text", inlineParams, "at")
                );
                const inlineDuration = parseDirectiveNumericValue(
                  "text",
                  "duration",
                  getInlinePropertyValue("text", inlineParams, "duration")
                );
                const inlineAnimation = parseDirectiveEnumOrDefault<AnimationType>(
                  "text",
                  "animation",
                  getInlinePropertyValue("text", inlineParams, "animation"),
                  ANIMATION_TYPES,
                  DEFAULTS.textAnimation
                );

                if (inlineAt !== undefined && inlineDuration !== undefined) {
                  if (!scene.timelineElements) {
                    scene.timelineElements = [];
                  }
                  scene.timelineElements.push({
                    id: generateId(),
                    type: "text",
                    content: inlineContent,
                    at: inlineAt,
                    duration: inlineDuration,
                    animation: inlineAnimation,
                  });
                  sourceMap.text = { startLine: textStartLine, endLine: textStartLine };
                  i++;
                  break;
                }
              }

              // Check for i18n key format: !text i18n:welcome
              const i18nMatch = directiveArgs.match(
                /^i18n:([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*)(?=\s|$)/i
              );
              if (i18nMatch) {
                i18nKey = i18nMatch[1];
              }

              i++;
              let textEndLine = textStartLine; // Default to the !text line itself

              while (i < lines.length) {
                const textLine = substituteVariables(
                  lines[i].trim(),
                  variables
                );
                if (
                  textLine.startsWith(DELIMITERS.DIRECTIVE_PREFIX) ||
                  textLine === DELIMITERS.SCENE_SEPARATOR
                ) {
                  break;
                }

                // Update endLine whenever we process a line within this block
                textEndLine = i + 1;

                const property = parseDirectivePropertyLine("text", textLine);
                if (property) {
                  switch (property.name) {
                    case "animation":
                      animation = parseDirectiveEnumOrDefault<AnimationType>(
                        "text",
                        "animation",
                        property.value,
                        ANIMATION_TYPES,
                        DEFAULTS.textAnimation
                      );
                      break;
                    case "size":
                      size = parseDirectiveEnumOrDefault<TextSize>(
                        "text",
                        "size",
                        property.value,
                        TEXT_SIZES,
                        DEFAULTS.textSize
                      );
                      break;
                    case "color":
                      color = property.value;
                      break;
                    case "fontFamily":
                      fontFamily = parseDirectiveEnumOrDefault<TextFontFamily>(
                        "text",
                        "fontFamily",
                        property.value,
                        TEXT_FONT_FAMILIES,
                        DEFAULTS.textFontFamily
                      );
                      break;
                    case "stagger":
                      stagger = parseDirectiveNumericValue("text", "stagger", property.value);
                      break;
                    case "at":
                      at = parseDirectiveNumericValue("text", "at", property.value);
                      break;
                    case "duration":
                      duration = parseDirectiveNumericValue("text", "duration", property.value);
                      break;
                    case "i18nKey":
                      i18nKey = property.value;
                      break;
                  }
                } else if (textLine) {
                  textContent.push(textLine);
                }
                i++;
              }

              sourceMap.text = { startLine: textStartLine, endLine: textEndLine };

              scene.text = {
                content: textContent.join("\n"),
                animation,
                size,
                align: "center",
                color,
                fontFamily: fontFamily || DEFAULTS.textFontFamily,
                stagger,
                i18nKey,
              };

              // If at: and duration: are specified, add to timelineElements
              if (at !== undefined && duration !== undefined) {
                if (!scene.timelineElements) {
                  scene.timelineElements = [];
                }
                scene.timelineElements.push({
                  id: generateId(),
                  type: "text",
                  content: textContent.join("\n"),
                  at,
                  duration,
                  animation,
                  stagger,
                });
              }
              break;
            }

            case DIRECTIVE_CASES.CODE: {
              const codeStartLine = i + 1;
              scene.type = "code";
              sourceMap.type = { startLine: codeStartLine, endLine: codeStartLine };
              i++;
              let highlights: { lines: number[] } | undefined;
              let annotations: Array<{ line: number; text: string }> = [];
              let typing = directivePropertyDefault<boolean>("code", "typing", false);
              let typingSpeed = DEFAULTS.codeTypingSpeed;
              let fontSize: CodeFontSize = DEFAULTS.codeFontSize;
              let fontFamily: CodeFontFamily = DEFAULTS.codeFontFamily;
              let height: number | undefined;
              let width: number | undefined;

              while (i < lines.length) {
                const codeLine = substituteVariables(
                  lines[i].trim(),
                  variables
                );

                if (codeLine.startsWith(DELIMITERS.CODE_FENCE)) {
                  const parsed = parseCodeBlock(lines, i, variables);
                  scene.code = {
                    language: parsed.language,
                    content: parsed.code,
                    highlight: highlights,
                    annotations,
                    showLineNumbers: true,
                    typing,
                    typingSpeed,
                    fontSize,
                    fontFamily,
                    height,
                    width,
                  };
                  i = parsed.endIndex;
                  sourceMap.code = { startLine: codeStartLine, endLine: i };
                  break;
                }

                if (/^annotations\s*:\s*$/i.test(codeLine)) {
                  i++;
                  const parsed = parseAnnotations(lines, i);
                  annotations = parsed.annotations;
                  i = parsed.endIndex;
                  continue;
                }

                const property = parseDirectivePropertyLine("code", codeLine);
                if (property) {
                  switch (property.name) {
                    case "highlight":
                      highlights = parseHighlights(property.value);
                      break;
                    case "typing":
                      typing =
                        parseBooleanValue(property.value) ??
                        directivePropertyDefault<boolean>("code", "typing", false);
                      break;
                    case "speed":
                      typingSpeed =
                        parseDirectiveNumericValue("code", "speed", property.value) ?? DEFAULTS.codeTypingSpeed;
                      break;
                    case "fontSize":
                      fontSize = parseDirectiveEnumOrDefault<CodeFontSize>(
                        "code",
                        "fontSize",
                        property.value,
                        CODE_FONT_SIZES,
                        DEFAULTS.codeFontSize
                      );
                      break;
                    case "fontFamily":
                      fontFamily = parseDirectiveEnumOrDefault<CodeFontFamily>(
                        "code",
                        "fontFamily",
                        property.value,
                        CODE_FONT_FAMILIES,
                        DEFAULTS.codeFontFamily
                      );
                      break;
                    case "height":
                      height = parseDirectiveNumericValue("code", "height", property.value);
                      break;
                    case "width":
                      width = parseDirectiveNumericValue("code", "width", property.value);
                      break;
                    case "annotations":
                      break;
                  }
                }
                i++;
              }
              break;
            }

            case DIRECTIVE_CASES.TERMINAL: {
              const terminalStartLine = i + 1;
              scene.type = "terminal";
              sourceMap.type = { startLine: terminalStartLine, endLine: terminalStartLine };
              i++;
              let typing = directivePropertyDefault<boolean>("terminal", "typing", true);
              let typingSpeed = directivePropertyDefault<number>("terminal", "speed", 30);

              while (i < lines.length) {
                const termLine = substituteVariables(lines[i].trim(), variables);
                const property = parseDirectivePropertyLine("terminal", termLine);

                if (property?.name === "typing") {
                  typing =
                    parseBooleanValue(property.value) ??
                    directivePropertyDefault<boolean>("terminal", "typing", true);
                  i++;
                } else if (property?.name === "speed") {
                  typingSpeed =
                    parseDirectiveNumericValue("terminal", "speed", property.value) ??
                    directivePropertyDefault<number>("terminal", "speed", 30);
                  i++;
                } else if (
                  termLine.startsWith(DELIMITERS.TERMINAL_PROMPT_DOLLAR) ||
                  termLine.startsWith(DELIMITERS.TERMINAL_PROMPT_ARROW)
                ) {
                  const parsed = parseTerminalBlock(lines, i, variables);
                  scene.terminal = {
                    commands: parsed.commands,
                    typing,
                    typingSpeed,
                  };
                  i = parsed.endIndex;
                  sourceMap.terminal = { startLine: terminalStartLine, endLine: i };
                  break;
                } else if (
                  termLine.startsWith(DELIMITERS.DIRECTIVE_PREFIX) ||
                  termLine === DELIMITERS.SCENE_SEPARATOR
                ) {
                  break;
                } else {
                  i++;
                }
              }
              break;
            }

            case DIRECTIVE_CASES.DIFF: {
              const diffStartLine = i + 1;
              scene.type = "diff";
              sourceMap.type = { startLine: diffStartLine, endLine: diffStartLine };
              const { positional } = parseInlineArguments(directiveArgs);
              i++;

              const parsed = parseDiffBlock(lines, i);
              scene.diff = {
                language: firstInlineValue(positional, 0) || "text",
                changes: parsed.changes,
              };
              i = parsed.endIndex;
              sourceMap.diff = { startLine: diffStartLine, endLine: i };
              break;
            }

            case DIRECTIVE_CASES.CHART: {
              const chartStartLine = i + 1;
              scene.type = "chart";
              sourceMap.type = { startLine: chartStartLine, endLine: chartStartLine };
              const chartTypeDefault = directivePropertyDefault<ChartType>(
                "chart",
                "type",
                "bar"
              );
              const chartType = parseDirectiveEnumOrDefault<ChartType>(
                "chart",
                "type",
                getInlinePropertyValue("chart", directiveArgs, "type"),
                CHART_TYPES,
                chartTypeDefault
              );
              const animate =
                parseBooleanValue(getInlinePropertyValue("chart", directiveArgs, "animate")) ??
                directivePropertyDefault<boolean>("chart", "animate", true);
              i++;

              const parsed = parseChartData(lines, i, variables);
              scene.chart = {
                type: chartType,
                data: parsed.data,
                animate,
              };
              i = parsed.endIndex;
              sourceMap.chart = { startLine: chartStartLine, endLine: i };
              break;
            }

            case DIRECTIVE_CASES.MOCKUP: {
              const mockupStartLine = i + 1;
              scene.type = "mockup";
              sourceMap.type = { startLine: mockupStartLine, endLine: mockupStartLine };
              const deviceDefault = directivePropertyDefault<DeviceType>(
                "mockup",
                "device",
                "browser"
              );
              const device = parseDirectiveEnumOrDefault<DeviceType>(
                "mockup",
                "device",
                getInlinePropertyValue("mockup", directiveArgs, "device"),
                DEVICE_TYPES,
                deviceDefault
              );
              let contentBg =
                getInlinePropertyValue("mockup", directiveArgs, "bg") ??
                directivePropertyDefault<string>("mockup", "bg", "#ffffff");
              i++;

              // Parse mockup content. Inline properties supply initial values;
              // following block property lines use the same schema keys and win.
              let contentType = parseDirectiveEnumOrDefault<MockupContentType>(
                "mockup",
                "content",
                getInlinePropertyValue("mockup", directiveArgs, "content"),
                MOCKUP_CONTENT_TYPES,
                directivePropertyDefault<MockupContentType>(
                  "mockup",
                  "content",
                  "text"
                )
              );
              const textContent: string[] = [];
              let textColor = getInlinePropertyValue("mockup", directiveArgs, "color");
              let textSize = parseDirectiveEnumOrDefault<TextSize>(
                "mockup",
                "size",
                getInlinePropertyValue("mockup", directiveArgs, "size"),
                TEXT_SIZES,
                directivePropertyDefault<TextSize>("mockup", "size", "md")
              );
              let imageSrc = getInlinePropertyValue("mockup", directiveArgs, "src");
              let imageFit = parseDirectiveEnumOrDefault<ImageFit>(
                "mockup",
                "fit",
                getInlinePropertyValue("mockup", directiveArgs, "fit"),
                IMAGE_FIT_OPTIONS,
                directivePropertyDefault<ImageFit>("mockup", "fit", "cover")
              );
              let i18nKey = getInlinePropertyValue("mockup", directiveArgs, "i18nKey");
              if (imageSrc) {
                contentType = "image";
              }

              while (i < lines.length) {
                const mockupLine = substituteVariables(
                  lines[i].trim(),
                  variables
                );
                if (
                  mockupLine.startsWith(DELIMITERS.DIRECTIVE_PREFIX) ||
                  mockupLine === DELIMITERS.SCENE_SEPARATOR
                ) {
                  break;
                }

                const property = parseDirectivePropertyLine("mockup", mockupLine);
                if (property) {
                  switch (property.name) {
                    case "content":
                      contentType = parseDirectiveEnumOrDefault<MockupContentType>(
                        "mockup",
                        "content",
                        property.value,
                        MOCKUP_CONTENT_TYPES,
                        directivePropertyDefault<MockupContentType>(
                          "mockup",
                          "content",
                          "text"
                        )
                      );
                      break;
                    case "bg":
                      contentBg = property.value;
                      break;
                    case "color":
                      textColor = property.value;
                      break;
                    case "size":
                      textSize = parseDirectiveEnumOrDefault<TextSize>(
                        "mockup",
                        "size",
                        property.value,
                        TEXT_SIZES,
                        directivePropertyDefault<TextSize>("mockup", "size", "md")
                      );
                      break;
                    case "src":
                      imageSrc = property.value;
                      contentType = "image";
                      break;
                    case "fit":
                      imageFit = parseDirectiveEnumOrDefault<ImageFit>(
                        "mockup",
                        "fit",
                        property.value,
                        IMAGE_FIT_OPTIONS,
                        directivePropertyDefault<ImageFit>("mockup", "fit", "cover")
                      );
                      break;
                    case "i18nKey":
                      i18nKey = property.value;
                      break;
                    case "device":
                      break;
                  }
                } else if (mockupLine) {
                  textContent.push(mockupLine);
                }
                i++;
              }

              sourceMap.mockup = { startLine: mockupStartLine, endLine: i };

              scene.mockup = {
                device,
                content: {
                  type: contentType,
                  background: contentBg,
                  text:
                    contentType === "text" && (textContent.length > 0 || i18nKey)
                      ? {
                          content: textContent.join("\n"),
                          color: textColor,
                          size: textSize,
                          align: "center",
                          i18nKey,
                        }
                      : undefined,
                  image: imageSrc
                    ? {
                        src: imageSrc,
                        fit: imageFit,
                      }
                    : undefined,
                },
              };
              break;
            }

            case DIRECTIVE_CASES.CALLOUT: {
              const { positional } = parseInlineArguments(directiveArgs);
              const arrow = parseDirectiveEnumOrDefault<CalloutArrow>(
                "callout",
                "arrow",
                getInlinePropertyValue("callout", directiveArgs, "arrow"),
                CALLOUT_ARROWS,
                directivePropertyDefault<CalloutArrow>("callout", "arrow", "down")
              );
              const style = parseDirectiveEnumOrDefault<CalloutStyle>(
                "callout",
                "style",
                getInlinePropertyValue("callout", directiveArgs, "style"),
                CALLOUT_STYLES,
                directivePropertyDefault<CalloutStyle>("callout", "style", "info")
              );

              scene.callout = {
                text: firstInlineValue(positional, 0) || "",
                arrow,
                target: getInlinePropertyValue("callout", directiveArgs, "target"),
                style,
              };
              i++;
              break;
            }

            case DIRECTIVE_CASES.PARTICLES: {
              const particlesLine = i + 1;
              let particleType = parseDirectiveEnumOrDefault<ParticleType>(
                "particles",
                "type",
                getInlinePropertyValue("particles", directiveArgs, "type"),
                PARTICLE_TYPES,
                DEFAULTS.particleType
              );
              let intensity = parseDirectiveEnumOrDefault<ParticleIntensity>(
                "particles",
                "intensity",
                getInlinePropertyValue("particles", directiveArgs, "intensity"),
                PARTICLE_INTENSITIES,
                DEFAULTS.particleIntensity
              );

              i++;
              // Consume separate property lines if any
              while (i < lines.length) {
                const nextLine = substituteVariables(lines[i].trim(), variables);
                if (
                  nextLine.startsWith(DELIMITERS.DIRECTIVE_PREFIX) ||
                  nextLine === DELIMITERS.SCENE_SEPARATOR
                ) {
                  break;
                }

                const property = parseDirectivePropertyLine("particles", nextLine);
                if (property?.name === "intensity") {
                  intensity = parseDirectiveEnumOrDefault<ParticleIntensity>(
                    "particles",
                    "intensity",
                    property.value,
                    PARTICLE_INTENSITIES,
                    DEFAULTS.particleIntensity
                  );
                } else if (property?.name === "type") {
                  particleType = parseDirectiveEnumOrDefault<ParticleType>(
                    "particles",
                    "type",
                    property.value,
                    PARTICLE_TYPES,
                    DEFAULTS.particleType
                  );
                }
                i++;
              }

              scene.particles = {
                type: particleType,
                intensity,
              };
              sourceMap.particles = { startLine: particlesLine, endLine: i };
              break;
            }

            case DIRECTIVE_CASES.CAMERA: {
              const cameraStartLine = i + 1;
              const { tokens, positional } = parseInlineArguments(directiveArgs);
              const effectToken = tokens.find(
                (token) => token.key !== undefined && isOneOf(CAMERA_EFFECTS, token.key)
              );
              const effectRaw = effectToken?.key ?? firstInlineValue(positional, 0);
              const valueRaw = effectToken?.value ?? firstInlineValue(positional, 1);
              // `zoom` and `pan` are both camera aliases and camera effects.
              // When either alias invokes the directive and the arguments do
              // not select another valid effect, the alias supplies the effect
              // (`!pan` means a pan). `move` is not an effect and therefore
              // keeps the schema default. This hint is deliberately scoped to
              // the camera branch; aliases of other directives carry no such
              // positional meaning.
              const invokedEffect =
                parsedDirective && isOneOf(CAMERA_EFFECTS, parsedDirective.name)
                  ? parsedDirective.name
                  : DEFAULTS.cameraEffect;
              const effect = parseDirectiveEnumOrDefault<CameraEffect>(
                "camera",
                "effect",
                effectRaw,
                CAMERA_EFFECTS,
                invokedEffect
              );
              const value =
                parseDirectiveNumericValue("camera", "value", valueRaw) ?? DEFAULTS.cameraZoom;
              const durationRaw =
                getInlinePropertyValue("camera", directiveArgs, "duration") ??
                firstInlineValue(positional, 2);
              const cameraDuration =
                parseDirectiveNumericValue("camera", "duration", durationRaw) ?? DEFAULTS.cameraDuration;

              const keyframes: CameraKeyframe[] = [];
              i++;

              while (i < lines.length) {
                const cameraLine = lines[i].trim();
                if (cameraLine.startsWith(DELIMITERS.KEYFRAME_PREFIX)) {
                  const keyframeArguments = parseInlineArguments(
                    cameraLine.replace(/^-\s*/, "")
                  );
                  let at: number | undefined;
                  let zoom: number | undefined;
                  let pan: PanDirection | undefined;
                  let shake: boolean | undefined;
                  let shakeIntensity: ShakeIntensity | undefined;

                  for (const token of keyframeArguments.tokens) {
                    if (!token.key || token.value === undefined) continue;
                    const property = getCameraKeyframeProperty(token.key);
                    if (!property) continue;

                    switch (property.name) {
                      case "at":
                        at = parseDirectiveNumericValue("camera", "at", token.value);
                        break;
                      case "zoom":
                        zoom = parseDirectiveNumericValue("camera", "zoom", token.value);
                        break;
                      case "pan":
                        pan = parseDirectiveEnum<PanDirection>(
                          "camera",
                          "pan",
                          token.value,
                          PAN_DIRECTIONS
                        );
                        break;
                      case "shake":
                        shake = parseBooleanValue(token.value);
                        break;
                      case "shakeIntensity":
                        shakeIntensity = parseDirectiveEnum<ShakeIntensity>(
                          "camera",
                          "shakeIntensity",
                          token.value,
                          SHAKE_INTENSITIES
                        );
                        break;
                    }
                  }

                  if (at !== undefined) {
                    keyframes.push({
                      at,
                      zoom,
                      pan,
                      shake,
                      shakeIntensity,
                    });
                  }
                  i++;
                } else if (
                  cameraLine.startsWith(DELIMITERS.DIRECTIVE_PREFIX) ||
                  cameraLine === DELIMITERS.SCENE_SEPARATOR
                ) {
                  break;
                } else {
                  i++;
                }
              }

              sourceMap.camera = { startLine: cameraStartLine, endLine: i };

              scene.camera = {
                effect,
                value,
                duration: cameraDuration,
                keyframes: keyframes.length > 0 ? keyframes : undefined,
              };
              break;
            }

            case DIRECTIVE_CASES.PRESENTER: {
              const presenterLine = i + 1;
              let position = parseDirectiveEnumOrDefault<PresenterPosition>(
                "presenter",
                "position",
                getInlinePropertyValue("presenter", directiveArgs, "position"),
                PRESENTER_POSITIONS,
                DEFAULTS.presenterPosition
              );
              let presenterSize = parseDirectiveEnumOrDefault<PresenterSize>(
                "presenter",
                "size",
                getInlinePropertyValue("presenter", directiveArgs, "size"),
                PRESENTER_SIZES,
                DEFAULTS.presenterSize
              );
              let shape = parseDirectiveEnumOrDefault<PresenterShape>(
                "presenter",
                "shape",
                getInlinePropertyValue("presenter", directiveArgs, "shape"),
                PRESENTER_SHAPES,
                DEFAULTS.presenterShape
              );

              i++;
              // Consume separate property lines if any
              while (i < lines.length) {
                const nextLine = substituteVariables(lines[i].trim(), variables);
                if (
                  nextLine.startsWith(DELIMITERS.DIRECTIVE_PREFIX) ||
                  nextLine === DELIMITERS.SCENE_SEPARATOR
                ) {
                  break;
                }

                const property = parseDirectivePropertyLine("presenter", nextLine);
                if (property?.name === "position") {
                  position = parseDirectiveEnumOrDefault<PresenterPosition>(
                    "presenter",
                    "position",
                    property.value,
                    PRESENTER_POSITIONS,
                    DEFAULTS.presenterPosition
                  );
                } else if (property?.name === "size") {
                  presenterSize = parseDirectiveEnumOrDefault<PresenterSize>(
                    "presenter",
                    "size",
                    property.value,
                    PRESENTER_SIZES,
                    DEFAULTS.presenterSize
                  );
                } else if (property?.name === "shape") {
                  shape = parseDirectiveEnumOrDefault<PresenterShape>(
                    "presenter",
                    "shape",
                    property.value,
                    PRESENTER_SHAPES,
                    DEFAULTS.presenterShape
                  );
                }
                i++;
              }

              scene.presenter = {
                position,
                size: presenterSize,
                shape,
              };
              sourceMap.presenter = { startLine: presenterLine, endLine: i };
              break;
            }

            case DIRECTIVE_CASES.LAYOUT: {
              scene.type = "split";
              const direction = parseDirectiveEnumOrDefault<LayoutSplitDirection>(
                "layout",
                "split",
                getInlinePropertyValue("layout", directiveArgs, "split"),
                LAYOUT_SPLIT_DIRECTIONS,
                directivePropertyDefault<LayoutSplitDirection>(
                  "layout",
                  "split",
                  "horizontal"
                )
              );
              i++;

              const parsedLayout = parseLayoutChildren(
                lines,
                i,
                variables,
                (childMarkdown, childVariables) =>
                  parseMarkdownInternal(childMarkdown, childVariables).scenes[0]
              );
              scene.split = {
                left: parsedLayout.left,
                right: parsedLayout.right,
                direction,
                ratio: 0.5,
              };
              i = parsedLayout.endIndex;
              break;
            }

            case DIRECTIVE_CASES.IMAGE: {
              const imageLine = i + 1;
              scene.type = "image";
              sourceMap.type = { startLine: imageLine, endLine: imageLine };
              const fit = parseDirectiveEnumOrDefault<ImageFit>(
                "image",
                "fit",
                getInlinePropertyValue("image", directiveArgs, "fit"),
                IMAGE_FIT_OPTIONS,
                DEFAULTS.imageFit
              );
              const position = parseDirectiveEnumOrDefault<ImagePosition>(
                "image",
                "position",
                getInlinePropertyValue("image", directiveArgs, "position"),
                IMAGE_POSITIONS,
                DEFAULTS.imagePosition
              );

              scene.image = {
                src: getInlinePropertyValue("image", directiveArgs, "src") || "",
                fit,
                position,
                alt: getInlinePropertyValue("image", directiveArgs, "alt"),
              };
              sourceMap.image = { startLine: imageLine, endLine: imageLine };
              i++;
              break;
            }

            case DIRECTIVE_CASES.EMOJI: {
              const emojiLine = i + 1;
              scene.type = "emoji";
              sourceMap.type = { startLine: emojiLine, endLine: emojiLine };
              const { positional } = parseInlineArguments(directiveArgs);
              const emoji = firstInlineValue(positional, 0) || "🎉";
              const emojiSize = parseDirectiveEnumOrDefault<TextSize>(
                "emoji",
                "size",
                getInlinePropertyValue("emoji", directiveArgs, "size"),
                TEXT_SIZES,
                DEFAULTS.emojiSize
              );
              const emojiAnimation = parseDirectiveEnumOrDefault<EmojiAnimation>(
                "emoji",
                "animate",
                getInlinePropertyValue("emoji", directiveArgs, "animate"),
                EMOJI_ANIMATIONS,
                DEFAULTS.emojiAnimation
              );
              const at = parseDirectiveNumericValue(
                "emoji",
                "at",
                getInlinePropertyValue("emoji", directiveArgs, "at")
              );
              const duration = parseDirectiveNumericValue(
                "emoji",
                "duration",
                getInlinePropertyValue("emoji", directiveArgs, "duration")
              );

              scene.emoji = {
                emoji,
                size: emojiSize,
                animate: emojiAnimation,
              };
              sourceMap.emoji = { startLine: emojiLine, endLine: emojiLine };

              // If at: and duration: are specified, add to timelineElements
              if (at !== undefined && duration !== undefined) {
                if (!scene.timelineElements) {
                  scene.timelineElements = [];
                }
                scene.timelineElements.push({
                  id: generateId(),
                  type: "emoji",
                  content: emoji,
                  at,
                  duration,
                });
              }
              i++;
              break;
            }

            case DIRECTIVE_CASES.QR: {
              const qrLine = i + 1;
              scene.type = "qr";
              sourceMap.type = { startLine: qrLine, endLine: qrLine };

              scene.qr = {
                url:
                  getInlinePropertyValue("qr", directiveArgs, "url") ||
                  "https://example.com",
                size:
                  parseDirectiveNumericValue(
                    "qr",
                    "size",
                    getInlinePropertyValue("qr", directiveArgs, "size")
                  ) ?? directivePropertyDefault<number>("qr", "size", 200),
                color:
                  getInlinePropertyValue("qr", directiveArgs, "color") ||
                  directivePropertyDefault<string>("qr", "color", "#ffffff"),
                bgColor:
                  getInlinePropertyValue("qr", directiveArgs, "bg") ||
                  directivePropertyDefault<string>("qr", "bg", "transparent"),
                label: getInlinePropertyValue("qr", directiveArgs, "label"),
              };
              sourceMap.qr = { startLine: qrLine, endLine: qrLine };
              i++;
              break;
            }

            case DIRECTIVE_CASES.COUNTDOWN: {
              const countdownLine = i + 1;
              scene.type = "countdown";
              sourceMap.type = { startLine: countdownLine, endLine: countdownLine };
              const style = parseDirectiveEnumOrDefault<CountdownStyle>(
                "countdown",
                "style",
                getInlinePropertyValue("countdown", directiveArgs, "style"),
                COUNTDOWN_STYLES,
                DEFAULTS.countdownStyle
              );

              scene.countdown = {
                from:
                  parseDirectiveNumericValue(
                    "countdown",
                    "from",
                    getInlinePropertyValue("countdown", directiveArgs, "from")
                  ) ?? DEFAULTS.countdownFrom,
                style,
                color:
                  getInlinePropertyValue("countdown", directiveArgs, "color") ||
                  directivePropertyDefault<string>("countdown", "color", "#ec4899"),
              };
              sourceMap.countdown = { startLine: countdownLine, endLine: countdownLine };
              i++;
              break;
            }

            case DIRECTIVE_CASES.PROGRESS: {
              const progressLine = i + 1;
              scene.type = "progress";
              sourceMap.type = { startLine: progressLine, endLine: progressLine };
              const style = parseDirectiveEnumOrDefault<ProgressStyle>(
                "progress",
                "style",
                getInlinePropertyValue("progress", directiveArgs, "style"),
                PROGRESS_STYLES,
                DEFAULTS.progressStyle
              );

              scene.progress = {
                value:
                  parseDirectiveNumericValue(
                    "progress",
                    "value",
                    getInlinePropertyValue("progress", directiveArgs, "value")
                  ) ?? DEFAULTS.progressValue,
                max:
                  parseDirectiveNumericValue(
                    "progress",
                    "max",
                    getInlinePropertyValue("progress", directiveArgs, "max")
                  ) ?? DEFAULTS.progressMax,
                animate:
                  parseBooleanValue(
                    getInlinePropertyValue("progress", directiveArgs, "animate")
                  ) ?? directivePropertyDefault<boolean>("progress", "animate", true),
                style,
                color:
                  getInlinePropertyValue("progress", directiveArgs, "color") ||
                  directivePropertyDefault<string>("progress", "color", "#ec4899"),
                label: getInlinePropertyValue("progress", directiveArgs, "label"),
              };
              sourceMap.progress = { startLine: progressLine, endLine: progressLine };
              i++;
              break;
            }

            case DIRECTIVE_CASES.BACKGROUND: {
              const backgroundLine = i + 1;
              if (directiveArgs) {
                scene.background = directiveArgs;
              }
              i++;
              i = consumeDirectiveTail(lines, i);
              sourceMap.background = { startLine: backgroundLine, endLine: i };
              break;
            }

            case DIRECTIVE_CASES.VAR: {
              i++;
              break;
            }

            case DIRECTIVE_CASES.LOCALE: {
              const { positional } = parseInlineArguments(directiveArgs);
              const locale = firstInlineValue(positional, 0);
              if (locale) {
                scene.locale = locale;
              }
              i++;
              break;
            }

            case DIRECTIVE_CASES.EXPORT: {
              // Skip export directives in scene context - they're for configuration
              i++;
              while (i < lines.length) {
                const exportLine = lines[i].trim();
                if (exportLine.startsWith(DELIMITERS.DIRECTIVE_PREFIX) || exportLine === DELIMITERS.SCENE_SEPARATOR) {
                  break;
                }
                i++;
              }
              break;
            }

            case DIRECTIVE_CASES.SCENE:
            case DIRECTIVE_CASES.LOCALES:
            case DIRECTIVE_CASES.STRINGS:
            case DIRECTIVE_CASES.MUSIC: {
              // Scene boundaries are handled by the outer loop. Global blocks
              // inside a scene are ignored consistently with unknown metadata.
              i++;
              break;
            }

            default:
              assertNever(directive);
          }
        } else {
          i++;
        }
      }

      // Update the scene's end line in sourceMap
      if (sourceMap.scene) {
        sourceMap.scene.endLine = i;
      }

      currentTime += scene.duration;
      scenes.push(scene);
    } else {
      // Handle global directives outside of scenes
      const globalDirective = parseDirective(line);
      const globalDirectiveName = globalDirective?.canonicalName;

      if (globalDirectiveName === DIRECTIVE_CASES.LOCALES) {
        // !locales en es fr - declares the document locales. There is no
        // separate !defaultlocale directive in the schema: the first valid
        // listed locale is the document default. If the directive is repeated,
        // the most recent non-empty valid list replaces the previous one;
        // unlike !strings blocks, locale declarations are not merged.
        const { positional } = parseInlineArguments(globalDirective?.args || "");
        const declaredLocales: string[] = [];
        for (const token of positional) {
          if (isLocalizationToken(token) && !declaredLocales.includes(token)) {
            declaredLocales.push(token);
          }
        }
        if (declaredLocales.length > 0) {
          locales = declaredLocales;
        }
        i++;
      } else if (globalDirectiveName === DIRECTIVE_CASES.STRINGS) {
        // !strings blocks are document metadata. Their indentation-sensitive
        // grammar is parsed from the raw lines; malformed lines are ignored
        // here and reported by the validator. Multiple blocks merge.
        i++;
        const parsedStrings = parseLocalizationStringsBlock(lines, i, variables);
        mergeLocalizationStrings(
          localizationStrings,
          parsedStrings.localizationStrings
        );
        i = parsedStrings.endIndex;
      } else if (globalDirectiveName === DIRECTIVE_CASES.LOCALE) {
        // The schema defines !locale as a scene override, not as a document
        // default. Document-level use is therefore ignored; the default comes
        // from the first entry in !locales.
        i++;
      } else if (globalDirectiveName === DIRECTIVE_CASES.MUSIC) {
        // Exactly one document music track is supported. As with !locales,
        // the most recent syntactically usable declaration replaces the
        // previous one so document order has one unambiguous meaning.
        const parsedMusic = parseMusicTrack(globalDirective?.args || "");
        if (parsedMusic) {
          music = parsedMusic;
        }
        i++;
      } else if (globalDirectiveName === DIRECTIVE_CASES.EXPORT) {
        // !export block - skip for now, handled at application level
        i++;
        while (i < lines.length) {
          const exportLine = lines[i].trim();
          if (exportLine.startsWith(DELIMITERS.DIRECTIVE_PREFIX) || exportLine === DELIMITERS.SCENE_SEPARATOR) {
            break;
          }
          i++;
        }
      } else {
        i++;
      }
    }
  }

  return {
    scenes,
    chapters,
    variables,
    locales,
    localizationStrings,
    defaultLocale: locales[0],
    ...(music ? { music } : {}),
  };
}

// Re-export timeline functions
export { getTimelineSegments, getSceneAtTime } from "./timeline.js";
