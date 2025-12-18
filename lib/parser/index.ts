// Main markdown parser
// Parses custom markdown syntax into scene objects

import type {
  Scene,
  TransitionType,
  AnimationType,
  TerminalCommand,
  ChartType,
  ParticleType,
  DeviceType,
  CameraEffect,
  PresenterPosition,
  Chapter,
  VideoVariables,
} from "../types";
import { SCENE_COLORS, SCENE_DIRECTIVES } from "./constants";
import {
  generateId,
  normalizeDirective,
  parseKeyValue,
  substituteVariables,
} from "./utils";
import {
  parseCodeBlock,
  parseHighlights,
  parseAnnotations,
  parseTerminalBlock,
  parseDiffBlock,
  parseChartData,
} from "./parsers";

export interface ParseResult {
  scenes: Scene[];
  chapters: Chapter[];
  variables: VideoVariables;
}

export function parseMarkdown(markdown: string): Scene[] {
  const result = parseMarkdownFull(markdown);
  return result.scenes;
}

export function parseMarkdownFull(markdown: string): ParseResult {
  const scenes: Scene[] = [];
  const chapters: Chapter[] = [];
  const variables: VideoVariables = {};
  const lines = markdown.split("\n");
  let i = 0;
  let colorIndex = 0;
  let currentTime = 0;

  // First pass: collect variables
  for (const line of lines) {
    const match = line.match(/^!var\s+(\w+)\s+(.+)$/);
    if (match) {
      variables[match[1]] = match[2].trim();
    }
  }

  while (i < lines.length) {
    let line = lines[i].trim();

    // Variable substitution
    line = substituteVariables(line, variables);

    // Check for scene directive (with aliases)
    const isSceneDirective = SCENE_DIRECTIVES.some((dir) =>
      line.startsWith(`!${dir}`)
    );

    if (isSceneDirective) {
      const scene: Scene = {
        id: generateId(),
        type: "text",
        duration: 3,
        background: SCENE_COLORS[colorIndex % SCENE_COLORS.length],
      };
      colorIndex++;
      i++;

      // Parse scene properties
      while (i < lines.length) {
        const currentLine = substituteVariables(lines[i].trim(), variables);

        // End of scene or next scene (check for all scene aliases)
        const isNextScene = SCENE_DIRECTIVES.some((dir) =>
          currentLine.startsWith(`!${dir}`)
        );
        if (isNextScene || currentLine === "---") {
          break;
        }

        // Parse directives
        if (currentLine.startsWith("!")) {
          const directiveMatch = currentLine.match(/^!(\w+)/);
          const rawDirective = directiveMatch ? directiveMatch[1] : "";
          const directive = normalizeDirective(rawDirective);

          switch (directive) {
            case "chapter": {
              const match = currentLine.match(/!chapter\s+"([^"]+)"/);
              if (match) {
                scene.chapter = match[1];
                chapters.push({
                  id: generateId(),
                  title: match[1],
                  time: currentTime,
                });
              }
              i++;
              break;
            }

            case "transition": {
              const match = currentLine.match(
                /!transition\s+(\w+)(?:\s+(\d+(?:\.\d+)?)s)?/
              );
              if (match) {
                scene.transition = match[1] as TransitionType;
                if (match[2]) {
                  scene.transitionDuration = Number.parseFloat(match[2]);
                }
              }
              i++;
              break;
            }

            case "duration": {
              const match = currentLine.match(/!duration\s+(\d+(?:\.\d+)?)s?/);
              if (match) {
                scene.duration = Number.parseFloat(match[1]);
              }
              i++;
              break;
            }

            case "text": {
              scene.type = "text";
              const textContent: string[] = [];
              let animation: AnimationType = "fadeIn";
              let size: "sm" | "md" | "lg" | "xl" | "2xl" = "lg";
              let color: string | undefined;
              let fontFamily: "serif" | "sans" | "mono" | "display" | undefined;
              let stagger: number | undefined;
              let at: number | undefined;
              let duration: number | undefined;
              let i18nKey: string | undefined;

              // Check for inline format: !text "content" at:0s duration:1.5s
              const inlineMatch = currentLine.match(/!text\s+"([^"]+)"(.*)$/);
              if (inlineMatch) {
                const inlineContent = inlineMatch[1];
                const inlineParams = inlineMatch[2];
                const atMatch = inlineParams.match(/at:([\d.]+)s?/);
                const durationMatch = inlineParams.match(/duration:([\d.]+)s?/);
                const animMatch = inlineParams.match(/animation:(\w+)/);

                if (atMatch && durationMatch) {
                  if (!scene.timelineElements) {
                    scene.timelineElements = [];
                  }
                  scene.timelineElements.push({
                    id: generateId(),
                    type: "text",
                    content: inlineContent,
                    at: Number.parseFloat(atMatch[1]),
                    duration: Number.parseFloat(durationMatch[1]),
                    animation: animMatch
                      ? (animMatch[1] as AnimationType)
                      : "fadeIn",
                  });
                  i++;
                  break;
                }
              }

              // Check for i18n key format: !text i18n:welcome
              const i18nMatch = currentLine.match(/!text\s+i18n:(\w+)/);
              if (i18nMatch) {
                i18nKey = i18nMatch[1];
              }

              i++;

              while (i < lines.length) {
                const textLine = substituteVariables(
                  lines[i].trim(),
                  variables
                );
                if (textLine.startsWith("!") || textLine === "---") {
                  break;
                }

                const kv = parseKeyValue(textLine);
                if (kv) {
                  if (kv.key === "animation")
                    animation = kv.value as AnimationType;
                  if (kv.key === "size")
                    size = kv.value as "sm" | "md" | "lg" | "xl" | "2xl";
                  if (kv.key === "color") color = kv.value;
                  if (kv.key === "fontfamily") {
                    const validFonts = ["serif", "sans", "mono", "display"];
                    if (validFonts.includes(kv.value.toLowerCase())) {
                      fontFamily = kv.value.toLowerCase() as
                        | "serif"
                        | "sans"
                        | "mono"
                        | "display";
                    }
                  }
                  if (kv.key === "stagger")
                    stagger = Number.parseFloat(kv.value);
                  if (kv.key === "at") at = Number.parseFloat(kv.value);
                  if (kv.key === "duration")
                    duration = Number.parseFloat(kv.value);
                  if (kv.key === "i18n" || kv.key === "i18nKey")
                    i18nKey = kv.value;
                } else if (textLine) {
                  textContent.push(textLine);
                }
                i++;
              }

              scene.text = {
                content: textContent.join("\n"),
                animation,
                size,
                align: "center",
                color,
                fontFamily: fontFamily || "serif",
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

            case "code": {
              scene.type = "code";
              i++;
              let highlights: { lines: number[] } | undefined;
              let annotations: Array<{ line: number; text: string }> = [];
              let typing = false;
              let typingSpeed = 50;
              let fontSize: "xs" | "sm" | "md" | "lg" = "sm";
              let fontFamily:
                | "mono"
                | "jetbrains"
                | "fira"
                | "source"
                | "inconsolata"
                | "courier" = "mono";
              let height: number | undefined;
              let width: number | undefined;

              while (i < lines.length) {
                const codeLine = substituteVariables(
                  lines[i].trim(),
                  variables
                );

                if (codeLine.startsWith("```")) {
                  const parsed = parseCodeBlock(lines, i);
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
                  break;
                } else if (codeLine.startsWith("highlight:")) {
                  highlights = parseHighlights(codeLine.substring(10));
                  i++;
                } else if (codeLine.startsWith("annotations:")) {
                  i++;
                  const parsed = parseAnnotations(lines, i);
                  annotations = parsed.annotations;
                  i = parsed.endIndex;
                } else if (codeLine.startsWith("typing:")) {
                  typing = codeLine.substring(7).trim() === "true";
                  i++;
                } else if (codeLine.startsWith("speed:")) {
                  typingSpeed = Number.parseInt(
                    codeLine.substring(6).trim(),
                    10
                  );
                  i++;
                } else if (codeLine.startsWith("fontSize:")) {
                  fontSize = codeLine.substring(9).trim() as
                    | "xs"
                    | "sm"
                    | "md"
                    | "lg";
                  i++;
                } else if (codeLine.toLowerCase().startsWith("fontfamily:")) {
                  const fontValue = codeLine.substring(11).trim().toLowerCase();
                  const validCodeFonts = [
                    "mono",
                    "jetbrains",
                    "fira",
                    "source",
                    "inconsolata",
                    "courier",
                  ];
                  if (validCodeFonts.includes(fontValue)) {
                    fontFamily = fontValue as
                      | "mono"
                      | "jetbrains"
                      | "fira"
                      | "source"
                      | "inconsolata"
                      | "courier";
                  }
                  i++;
                } else if (codeLine.startsWith("height:")) {
                  height = Number.parseInt(codeLine.substring(7).trim(), 10);
                  i++;
                } else if (codeLine.startsWith("width:")) {
                  width = Number.parseInt(codeLine.substring(6).trim(), 10);
                  i++;
                } else {
                  i++;
                }
              }
              break;
            }

            case "terminal": {
              scene.type = "terminal";
              i++;
              let typing = true;
              let typingSpeed = 30;

              while (i < lines.length) {
                const termLine = lines[i].trim();
                if (termLine.startsWith("typing:")) {
                  typing = termLine.substring(7).trim() === "true";
                  i++;
                } else if (termLine.startsWith("speed:")) {
                  typingSpeed = Number.parseInt(
                    termLine.substring(6).trim(),
                    10
                  );
                  i++;
                } else if (
                  termLine.startsWith("$") ||
                  termLine.startsWith(">")
                ) {
                  const parsed = parseTerminalBlock(lines, i);
                  scene.terminal = {
                    commands: parsed.commands,
                    typing,
                    typingSpeed,
                  };
                  i = parsed.endIndex;
                  break;
                } else if (termLine.startsWith("!") || termLine === "---") {
                  break;
                } else {
                  i++;
                }
              }
              break;
            }

            case "diff": {
              scene.type = "diff";
              const langMatch = currentLine.match(/!diff\s+(\w+)?/);
              i++;

              const parsed = parseDiffBlock(lines, i);
              scene.diff = {
                language: langMatch?.[1] || "text",
                changes: parsed.changes,
              };
              i = parsed.endIndex;
              break;
            }

            case "chart": {
              scene.type = "chart";
              const typeMatch = currentLine.match(/type:(\w+)/);
              const animateMatch = currentLine.match(/animate:(true|false)/);
              i++;

              const parsed = parseChartData(lines, i);
              scene.chart = {
                type: (typeMatch?.[1] || "bar") as ChartType,
                data: parsed.data,
                animate: animateMatch?.[1] !== "false",
              };
              i = parsed.endIndex;
              break;
            }

            case "mockup": {
              scene.type = "mockup";
              const deviceMatch = currentLine.match(/device:(\w+)/);
              const bgMatch = currentLine.match(/bg:(\S+)/);
              i++;

              // Parse mockup content
              let contentType: "text" | "code" | "image" = "text";
              let contentBg = bgMatch?.[1] || "#ffffff";
              const textContent: string[] = [];
              let textColor: string | undefined;
              let textSize: "sm" | "md" | "lg" | "xl" | "2xl" = "md";
              let imageSrc: string | undefined;
              let imageFit: "cover" | "contain" | "fill" = "cover";

              while (i < lines.length) {
                const mockupLine = substituteVariables(
                  lines[i].trim(),
                  variables
                );
                if (mockupLine.startsWith("!") || mockupLine === "---") {
                  break;
                }

                const kv = parseKeyValue(mockupLine);
                if (kv) {
                  if (kv.key === "content")
                    contentType = kv.value as "text" | "code" | "image";
                  if (kv.key === "bg" || kv.key === "background")
                    contentBg = kv.value;
                  if (kv.key === "color") textColor = kv.value;
                  if (kv.key === "size")
                    textSize = kv.value as "sm" | "md" | "lg" | "xl" | "2xl";
                  if (kv.key === "src" || kv.key === "image") {
                    imageSrc = kv.value;
                    contentType = "image";
                  }
                  if (kv.key === "fit")
                    imageFit = kv.value as "cover" | "contain" | "fill";
                } else if (mockupLine) {
                  textContent.push(mockupLine);
                }
                i++;
              }

              scene.mockup = {
                device: (deviceMatch?.[1] || "browser") as DeviceType,
                content: {
                  type: contentType,
                  background: contentBg,
                  text:
                    contentType === "text" && textContent.length > 0
                      ? {
                          content: textContent.join("\n"),
                          color: textColor,
                          size: textSize,
                          align: "center",
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

            case "callout": {
              const arrowMatch = currentLine.match(/arrow:(\w+)/);
              const targetMatch = currentLine.match(/target:(\S+)/);
              const textMatch = currentLine.match(/"([^"]+)"/);

              scene.callout = {
                text: textMatch?.[1] || "",
                arrow: (arrowMatch?.[1] || "down") as
                  | "up"
                  | "down"
                  | "left"
                  | "right",
                target: targetMatch?.[1],
                style: "info",
              };
              i++;
              break;
            }

            case "particles": {
              const typeMatch = currentLine.match(/type:(\w+)/);
              const intensityMatch = currentLine.match(/intensity:(\w+)/);

              scene.particles = {
                type: (typeMatch?.[1] || "confetti") as ParticleType,
                intensity: (intensityMatch?.[1] || "medium") as
                  | "low"
                  | "medium"
                  | "high",
              };
              i++;
              break;
            }

            case "camera": {
              const effectMatch = currentLine.match(/(zoom|pan|shake)/);
              const valueMatch = currentLine.match(/:([\d.]+)/);
              const durationMatch = currentLine.match(/duration:([\d.]+)s?/);

              // Check if this is a keyframe-based camera (starts with -)
              const keyframes = [];
              i++;

              while (i < lines.length) {
                const cameraLine = lines[i].trim();
                if (cameraLine.startsWith("-")) {
                  // Parse keyframe: - at:0s zoom:1 pan:left
                  const atMatch = cameraLine.match(/at:([\d.]+)s?/);
                  const zoomMatch = cameraLine.match(/zoom:([\d.]+)/);
                  const panMatch = cameraLine.match(/pan:(\w+)/);
                  const shakeMatch = cameraLine.match(/shake:(true|false)/);
                  const shakeIntensityMatch =
                    cameraLine.match(/shakeIntensity:(\w+)/);

                  if (atMatch) {
                    keyframes.push({
                      at: Number.parseFloat(atMatch[1]),
                      zoom: zoomMatch
                        ? Number.parseFloat(zoomMatch[1])
                        : undefined,
                      pan: panMatch ? (panMatch[1] as any) : undefined,
                      shake: shakeMatch ? shakeMatch[1] === "true" : undefined,
                      shakeIntensity: shakeIntensityMatch
                        ? (shakeIntensityMatch[1] as any)
                        : undefined,
                    });
                  }
                  i++;
                } else if (cameraLine.startsWith("!") || cameraLine === "---") {
                  break;
                } else {
                  i++;
                }
              }

              scene.camera = {
                effect: (effectMatch?.[1] || "zoom") as CameraEffect,
                value: valueMatch ? Number.parseFloat(valueMatch[1]) : 1.5,
                duration: durationMatch
                  ? Number.parseFloat(durationMatch[1])
                  : 1,
                keyframes: keyframes.length > 0 ? keyframes : undefined,
              };
              break;
            }

            case "presenter": {
              const posMatch = currentLine.match(/position:(\S+)/);
              const sizeMatch = currentLine.match(/size:(\w+)/);
              const shapeMatch = currentLine.match(/shape:(\w+)/);

              scene.presenter = {
                position: (posMatch?.[1] ||
                  "bottom-right") as PresenterPosition,
                size: (sizeMatch?.[1] || "md") as "sm" | "md" | "lg",
                shape: (shapeMatch?.[1] || "circle") as
                  | "circle"
                  | "square"
                  | "rounded",
              };
              i++;
              break;
            }

            case "layout": {
              scene.type = "split";
              const dirMatch = currentLine.match(/split:(\w+)/);
              scene.split = {
                left: { type: "text", background: "#1e1e2e" },
                right: { type: "text", background: "#1e1e2e" },
                direction:
                  dirMatch?.[1] === "vertical" ? "vertical" : "horizontal",
                ratio: 0.5,
              };
              i++;
              break;
            }

            case "image": {
              scene.type = "image";
              const srcMatch = currentLine.match(/src:(\S+)/);
              const fitMatch = currentLine.match(/fit:(cover|contain|fill)/);
              const posMatch = currentLine.match(
                /position:(center|top|bottom|left|right)/
              );
              const altMatch = currentLine.match(/alt:"([^"]+)"/);

              scene.image = {
                src: srcMatch?.[1] || "",
                fit: (fitMatch?.[1] as "cover" | "contain" | "fill") || "cover",
                position:
                  (posMatch?.[1] as
                    | "center"
                    | "top"
                    | "bottom"
                    | "left"
                    | "right") || "center",
                alt: altMatch?.[1],
              };
              i++;
              break;
            }

            case "emoji": {
              const emojiMatch = currentLine.match(/!emoji\s+(\S+)/);
              const sizeMatch = currentLine.match(/size:(sm|md|lg|xl|2xl)/);
              const animateMatch = currentLine.match(
                /animate:(bounce|spin|pulse|shake|none)/
              );
              const atMatch = currentLine.match(/at:([\d.]+)s?/);
              const durationMatch = currentLine.match(/duration:([\d.]+)s?/);

              scene.emoji = {
                emoji: emojiMatch?.[1] || "🎉",
                size:
                  (sizeMatch?.[1] as "sm" | "md" | "lg" | "xl" | "2xl") || "xl",
                animate:
                  (animateMatch?.[1] as
                    | "bounce"
                    | "spin"
                    | "pulse"
                    | "shake"
                    | "none") || "none",
              };

              // If at: and duration: are specified, add to timelineElements
              if (atMatch && durationMatch) {
                if (!scene.timelineElements) {
                  scene.timelineElements = [];
                }
                scene.timelineElements.push({
                  id: generateId(),
                  type: "emoji",
                  content: emojiMatch?.[1] || "🎉",
                  at: Number.parseFloat(atMatch[1]),
                  duration: Number.parseFloat(durationMatch[1]),
                });
              }
              i++;
              break;
            }

            case "qr": {
              scene.type = "qr";
              const urlMatch = currentLine.match(/url:(\S+)/);
              const sizeMatch = currentLine.match(/size:(\d+)/);
              const colorMatch = currentLine.match(/color:(\S+)/);
              const bgMatch = currentLine.match(/bg:(\S+)/);
              const labelMatch = currentLine.match(/label:"([^"]+)"/);

              scene.qr = {
                url: urlMatch?.[1] || "https://example.com",
                size: sizeMatch ? Number.parseInt(sizeMatch[1], 10) : 200,
                color: colorMatch?.[1] || "#ffffff",
                bgColor: bgMatch?.[1] || "transparent",
                label: labelMatch?.[1],
              };
              i++;
              break;
            }

            case "countdown": {
              scene.type = "countdown";
              const fromMatch = currentLine.match(/from:(\d+)/);
              const styleMatch = currentLine.match(
                /style:(digital|circle|minimal)/
              );
              const colorMatch = currentLine.match(/color:(\S+)/);

              scene.countdown = {
                from: fromMatch ? Number.parseInt(fromMatch[1], 10) : 10,
                style:
                  (styleMatch?.[1] as "digital" | "circle" | "minimal") ||
                  "digital",
                color: colorMatch?.[1] || "#ec4899",
              };
              i++;
              break;
            }

            case "progress": {
              scene.type = "progress";
              const valueMatch = currentLine.match(/value:(\d+)/);
              const maxMatch = currentLine.match(/max:(\d+)/);
              const animateMatch = currentLine.match(/animate:(true|false)/);
              const styleMatch = currentLine.match(
                /style:(bar|circle|semicircle)/
              );
              const colorMatch = currentLine.match(/color:(\S+)/);
              const labelMatch = currentLine.match(/label:"([^"]+)"/);

              scene.progress = {
                value: valueMatch ? Number.parseInt(valueMatch[1], 10) : 50,
                max: maxMatch ? Number.parseInt(maxMatch[1], 10) : 100,
                animate: animateMatch?.[1] !== "false",
                style:
                  (styleMatch?.[1] as "bar" | "circle" | "semicircle") || "bar",
                color: colorMatch?.[1] || "#ec4899",
                label: labelMatch?.[1],
              };
              i++;
              break;
            }

            case "background": {
              const match = currentLine.match(/!background\s+(.+)/);
              if (match) {
                scene.background = substituteVariables(
                  match[1].trim(),
                  variables
                );
              }
              i++;
              break;
            }

            case "var": {
              i++;
              break;
            }

            case "locale": {
              const match = currentLine.match(/!locale\s+(\w+)/);
              if (match) {
                scene.locale = match[1];
              }
              i++;
              break;
            }

            case "export": {
              // Skip export directives in scene context - they're for configuration
              i++;
              while (i < lines.length) {
                const exportLine = lines[i].trim();
                if (exportLine.startsWith("!") || exportLine === "---") {
                  break;
                }
                i++;
              }
              break;
            }

            default:
              i++;
          }
        } else {
          i++;
        }
      }

      currentTime += scene.duration;
      scenes.push(scene);
    } else {
      // Handle global directives outside of scenes
      if (line.startsWith("!locales")) {
        // !locales en es fr de - defines supported locales
        // This is handled at the application level, not in parser
        i++;
      } else if (line.startsWith("!strings")) {
        // !strings block - skip for now, handled at application level
        i++;
        while (i < lines.length) {
          const strLine = lines[i].trim();
          if (strLine.startsWith("!") || strLine === "---") {
            break;
          }
          i++;
        }
      } else if (line.startsWith("!export")) {
        // !export block - skip for now, handled at application level
        i++;
        while (i < lines.length) {
          const exportLine = lines[i].trim();
          if (exportLine.startsWith("!") || exportLine === "---") {
            break;
          }
          i++;
        }
      } else {
        i++;
      }
    }
  }

  return { scenes, chapters, variables };
}

// Re-export timeline functions
export { getTimelineSegments, getSceneAtTime } from "./timeline";
