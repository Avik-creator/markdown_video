import { create } from "zustand";
import {
  allocateUniqueAssetFilename,
  assetKindFor,
  assetMetadata,
  createIndexedDbAssetStore,
  sanitizeAssetFilename,
  AssetStoreError,
  type AssetKind,
  type AssetMetadata,
  type AssetRecord,
  type AssetStoreBackend,
} from "./asset-store";
import { revokeAssetObjectUrl, revokeAllAssetObjectUrls } from "./asset-object-urls";

export const LARGE_ASSET_WARNING_BYTES = 10 * 1024 * 1024;

export interface UploadedAsset {
  asset: AssetMetadata;
  kind: AssetKind;
  originalFilename: string;
  renamed: boolean;
  oversized: boolean;
}

export interface AssetUploadError {
  fileName: string;
  message: string;
}

export interface AssetUploadBatchResult {
  uploaded: UploadedAsset[];
  errors: AssetUploadError[];
}

interface AssetLibraryState {
  assets: AssetMetadata[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** Bumped when membership/metadata changes; validation listens to this. */
  libraryRevision: number;
  /** Bumped when a lazy object-url becomes available for rendering. */
  resolutionRevision: number;
  refreshAssets: () => Promise<void>;
  uploadFiles: (
    files: readonly File[],
    options?: { filenameOverride?: string }
  ) => Promise<AssetUploadBatchResult>;
  deleteAsset: (id: string) => Promise<void>;
  noteResolutionChanged: () => void;
}

let backend: AssetStoreBackend = createIndexedDbAssetStore();

export function getAssetStoreBackend(): AssetStoreBackend {
  return backend;
}

export function setAssetStoreBackendForTests(next: AssetStoreBackend | null): void {
  backend = next ?? createIndexedDbAssetStore();
  revokeAllAssetObjectUrls();
}

function assetErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "The uploaded asset could not be saved in browser storage.";
}

function generateAssetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const EXTENSION_MIME_TYPES: Record<string, string> = {
  aac: "audio/aac",
  avif: "image/avif",
  bmp: "image/bmp",
  flac: "audio/flac",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/opus",
  png: "image/png",
  svg: "image/svg+xml",
  wav: "audio/wav",
  weba: "audio/webm",
  webm: "audio/webm",
  webp: "image/webp",
};

function inferredMimeType(filename: string, browserType: string): string {
  if (browserType) return browserType;
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME_TYPES[extension] ?? "application/octet-stream";
}

function sortMetadata(records: readonly AssetRecord[]): AssetMetadata[] {
  return records.map(assetMetadata);
}

const initialState = {
  assets: [] as AssetMetadata[],
  status: "idle" as const,
  error: null as string | null,
  libraryRevision: 0,
  resolutionRevision: 0,
};

export const useAssetLibrary = create<AssetLibraryState>()((set) => ({
  ...initialState,

  refreshAssets: async () => {
    set((state) => ({
      status: state.status === "ready" ? "ready" : "loading",
      error: null,
    }));
    try {
      const records = await backend.listRecords();
      set((state) => ({
        assets: sortMetadata(records),
        status: "ready",
        error: null,
        libraryRevision: state.libraryRevision + 1,
      }));
    } catch (error) {
      set((state) => ({
        status: "error",
        error: assetErrorMessage(error),
        libraryRevision: state.libraryRevision + 1,
      }));
    }
  },

  uploadFiles: async (files, options) => {
    const result: AssetUploadBatchResult = { uploaded: [], errors: [] };
    let takenNames: string[];
    try {
      takenNames = (await backend.listRecords()).map((record) => record.filename);
    } catch (error) {
      const message = assetErrorMessage(error);
      for (const file of files) {
        result.errors.push({ fileName: file.name, message });
      }
      set({ status: "error", error: message });
      return result;
    }

    for (const [index, file] of files.entries()) {
      const originalFilename = file.name || `asset-${index + 1}`;
      const desiredInput =
        options?.filenameOverride && files.length === 1
          ? options.filenameOverride
          : originalFilename;
      const desiredFilename = sanitizeAssetFilename(desiredInput);
      const mimeType = inferredMimeType(desiredFilename, file.type);
      const kind = assetKindFor(mimeType, desiredFilename);

      if (!kind) {
        result.errors.push({
          fileName: originalFilename,
          message: "Only audio and image files can be uploaded as scene assets.",
        });
        continue;
      }

      const filename = allocateUniqueAssetFilename(desiredFilename, takenNames);
      const record: AssetRecord = {
        id: generateAssetId(),
        filename,
        mimeType,
        size: file.size,
        createdAt: Date.now(),
        blob: file,
      };

      try {
        await backend.addRecord(record);
        takenNames.push(filename);
        const metadata = assetMetadata(record);
        set((state) => ({
          assets: [...state.assets.filter((asset) => asset.id !== metadata.id), metadata].sort(
            (a, b) => a.createdAt - b.createdAt || a.filename.localeCompare(b.filename)
          ),
          status: "ready",
          error: null,
          libraryRevision: state.libraryRevision + 1,
        }));
        result.uploaded.push({
          asset: metadata,
          kind,
          originalFilename,
          renamed: filename !== desiredFilename,
          oversized: file.size > LARGE_ASSET_WARNING_BYTES,
        });
      } catch (error) {
        const normalized =
          error instanceof AssetStoreError ? error : new AssetStoreError(assetErrorMessage(error));
        result.errors.push({ fileName: originalFilename, message: normalized.message });
      }
    }

    return result;
  },

  deleteAsset: async (id) => {
    await backend.deleteRecord(id);
    revokeAssetObjectUrl(id);
    set((state) => ({
      assets: state.assets.filter((asset) => asset.id !== id),
      libraryRevision: state.libraryRevision + 1,
    }));
  },

  noteResolutionChanged: () => {
    set((state) => ({ resolutionRevision: state.resolutionRevision + 1 }));
  },
}));

export function resetAssetLibraryForTests(): void {
  useAssetLibrary.setState({
    ...initialState,
    refreshAssets: useAssetLibrary.getState().refreshAssets,
    uploadFiles: useAssetLibrary.getState().uploadFiles,
    deleteAsset: useAssetLibrary.getState().deleteAsset,
    noteResolutionChanged: useAssetLibrary.getState().noteResolutionChanged,
  });
}

let ensurePromise: Promise<boolean> | null = null;

/** Load metadata once per browser session; safe to call from independent UI surfaces. */
export function ensureAssetLibraryLoaded(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const state = useAssetLibrary.getState();
  if (state.status === "ready") return Promise.resolve(true);
  if (state.status === "error") return Promise.resolve(false);
  if (!ensurePromise) {
    ensurePromise = state
      .refreshAssets()
      .then(() => useAssetLibrary.getState().status === "ready")
      .catch(() => false)
      .finally(() => {
        ensurePromise = null;
      });
  }
  return ensurePromise;
}
