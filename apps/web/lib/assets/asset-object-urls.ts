/**
 * Shared object-url cache for uploaded asset blobs.
 *
 * Object URLs are cached by immutable asset id, so repeated seeks/renders reuse
 * one URL instead of leaking a new browser allocation every frame. Deletion is
 * the single invalidation point and revokes the URL before the asset leaves
 * the library.
 */
const objectUrls = new Map<string, string>();

export function getCachedAssetObjectUrl(assetId: string): string | null {
  return objectUrls.get(assetId) ?? null;
}

export function setCachedAssetObjectUrl(assetId: string, url: string): void {
  const previous = objectUrls.get(assetId);
  if (previous && previous !== url && typeof URL !== "undefined") {
    URL.revokeObjectURL(previous);
  }
  objectUrls.set(assetId, url);
}

export function revokeAssetObjectUrl(assetId: string): void {
  const url = objectUrls.get(assetId);
  if (!url) return;
  objectUrls.delete(assetId);
  if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

/** Test helper; production lifetimes are keyed by asset deletion instead. */
export function revokeAllAssetObjectUrls(): void {
  for (const id of [...objectUrls.keys()]) {
    revokeAssetObjectUrl(id);
  }
}
