import { ASPECT_RATIO_VALUES, isOneOf, type AspectRatio } from "@markdown-video/core";

export interface RenderPageConfig {
  aspectRatio: AspectRatio;
  activeLocale: string | null;
  /**
   * When true, the host composites generated caption cues into every frame
   * through SceneFrame's captions prop (DOM burn-in). When false the frame
   * markup is identical to a host without the feature.
   */
  burnCaptions: boolean;
}

/**
 * Render-time host configuration travels in the URL rather than through extra
 * window.__mv methods. That keeps the capture bridge limited to the documented
 * load/seek/totalDuration contract while still letting the CLI choose the same
 * output aspect ratio and locale the browser export would use.
 */
export function parseRenderPageConfig(search: string): RenderPageConfig {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const requestedAspectRatio = params.get("aspect") ?? params.get("aspectRatio") ?? "16:9";
  const aspectRatio = isOneOf(ASPECT_RATIO_VALUES, requestedAspectRatio)
    ? requestedAspectRatio
    : "16:9";
  const requestedLocale = params.get("locale")?.trim();
  const burnCaptionsParam = params.get("burnCaptions") ?? params.get("burn-captions");

  return {
    aspectRatio,
    activeLocale: requestedLocale ? requestedLocale : null,
    burnCaptions: burnCaptionsParam === "1" || burnCaptionsParam === "true",
  };
}

export function renderPageConfigQuery({
  aspectRatio,
  activeLocale,
  burnCaptions,
}: RenderPageConfig): string {
  const params = new URLSearchParams();
  params.set("aspect", aspectRatio);
  if (activeLocale) {
    params.set("locale", activeLocale);
  }
  if (burnCaptions) {
    params.set("burnCaptions", "1");
  }
  return params.toString();
}
