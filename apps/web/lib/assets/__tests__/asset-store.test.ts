import { describe, expect, it } from "vitest";
import {
  allocateUniqueAssetFilename,
  assetKindFor,
  assetMetadata,
  createMemoryAssetStoreBackend,
  normalizeRelativeAssetFilename,
  sanitizeAssetFilename,
  type AssetRecord,
} from "../asset-store";

function record(overrides: Partial<AssetRecord> = {}): AssetRecord {
  const blob = new Blob(["audio-bytes"], { type: "audio/mpeg" });
  return {
    id: "asset-1",
    filename: "theme.mp3",
    mimeType: "audio/mpeg",
    size: blob.size,
    createdAt: 1000,
    blob,
    ...overrides,
  };
}

describe("asset filename handling", () => {
  it("sanitizes traversal, path separators, controls, and markdown quotes", () => {
    expect(sanitizeAssetFilename("../outside/../theme.mp3")).toBe("outside/theme.mp3");
    expect(sanitizeAssetFilename("art\\my logo.png")).toBe("art/my logo.png");
    expect(sanitizeAssetFilename('bad"quote\'.mp3')).toBe("bad-quote-.mp3");
    expect(sanitizeAssetFilename("///")).toBe("asset");
  });

  it("allocates deterministic collision suffixes inside the same directory", () => {
    expect(allocateUniqueAssetFilename("theme.mp3", [])).toBe("theme.mp3");
    expect(allocateUniqueAssetFilename("theme.mp3", ["theme.mp3"])).toBe("theme-1.mp3");
    expect(
      allocateUniqueAssetFilename("theme.mp3", ["theme.mp3", "theme-1.mp3"])
    ).toBe("theme-2.mp3");
    expect(allocateUniqueAssetFilename("art/logo.png", ["art/logo.png"])).toBe(
      "art/logo-1.png"
    );
  });

  it("normalizes only same-tree relative references into asset filenames", () => {
    expect(normalizeRelativeAssetFilename("./theme.mp3")).toBe("theme.mp3");
    expect(normalizeRelativeAssetFilename("theme.mp3")).toBe("theme.mp3");
    expect(normalizeRelativeAssetFilename("./assets/theme.mp3")).toBe("assets/theme.mp3");
    expect(normalizeRelativeAssetFilename("../theme.mp3")).toBeNull();
    expect(normalizeRelativeAssetFilename("/theme.mp3")).toBeNull();
    expect(normalizeRelativeAssetFilename("https://example.com/theme.mp3")).toBeNull();
    expect(normalizeRelativeAssetFilename("data:audio/mpeg;base64,AAAA")).toBeNull();
  });

  it("classifies assets by mime type first and extension as fallback", () => {
    expect(assetKindFor("audio/mpeg", "track.bin")).toBe("audio");
    expect(assetKindFor("image/png", "logo.bin")).toBe("image");
    expect(assetKindFor("", "track.wav")).toBe("audio");
    expect(assetKindFor("", "logo.webp")).toBe("image");
    expect(assetKindFor("text/plain", "notes.txt")).toBeNull();
  });
});

describe("memory asset store backend", () => {
  it("stores, lists, reads, and deletes records with metadata intact", async () => {
    const backend = createMemoryAssetStoreBackend();
    const first = record();
    const second = record({
      id: "asset-2",
      filename: "art/logo.png",
      mimeType: "image/png",
      createdAt: 2000,
      blob: new Blob(["png"], { type: "image/png" }),
    });

    await backend.addRecord(first);
    await backend.addRecord(second);

    expect(await backend.getRecord("asset-1")).toEqual(first);
    expect(await backend.getRecordByFilename("art/logo.png")).toEqual(second);
    expect((await backend.listRecords()).map((item) => item.id)).toEqual([
      "asset-1",
      "asset-2",
    ]);
    expect(assetMetadata(second)).toEqual({
      id: "asset-2",
      filename: "art/logo.png",
      mimeType: "image/png",
      size: second.size,
      createdAt: 2000,
    });

    await backend.deleteRecord("asset-1");
    expect(await backend.getRecord("asset-1")).toBeNull();
    expect((await backend.listRecords()).map((item) => item.id)).toEqual(["asset-2"]);
  });

  it("rejects duplicate filenames so upload allocation stays authoritative", async () => {
    const backend = createMemoryAssetStoreBackend();
    await backend.addRecord(record());

    await expect(
      backend.addRecord(record({ id: "asset-2" }))
    ).rejects.toMatchObject({ code: "conflict" });
  });
});
