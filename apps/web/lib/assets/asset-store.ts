/**
 * Browser-local binary asset storage.
 *
 * Assets live in IndexedDB rather than localStorage because they are binary
 * blobs and can be several megabytes each. The store is deliberately simple:
 * one object store shared by audio and images, with a unique filename index
 * that backs the document-relative `./filename` reference scheme.
 */

export const ASSET_DATABASE_NAME = "markdown-video-assets";
export const ASSET_DATABASE_VERSION = 1;
export const ASSET_OBJECT_STORE = "assets";
export const ASSET_FILENAME_INDEX = "filename";

export interface AssetMetadata {
  id: string;
  /** Logical document-relative path, for example `theme.mp3` or `art/logo.png`. */
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

export interface AssetRecord extends AssetMetadata {
  blob: Blob;
}

export type AssetKind = "audio" | "image";

export type AssetStoreErrorCode =
  | "unavailable"
  | "quota"
  | "conflict"
  | "unknown";

export class AssetStoreError extends Error {
  readonly code: AssetStoreErrorCode;
  readonly cause?: unknown;

  constructor(
    message: string,
    code: AssetStoreErrorCode = "unknown",
    cause?: unknown
  ) {
    super(message);
    this.name = "AssetStoreError";
    this.code = code;
    this.cause = cause;
  }
}

export const ASSET_QUOTA_MESSAGE =
  "Browser asset storage is full or blocked for this file. Delete unused assets or use a smaller file. Uploaded assets stay in this browser and do not travel with share links.";

export const ASSET_UNAVAILABLE_MESSAGE =
  "Browser asset storage (IndexedDB) is unavailable in this browser or private browsing session.";

function errorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    return String((error as { name?: unknown }).name ?? "");
  }
  return "";
}

export function isQuotaExceededError(error: unknown): boolean {
  const name = errorName(error);
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    name === "NS_ERROR_DOM_QUOTA_EXCEEDED_ERR"
  );
}

function normalizeStoreError(error: unknown, fallback: string): AssetStoreError {
  if (error instanceof AssetStoreError) return error;
  if (isQuotaExceededError(error)) {
    return new AssetStoreError(ASSET_QUOTA_MESSAGE, "quota", error);
  }
  if (errorName(error) === "ConstraintError") {
    return new AssetStoreError(
      "An asset with that name already exists in browser storage.",
      "conflict",
      error
    );
  }
  const detail = error instanceof Error ? error.message : fallback;
  return new AssetStoreError(detail || fallback, "unknown", error);
}

/**
 * Make a user/file-supplied name safe to use as a logical markdown path.
 * Path traversal is removed rather than preserved: uploads are positive
 * document assets, never a way to escape the asset namespace. Quote characters
 * are replaced because the markdown dialect's quoted values do not define an
 * escaping mechanism for nested quotes.
 */
export function sanitizeAssetFilename(input: string): string {
  const segments = input
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) =>
      segment
        .replace(/[\u0000-\u001f\u007f"']/g, "-")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..");

  return segments.join("/") || "asset";
}

/** Strip leading `./` and normalize harmless `.` segments in a relative reference. */
export function normalizeRelativeAssetFilename(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed)) return null;
  if (trimmed.startsWith("//") || trimmed.startsWith("/")) return null;
  if (trimmed === "." || trimmed === "./") return null;

  let withoutPrefix = trimmed;
  while (withoutPrefix.startsWith("./")) {
    withoutPrefix = withoutPrefix.slice(2);
  }
  if (!withoutPrefix || withoutPrefix.startsWith("../")) return null;

  const segments = withoutPrefix.split("/").filter((segment) => segment !== ".");
  if (segments.length === 0 || segments.some((segment) => segment === "" || segment === "..")) {
    return null;
  }
  return segments.join("/");
}

/**
 * Allocate `name`, `name-1`, `name-2`, ... while preserving the final
 * extension. Collision behavior is deliberately exact and deterministic so
 * upload feedback can tell the user precisely which reference to use.
 */
export function allocateUniqueAssetFilename(
  desiredName: string,
  takenNames: readonly string[]
): string {
  const desired = sanitizeAssetFilename(desiredName);
  const taken = new Set(takenNames);
  if (!taken.has(desired)) return desired;

  const slashIndex = desired.lastIndexOf("/");
  const directory = slashIndex >= 0 ? `${desired.slice(0, slashIndex + 1)}` : "";
  const basename = slashIndex >= 0 ? desired.slice(slashIndex + 1) : desired;
  const dotIndex = basename.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < basename.length - 1;
  const stem = hasExtension ? basename.slice(0, dotIndex) : basename;
  const extension = hasExtension ? basename.slice(dotIndex) : "";

  for (let suffix = 1; ; suffix++) {
    const candidate = `${directory}${stem}-${suffix}${extension}`;
    if (!taken.has(candidate)) return candidate;
  }
}

const AUDIO_EXTENSIONS = new Set([
  "aac",
  "aif",
  "aiff",
  "flac",
  "m4a",
  "mp3",
  "oga",
  "ogg",
  "opus",
  "wav",
  "weba",
  "webm",
]);

const IMAGE_EXTENSIONS = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "ico",
  "jfif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

function extensionFor(filename: string): string {
  const basename = filename.split("/").pop() ?? filename;
  const dot = basename.lastIndexOf(".");
  return dot >= 0 ? basename.slice(dot + 1).toLowerCase() : "";
}

export function assetKindFor(
  mimeType: string,
  filename: string
): AssetKind | null {
  const normalizedMime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalizedMime.startsWith("audio/")) return "audio";
  if (normalizedMime.startsWith("image/")) return "image";

  const extension = extensionFor(filename);
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  return null;
}

export function assetMetadata(record: AssetRecord): AssetMetadata {
  return {
    id: record.id,
    filename: record.filename,
    mimeType: record.mimeType,
    size: record.size,
    createdAt: record.createdAt,
  };
}

export interface AssetStoreBackend {
  listRecords(): Promise<AssetRecord[]>;
  getRecord(id: string): Promise<AssetRecord | null>;
  getRecordByFilename(filename: string): Promise<AssetRecord | null>;
  addRecord(record: AssetRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;
}

function sortRecords(records: readonly AssetRecord[]): AssetRecord[] {
  return [...records].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.filename.localeCompare(b.filename);
  });
}

/** In-memory implementation with the same semantics, used by unit tests. */
export function createMemoryAssetStoreBackend(): AssetStoreBackend {
  const records = new Map<string, AssetRecord>();

  return {
    async listRecords() {
      return sortRecords([...records.values()]);
    },
    async getRecord(id) {
      return records.get(id) ?? null;
    },
    async getRecordByFilename(filename) {
      return [...records.values()].find((record) => record.filename === filename) ?? null;
    },
    async addRecord(record) {
      if (records.has(record.id)) {
        throw new AssetStoreError("Asset id already exists.", "conflict");
      }
      if ([...records.values()].some((existing) => existing.filename === record.filename)) {
        throw new AssetStoreError(
          "An asset with that name already exists in browser storage.",
          "conflict"
        );
      }
      records.set(record.id, record);
    },
    async deleteRecord(id) {
      records.delete(id);
    },
  };
}

function normalizeOpenError(error: unknown): AssetStoreError {
  if (isQuotaExceededError(error)) {
    return new AssetStoreError(ASSET_QUOTA_MESSAGE, "quota", error);
  }
  return new AssetStoreError(ASSET_UNAVAILABLE_MESSAGE, "unavailable", error);
}

function openAssetDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(ASSET_DATABASE_NAME, ASSET_DATABASE_VERSION);
    } catch (error) {
      reject(normalizeOpenError(error));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ASSET_OBJECT_STORE)) {
        const store = db.createObjectStore(ASSET_OBJECT_STORE, { keyPath: "id" });
        store.createIndex(ASSET_FILENAME_INDEX, "filename", { unique: true });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      reject(normalizeOpenError(request.error));
    };
    request.onblocked = () => {
      reject(
        new AssetStoreError(
          "Browser asset storage is blocked by another open tab. Close other markdown-video tabs and try again.",
          "unavailable"
        )
      );
    };
  });
}

/**
 * Small promise wrapper around one object-store request. Mutations resolve on
 * transaction completion rather than request success because quota failures
 * can surface at commit time.
 */
function transact<T>(
  dbPromise: Promise<IDBDatabase>,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  fallback: string
): Promise<T> {
  return dbPromise.then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let result: T;
        try {
          const transaction = db.transaction(ASSET_OBJECT_STORE, mode);
          const store = transaction.objectStore(ASSET_OBJECT_STORE);
          const request = operation(store);
          request.onsuccess = () => {
            result = request.result;
          };
          transaction.oncomplete = () => resolve(result);
          transaction.onerror = () => {
            reject(normalizeStoreError(transaction.error, fallback));
          };
          transaction.onabort = () => {
            reject(normalizeStoreError(transaction.error, fallback));
          };
        } catch (error) {
          reject(normalizeStoreError(error, fallback));
        }
      })
  );
}

/** IndexedDB-backed asset store. The database connection is lazy and shared per instance. */
export function createIndexedDbAssetStore(factory?: IDBFactory): AssetStoreBackend {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const getDatabase = () => {
    const indexedDBFactory = factory ?? globalThis.indexedDB;
    if (!indexedDBFactory) {
      return Promise.reject(new AssetStoreError(ASSET_UNAVAILABLE_MESSAGE, "unavailable"));
    }
    if (!dbPromise) {
      dbPromise = openAssetDatabase(indexedDBFactory);
      dbPromise.catch(() => {
        // A later operation may retry after the browser leaves a transient
        // blocked/error state instead of caching one failure forever.
        dbPromise = null;
      });
    }
    return dbPromise;
  };

  return {
    async listRecords() {
      const records = await transact(
        getDatabase(),
        "readonly",
        (store) => store.getAll() as IDBRequest<AssetRecord[]>,
        "Could not read browser assets."
      );
      return sortRecords(records);
    },

    async getRecord(id) {
      const record = await transact(
        getDatabase(),
        "readonly",
        (store) => store.get(id) as IDBRequest<AssetRecord | undefined>,
        "Could not read the uploaded asset."
      );
      return record ?? null;
    },

    async getRecordByFilename(filename) {
      const record = await transact(
        getDatabase(),
        "readonly",
        (store) =>
          store.index(ASSET_FILENAME_INDEX).get(filename) as IDBRequest<AssetRecord | undefined>,
        "Could not read the uploaded asset."
      );
      return record ?? null;
    },

    async addRecord(record) {
      await transact(
        getDatabase(),
        "readwrite",
        (store) => store.add(record) as IDBRequest<IDBValidKey>,
        "Could not save the uploaded asset."
      );
    },

    async deleteRecord(id) {
      await transact(
        getDatabase(),
        "readwrite",
        (store) => store.delete(id) as IDBRequest<undefined>,
        "Could not delete the uploaded asset."
      );
    },
  };
}
