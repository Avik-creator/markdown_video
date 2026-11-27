"use client";

import { forwardRef, useMemo, useSyncExternalStore } from "react";
import { useVideoStore } from "@/lib/use-video-store";
import {
  getRenderLayoutDimensions,
  getSceneAspectRatioDimensions,
} from "@markdown-video/core";
import {
  calculatePreviewFitTransform,
  previewFitTransformToCss,
} from "./scene-preview/utils/preview-fit";
import { useMeasuredPreviewSize } from "./scene-preview/utils/use-measured-preview-size";
import { cn } from "@/lib/utils";

// Scene composition lives in @markdown-video/scenes; this shell only adds
// editor state, on-screen fitting and zoom around the package's SceneFrame.
import { SceneFrame, getSceneAtTime } from "@markdown-video/scenes";
import {
  getExportCaptionBurnCues,
  getExportCaptionBurnCuesServerSnapshot,
  subscribeExportCaptionBurn,
} from "./export-modal/utils/export-burn-captions";
import { useBrowserAssetSourceResolver } from "@/lib/assets/use-browser-asset-resolver";

// Frame embedding cannot change during the lifetime of a document, so there
// is no external event to subscribe to. useSyncExternalStore still gives us
// the correct hydration contract: the server snapshot is always false, while
// the client snapshot is checked after hydration instead of during the first
// render (which would make embedded and non-embedded markup mismatch).
function subscribeToFrameEmbedding() {
  return () => {};
}

function getEmbeddedClientSnapshot() {
  return typeof window !== "undefined" && window.self !== window.top;
}

function getEmbeddedServerSnapshot() {
  return false;
}

export const ScenePreview = forwardRef<HTMLDivElement, object>(
  function ScenePreview(_, ref) {
    const scenes = useVideoStore((state) => state.scenes);
    const currentTime = useVideoStore((state) => state.currentTime);
    const aspectRatio = useVideoStore((state) => state.aspectRatio);
    const zoom = useVideoStore((state) => state.zoom);
    const locales = useVideoStore((state) => state.locales);
    const localizationStrings = useVideoStore(
      (state) => state.localizationStrings
    );
    const defaultLocale = useVideoStore((state) => state.defaultLocale);
    const activeLocale = useVideoStore((state) => state.activeLocale);

    // Document localization data is editor state; scenes read it through
    // the package's context contract instead of touching the store.
    const sceneLocalization = useMemo(
      () => ({
        strings: localizationStrings,
        locales,
        defaultLocale,
        activeLocale,
      }),
      [localizationStrings, locales, defaultLocale, activeLocale]
    );
    const isEmbedded = useSyncExternalStore(
      subscribeToFrameEmbedding,
      getEmbeddedClientSnapshot,
      getEmbeddedServerSnapshot
    );

    // Caption burn-in exists only while an export capture runs. The cues are
    // absolute-timeline data and the store's currentTime IS the absolute
    // video clock the capture loop seeks through, so the overlay composes
    // exactly what the encoded frame should contain — and nothing at all in
    // normal editing/preview, where no capture state is published.
    const burnCues = useSyncExternalStore(
      subscribeExportCaptionBurn,
      getExportCaptionBurnCues,
      getExportCaptionBurnCuesServerSnapshot
    );

    const { currentScene, sceneTime } = useMemo(
      () => getSceneAtTime(scenes, currentTime),
      [scenes, currentTime]
    );

    const [ratioW, ratioH] = getSceneAspectRatioDimensions(aspectRatio);
    const logicalLayout = useMemo(
      () => getRenderLayoutDimensions(aspectRatio),
      [aspectRatio]
    );
    const { sizingElementRef, size: fittedSize } = useMeasuredPreviewSize(
      currentScene !== null
    );
    const resolveSceneSrc = useBrowserAssetSourceResolver();

    // Embed previews historically ignored the editor zoom control (which is
    // not available there), while editor zoom composes multiplicatively with
    // the fit scale around the center of the reserved display box.
    const fitTransform = useMemo(() => {
      if (!fittedSize) return null;
      return calculatePreviewFitTransform({
        fittedWidth: fittedSize.width,
        fittedHeight: fittedSize.height,
        logicalWidth: logicalLayout.width,
        logicalHeight: logicalLayout.height,
        zoomPercent: isEmbedded ? 100 : zoom,
      });
    }, [fittedSize, logicalLayout, isEmbedded, zoom]);

    // Fit the reserved display box inside the preview area. The editor uses
    // both container dimensions and keeps the historical 56rem cap. Embeds are
    // width-driven instead: their outer box may scroll vertically, so a short
    // iframe still gets the full embed width rather than side-letterboxing.
    // cqw/cqh are the container's content box, set up by containerType below.
    const fitWidth = isEmbedded
      ? "100cqw"
      : `min(100cqw, calc(100cqh * ${ratioW} / ${ratioH}), 56rem)`;

    if (!currentScene) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#0d0d12]">
          <p className="text-muted-foreground">No scenes to preview</p>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "flex-1 min-h-0 min-w-0 flex bg-[#0d0d12]",
          isEmbedded
            ? "p-2 overflow-auto"
            : "items-center justify-center p-4 overflow-hidden"
        )}
        style={{ containerType: "size" }}
      >
        {/* This shell reserves exactly the on-screen fitted size in layout.
            The scene inside it is deliberately oversized: it is composed in
            the same logical coordinate space used by exports and then scaled
            down as a finished frame. */}
        <div
          ref={sizingElementRef}
          data-scene-preview-fit="true"
          className={cn("relative shrink-0", isEmbedded && "m-auto")}
          style={{
            width: fitWidth,
            aspectRatio: `${ratioW} / ${ratioH}`,
          }}
        >
          <SceneFrame
            ref={ref}
            scene={currentScene}
            sceneTime={sceneTime}
            aspectRatio={aspectRatio}
            localization={sceneLocalization}
            resolveSrc={resolveSceneSrc}
            {...(burnCues
              ? { captions: { cues: burnCues, time: currentTime } }
              : {})}
            className="absolute left-0 top-0"
            style={{
              transform: fitTransform
                ? previewFitTransformToCss(fitTransform)
                : "none",
              transformOrigin: "0 0",
              // The first RO measurement normally happens in a layout effect
              // before paint. If it has not completed (or the box is currently
              // zero-sized), show nothing rather than flashing an unscaled
              // 1920px-wide composition inside the editor layout.
              visibility: fitTransform ? "visible" : "hidden",
            }}
          />
        </div>
      </div>
    );
  }
);
