import {
  getTimelineSegments,
  parseMarkdownFull,
  type ParseResult,
} from "@markdown-video/core";
import {
  getSceneAtTime,
  SceneFrame,
} from "@markdown-video/scenes";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { RenderPageConfig } from "./render-config";

export const MAX_RENDER_MARKDOWN_BYTES = 2 * 1024 * 1024;

/**
 * The nine Google families next/font serves in the editor. Keeping this list
 * beside the loader makes a missing @font-face rule fail during load() rather
 * than after hundreds of frames have silently been rasterized in a fallback.
 */
export const REQUIRED_RENDER_FONT_FAMILIES = [
  "Inter",
  "Playfair Display",
  "Merriweather",
  "IBM Plex Mono",
  "Geist Mono",
  "JetBrains Mono",
  "Fira Code",
  "Source Code Pro",
  "Inconsolata",
] as const;

// Scene typography uses regular through bold weights. IBM Plex Mono is the
// only non-variable family here, so loading the full range also verifies that
// all four of its static weight files are present.
const REQUIRED_FONT_WEIGHTS = [400, 500, 600, 700] as const;
const FONT_TEST_STRING = "Markdown Video 123";

interface RenderDocumentState {
  parsed: ParseResult;
  time: number;
}

interface RenderHostApi {
  setState: (next: RenderDocumentState | null) => void;
}

let hostApi: RenderHostApi | null = null;
let resolveHostReady: (api: RenderHostApi) => void = () => undefined;
const hostReady = new Promise<RenderHostApi>((resolve) => {
  resolveHostReady = resolve;
});
let activeParsed: ParseResult | null = null;
let operationQueue: Promise<void> = Promise.resolve();

function registerHost(api: RenderHostApi) {
  hostApi = api;
  resolveHostReady(api);
}

function unregisterHost(api: RenderHostApi) {
  if (hostApi === api) {
    hostApi = null;
  }
}

function enqueueRenderOperation<T>(operation: (api: RenderHostApi) => Promise<T>): Promise<T> {
  const result = operationQueue.then(async () => operation(await hostReady));
  operationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function commitRenderState(api: RenderHostApi, next: RenderDocumentState | null) {
  // load/seek are invoked by the headless driver outside React events and
  // lifecycles, so flushSync is safe here and gives the driver a real commit
  // boundary instead of a merely scheduled concurrent render.
  flushSync(() => {
    api.setState(next);
  });
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/**
 * Wait for the capture-relevant settling point after a commit: pending font
 * loads complete, then one animation frame gives React passive effects (notably
 * the transition controls.set writes) a chance to flush before paint/capture.
 */
async function waitForCommittedFrame() {
  await document.fonts.ready;
  await nextAnimationFrame();
}

async function assertRequiredFontsLoaded() {
  const loadFailures: string[] = [];

  await Promise.all(
    REQUIRED_RENDER_FONT_FAMILIES.flatMap((family) =>
      REQUIRED_FONT_WEIGHTS.map(async (weight) => {
        const fontFaceSet = await document.fonts
          .load(`${weight} 16px "${family}"`, FONT_TEST_STRING)
          .catch(() => [] as FontFace[]);

        if (fontFaceSet.length === 0) {
          loadFailures.push(`${family} ${weight}`);
        }
      })
    )
  );

  await document.fonts.ready;

  const checkFailures = REQUIRED_RENDER_FONT_FAMILIES.flatMap((family) =>
    REQUIRED_FONT_WEIGHTS.filter(
      (weight) => !document.fonts.check(`${weight} 16px "${family}"`, FONT_TEST_STRING)
    ).map((weight) => `${family} ${weight}`)
  );

  const failures = [...new Set([...loadFailures, ...checkFailures])];
  if (failures.length > 0) {
    throw new Error(`Required render fonts did not load: ${failures.join(", ")}`);
  }
}

async function loadMarkdown(api: RenderHostApi, markdown: string): Promise<number> {
  if (typeof markdown !== "string") {
    throw new TypeError("window.__mv.load(markdown) requires a markdown string");
  }
  if (new TextEncoder().encode(markdown).byteLength > MAX_RENDER_MARKDOWN_BYTES) {
    throw new Error(`Markdown input exceeds ${MAX_RENDER_MARKDOWN_BYTES} bytes`);
  }

  const parsed = parseMarkdownFull(markdown);
  const { totalDuration } = getTimelineSegments(parsed.scenes);

  commitRenderState(api, { parsed, time: 0 });
  activeParsed = parsed;
  markdownVideoRenderBridge.totalDuration = totalDuration;

  // Verify the complete host font contract once per document. Seeks can then
  // stay cheap while still failing loudly if a font file or variable is wrong.
  await assertRequiredFontsLoaded();
  await waitForCommittedFrame();

  return totalDuration;
}

async function seekToTime(api: RenderHostApi, time: number): Promise<void> {
  if (!activeParsed) {
    throw new Error("window.__mv.load(markdown) must finish before seek(t)");
  }
  if (!Number.isFinite(time) || time < 0) {
    throw new TypeError("window.__mv.seek(t) requires a finite non-negative time in seconds");
  }

  commitRenderState(api, { parsed: activeParsed, time });
  await waitForCommittedFrame();
}

export interface MarkdownVideoRenderBridge {
  load: (markdown: string) => Promise<number>;
  seek: (time: number) => Promise<void>;
  totalDuration: number;
}

/**
 * Public capture bridge. Operations are serialized because seek screenshots
 * are inherently ordered; a later seek must never commit before an earlier one
 * has reached its capture-ready animation frame.
 */
export const markdownVideoRenderBridge: MarkdownVideoRenderBridge = {
  totalDuration: 0,
  load(markdown) {
    return enqueueRenderOperation((api) => loadMarkdown(api, markdown));
  },
  seek(time) {
    return enqueueRenderOperation((api) => seekToTime(api, time));
  },
};

export function RenderHost({ config }: { config: RenderPageConfig }) {
  const [state, setState] = useState<RenderDocumentState | null>(null);

  useEffect(() => {
    const api: RenderHostApi = {
      setState: (next) => setState(next),
    };
    registerHost(api);
    return () => unregisterHost(api);
  }, []);

  if (!state) {
    return null;
  }

  const { currentScene, sceneTime } = getSceneAtTime(state.parsed.scenes, state.time);
  if (!currentScene) {
    return null;
  }

  return (
    <SceneFrame
      scene={currentScene}
      sceneTime={sceneTime}
      aspectRatio={config.aspectRatio}
      localization={{
        strings: state.parsed.localizationStrings,
        locales: state.parsed.locales,
        defaultLocale: state.parsed.defaultLocale,
        activeLocale: config.activeLocale,
      }}
      style={{
        // The browser exporter squares the capture clone so JPEG frames contain
        // scene pixels rather than a black matte in rounded corners. The render
        // page uses the same capture surface; the editor-only rounded shell is
        // display chrome, not part of the video.
        borderRadius: 0,
        boxShadow: "none",
      }}
    />
  );
}
