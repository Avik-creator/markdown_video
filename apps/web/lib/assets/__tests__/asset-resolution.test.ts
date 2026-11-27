import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyAssetSource,
  getAssetObjectUrl,
  resolveBrowserAssetSource,
  resolveBrowserAssetSrcSync,
  warmBrowserAssetSources,
} from "../asset-resolution";
import {
  resetAssetLibraryForTests,
  setAssetStoreBackendForTests,
  useAssetLibrary,
} from "../asset-library";
import { createMemoryAssetStoreBackend } from "../asset-store";
import {
  getCachedAssetObjectUrl,
  revokeAllAssetObjectUrls,
} from "../asset-object-urls";

const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

describe("browser asset resolution", () => {
  beforeEach(() => {
    setAssetStoreBackendForTests(createMemoryAssetStoreBackend());
    resetAssetLibraryForTests();
    vi.stubGlobal("window", { location: { origin: "https://editor.test" } });
    let nextUrl = 0;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => `blob:asset-${++nextUrl}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    revokeAllAssetObjectUrls();
    setAssetStoreBackendForTests(null);
    resetAssetLibraryForTests();
    vi.unstubAllGlobals();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectUrl,
    });
  });

  it("classifies explicit source categories before relative/static fallback", () => {
    expect(classifyAssetSource("data:audio/mpeg;base64,AAAA")).toBe("data");
    expect(classifyAssetSource("blob:https://editor.test/id")).toBe("blob");
    expect(classifyAssetSource("https://cdn.example.com/a.mp3", "https://editor.test")).toBe("remote");
    expect(classifyAssetSource("https://editor.test/a.mp3", "https://editor.test")).toBe("static");
    expect(classifyAssetSource("./a.mp3", "https://editor.test")).toBe("static");
  });

  it("uploads files with collision renames and reports oversized files without blocking", async () => {
    const first = new File(["a"], "theme.mp3", { type: "audio/mpeg" });
    const second = new File(["b"], "theme.mp3", { type: "audio/mpeg" });
    const result = await useAssetLibrary.getState().uploadFiles([first, second]);

    expect(result.errors).toEqual([]);
    expect(result.uploaded.map((item) => item.asset.filename)).toEqual([
      "theme.mp3",
      "theme-1.mp3",
    ]);
    expect(result.uploaded[1].renamed).toBe(true);
    expect(result.uploaded[0].oversized).toBe(false);
    expect(useAssetLibrary.getState().assets).toHaveLength(2);
  });

  it("resolves relative sources from the asset store before static fallback", async () => {
    const file = new File(["audio"], "theme.mp3", { type: "audio/mpeg" });
    await useAssetLibrary.getState().uploadFiles([file]);

    const resolved = await resolveBrowserAssetSource("./theme.mp3");
    expect(resolved.provenance).toBe("asset-store");
    expect(resolved.url).toMatch(/^blob:asset-/);
    expect(resolved.filename).toBe("theme.mp3");

    const missing = await resolveBrowserAssetSource("./other.mp3");
    expect(missing.provenance).toBe("static");
    expect(missing.url).toBe("./other.mp3");
  });

  it("deduplicates lazy object-url reads and revokes them on delete", async () => {
    const file = new File(["audio"], "theme.mp3", { type: "audio/mpeg" });
    const [upload] = (await useAssetLibrary.getState().uploadFiles([file])).uploaded;

    const [first, second] = await Promise.all([
      getAssetObjectUrl(upload.asset.id),
      getAssetObjectUrl(upload.asset.id),
    ]);
    expect(first).toBe(second);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(getCachedAssetObjectUrl(upload.asset.id)).toBe(first);

    await useAssetLibrary.getState().deleteAsset(upload.asset.id);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(first);
    expect(getCachedAssetObjectUrl(upload.asset.id)).toBeNull();
  });

  it("warms all uploaded references before deterministic export capture", async () => {
    const image = new File(["png"], "logo.png", { type: "image/png" });
    const [upload] = (await useAssetLibrary.getState().uploadFiles([image])).uploaded;

    await warmBrowserAssetSources("!scene\n!image src:./logo.png");
    expect(getCachedAssetObjectUrl(upload.asset.id)).toMatch(/^blob:asset-/);
  });

  it("keeps the synchronous scene resolver pure and falls back until the cache is warm", async () => {
    const file = new File(["audio"], "theme.mp3", { type: "audio/mpeg" });
    const [upload] = (await useAssetLibrary.getState().uploadFiles([file])).uploaded;

    expect(resolveBrowserAssetSrcSync("./theme.mp3")).toBe("./theme.mp3");
    await vi.waitFor(() => {
      expect(getCachedAssetObjectUrl(upload.asset.id)).not.toBeNull();
    });
    expect(resolveBrowserAssetSrcSync("./theme.mp3")).toMatch(/^blob:asset-/);
    expect(resolveBrowserAssetSrcSync("https://cdn.example.com/x.mp3")).toBe(
      "https://cdn.example.com/x.mp3"
    );
  });
});
