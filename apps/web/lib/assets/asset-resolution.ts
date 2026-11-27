import {
  ensureAssetLibraryLoaded,
  getAssetStoreBackend,
  useAssetLibrary,
} from "./asset-library";
import {
  getCachedAssetObjectUrl,
  setCachedAssetObjectUrl,
} from "./asset-object-urls";
import {
  normalizeRelativeAssetFilename,
  type AssetMetadata,
} from "./asset-store";
import {
  extractRelativeAssetReferences,
  uniqueAssetReferences,
} from "./asset-references";

export type AssetSourceProvenance =
  | "asset-store"
  | "static"
  | "remote"
  | "data"
  | "blob";

export interface BrowserAssetSourceResolution {
  input: string;
  /** URL suitable for a media element or fetch in this browser session. */
  url: string;
  provenance: AssetSourceProvenance;
  /** Normalized asset filename for same-tree relative references. */
  filename?: string;
  asset?: AssetMetadata;
}

/** Classify a source without doing storage or network I/O. */
export function classifyAssetSource(
  src: string,
  currentOrigin?: string
): Exclude<AssetSourceProvenance, "asset-store"> {
  const trimmed = src.trim();
  if (/^data:/i.test(trimmed)) return "data";
  if (/^blob:/i.test(trimmed)) return "blob";

  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed) || trimmed.startsWith("//")) {
    try {
      const url = new URL(trimmed, currentOrigin ?? "https://invalid.local");
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        currentOrigin &&
        url.origin === currentOrigin
      ) {
        return "static";
      }
    } catch {
      // Invalid absolute URLs are still not document-relative assets.
    }
    return "remote";
  }

  return "static";
}

const pendingObjectUrls = new Map<string, Promise<string | null>>();

/**
 * Read an asset blob lazily and expose it as one cached object URL. The URL is
 * revoked only when the asset is deleted; repeated seeks/renders share it.
 */
export function getAssetObjectUrl(assetId: string): Promise<string | null> {
  const cached = getCachedAssetObjectUrl(assetId);
  if (cached) return Promise.resolve(cached);

  const pending = pendingObjectUrls.get(assetId);
  if (pending) return pending;

  const request = (async () => {
    const record = await getAssetStoreBackend().getRecord(assetId);
    if (!record) return null;

    // Deletion can race IndexedDB reads. Never publish a URL for an asset the
    // library no longer advertises; deleteAsset revokes already-published URLs.
    if (!useAssetLibrary.getState().assets.some((asset) => asset.id === assetId)) {
      return null;
    }
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      return null;
    }

    const url = URL.createObjectURL(record.blob);
    setCachedAssetObjectUrl(assetId, url);
    useAssetLibrary.getState().noteResolutionChanged();
    return url;
  })().finally(() => {
    pendingObjectUrls.delete(assetId);
  });

  pendingObjectUrls.set(assetId, request);
  return request;
}

/**
 * Resolve browser media in documented order: uploaded IndexedDB asset first
 * for same-tree relative paths, then the existing same-origin/static,
 * remote, data: and blob: behavior.
 */
export async function resolveBrowserAssetSource(
  src: string
): Promise<BrowserAssetSourceResolution> {
  const input = src.trim();
  const filename = normalizeRelativeAssetFilename(input);
  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : undefined;

  if (filename) {
    const libraryReady = await ensureAssetLibraryLoaded();
    if (libraryReady) {
      const asset = useAssetLibrary
        .getState()
        .assets.find((candidate) => candidate.filename === filename);
      if (asset) {
        const objectUrl = await getAssetObjectUrl(asset.id);
        if (objectUrl) {
          return {
            input,
            url: objectUrl,
            provenance: "asset-store",
            filename,
            asset,
          };
        }
        throw new Error(
          `Uploaded asset "./${filename}" could not be read from browser storage.`
        );
      }
    }
  }

  return {
    input,
    url: input,
    provenance: classifyAssetSource(input, currentOrigin),
    ...(filename ? { filename } : {}),
  };
}

/**
 * Synchronous render-time view of the same resolution order. IndexedDB is
 * inherently asynchronous, so this returns a cached object URL when warm,
 * starts warming it, and temporarily falls back to the original static path.
 * `resolutionRevision` triggers a host re-render when the URL becomes ready.
 */
export function resolveBrowserAssetSrcSync(src: string): string {
  const filename = normalizeRelativeAssetFilename(src);
  if (!filename) return src;

  const asset = useAssetLibrary
    .getState()
    .assets.find((candidate) => candidate.filename === filename);
  if (!asset) return src;

  const cached = getCachedAssetObjectUrl(asset.id);
  if (cached) return cached;

  void getAssetObjectUrl(asset.id).catch((error) => {
    console.warn(`[markdown-video] Could not read uploaded asset "./${filename}":`, error);
  });
  return src;
}


/**
 * Warm every uploaded asset referenced by a markdown document. Export uses
 * this before deterministic frame capture so first-use IndexedDB latency can
 * never race a small number of animation frames.
 */
export async function warmBrowserAssetSources(markdown: string): Promise<void> {
  const ready = await ensureAssetLibraryLoaded();
  if (!ready) return;
  const assets = useAssetLibrary.getState().assets;
  const warmups: Promise<unknown>[] = [];

  for (const reference of uniqueAssetReferences(extractRelativeAssetReferences(markdown))) {
    const asset = assets.find((candidate) => candidate.filename === reference.filename);
    if (asset) warmups.push(getAssetObjectUrl(asset.id));
  }
  await Promise.all(warmups);
}

/** Test hook for pending object-url request state. */
export function clearPendingAssetObjectUrlsForTests(): void {
  pendingObjectUrls.clear();
}
