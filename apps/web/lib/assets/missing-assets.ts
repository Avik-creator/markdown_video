import type { Diagnostic } from "@/lib/editor/diagnostics";
import { checkStaticAssetExists } from "./static-assets";
import {
  extractRelativeAssetReferences,
  uniqueAssetReferences,
} from "./asset-references";
import type { AssetMetadata } from "./asset-store";

export interface MissingAssetReference {
  kind: "audio" | "image";
  filename: string;
  lineNumber: number;
  /** True when the browser should still try a same-origin static file. */
  hasStaticFallback: boolean;
}

export interface FindMissingAssetsOptions {
  assets: readonly AssetMetadata[];
  staticExists?: (path: string) => Promise<boolean>;
}

/**
 * Resolve diagnostics in the same order as playback/export: uploaded assets
 * first, then same-origin static files. The result is warning-only because a
 * static file can appear later and because remote/project-portability behavior
 * intentionally differs by host.
 */
export async function findMissingAssetReferences(
  markdown: string,
  options: FindMissingAssetsOptions
): Promise<MissingAssetReference[]> {
  const references = uniqueAssetReferences(extractRelativeAssetReferences(markdown));
  if (references.length === 0) return [];

  const staticExists = options.staticExists ?? checkStaticAssetExists;
  const uploadedNames = new Set(options.assets.map((asset) => asset.filename));
  const missing: MissingAssetReference[] = [];

  for (const reference of references) {
    if (uploadedNames.has(reference.filename)) continue;
    const staticFound = await staticExists(reference.rawSrc);
    if (!staticFound) {
      missing.push({
        kind: reference.kind,
        filename: reference.filename,
        lineNumber: reference.lineNumber,
        hasStaticFallback: false,
      });
    }
  }

  return missing;
}

export function missingAssetDiagnostics(
  missing: readonly MissingAssetReference[]
): Diagnostic[] {
  return missing.map((reference) => ({
    line: reference.lineNumber,
    severity: "warning",
    message:
      reference.kind === "audio"
        ? `Music file "./${reference.filename}" was not found in browser assets or static files`
        : `Image file "./${reference.filename}" was not found in browser assets or static files`,
    suggestion:
      reference.kind === "audio"
        ? "Upload the audio file in Assets, or use an HTTPS music URL. Browser-local uploads are not included in share links."
        : "Upload the image file in Assets, move it into public/, or use an HTTPS image URL. Browser-local uploads are not included in share links.",
  }));
}

export async function getMissingAssetDiagnostics(
  markdown: string,
  options: FindMissingAssetsOptions
): Promise<Diagnostic[]> {
  return missingAssetDiagnostics(await findMissingAssetReferences(markdown, options));
}
