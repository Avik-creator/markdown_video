import { ASPECT_RATIO_VALUES, isOneOf, type AspectRatio } from "@markdown-video/core";

export interface RenderPageConfig {
  aspectRatio: AspectRatio;
  activeLocale: string | null;
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

  return {
    aspectRatio,
    activeLocale: requestedLocale ? requestedLocale : null,
  };
}

export function renderPageConfigQuery({
  aspectRatio,
  activeLocale,
}: RenderPageConfig): string {
  const params = new URLSearchParams();
  params.set("aspect", aspectRatio);
  if (activeLocale) {
    params.set("locale", activeLocale);
  }
  return params.toString();
}
