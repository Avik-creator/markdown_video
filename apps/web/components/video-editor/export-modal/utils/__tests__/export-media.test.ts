// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBrowserMusicData } from "../export-media";
import {
  resetAssetLibraryForTests,
  setAssetStoreBackendForTests,
  useAssetLibrary,
} from "@/lib/assets/asset-library";
import { createMemoryAssetStoreBackend } from "@/lib/assets/asset-store";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

function audioResponse(bytes: Uint8Array, init?: ResponseInit) {
  return new Response(bytes.slice().buffer, {
    status: 200,
    headers: { "content-type": "audio/mpeg" },
    ...init,
  });
}

describe("fetchBrowserMusicData", () => {
  it("fetches HTTPS music with same-origin credential policy only", async () => {
    fetchMock.mockResolvedValue(audioResponse(new Uint8Array([1, 2, 3])));
    const controller = new AbortController();

    const data = await fetchBrowserMusicData(
      "https://example.com/theme.mp3",
      controller.signal
    );

    expect([...data]).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/theme.mp3", {
      signal: controller.signal,
      credentials: "same-origin",
    });
  });

  it("rejects insecure cross-origin HTTP before fetching", async () => {
    await expect(
      fetchBrowserMusicData("http://example.com/theme.mp3", new AbortController().signal)
    ).rejects.toThrow("Remote music must use HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads document-relative music from uploaded browser assets before static fallback", async () => {
    setAssetStoreBackendForTests(createMemoryAssetStoreBackend());
    resetAssetLibraryForTests();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:uploaded-theme"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    try {
      await useAssetLibrary
        .getState()
        .uploadFiles([new File([new Uint8Array([9, 8, 7])], "theme.mp3", { type: "audio/mpeg" })]);
      fetchMock.mockResolvedValue(audioResponse(new Uint8Array([9, 8, 7])));

      const data = await fetchBrowserMusicData("./theme.mp3", new AbortController().signal);

      expect([...data]).toEqual([9, 8, 7]);
      expect(fetchMock).toHaveBeenCalledWith(
        "blob:uploaded-theme",
        expect.objectContaining({ credentials: "same-origin" })
      );
    } finally {
      setAssetStoreBackendForTests(null);
      resetAssetLibraryForTests();
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreate });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevoke });
    }
  });

  it("resolves relative application assets against the current origin", async () => {
    fetchMock.mockResolvedValue(audioResponse(new Uint8Array([4])));
    await fetchBrowserMusicData("audio/theme.mp3", new AbortController().signal);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${window.location.origin}/audio/theme.mp3`
    );
  });

  it("rejects non-audio content types and empty files", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    await expect(
      fetchBrowserMusicData("https://example.com/not-audio", new AbortController().signal)
    ).rejects.toThrow("audio content type");

    fetchMock.mockResolvedValue(audioResponse(new Uint8Array()));
    await expect(
      fetchBrowserMusicData("https://example.com/empty.mp3", new AbortController().signal)
    ).rejects.toThrow("empty");
  });
});
