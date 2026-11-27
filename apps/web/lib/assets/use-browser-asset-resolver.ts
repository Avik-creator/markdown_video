"use client";

import { useEffect } from "react";
import type { SceneSourceResolver } from "@markdown-video/scenes";
import { ensureAssetLibraryLoaded, useAssetLibrary } from "./asset-library";
import { resolveBrowserAssetSrcSync } from "./asset-resolution";

/**
 * SceneFrame resolver for the browser host. It subscribes both to library
 * membership and lazy object-url completion, because IndexedDB cannot provide
 * a synchronous URL on the first render.
 */
export function useBrowserAssetSourceResolver(): SceneSourceResolver {
  // These values are intentionally not read here. The subscriptions make the
  // host re-render after upload/delete and after a blob object-url is warmed;
  // the pure resolver always reads the freshest store state.
  useAssetLibrary((state) => state.assets);
  useAssetLibrary((state) => state.resolutionRevision);

  useEffect(() => {
    void ensureAssetLibraryLoaded();
  }, []);

  return resolveBrowserAssetSrcSync;
}
