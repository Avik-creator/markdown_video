import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "./memory-storage";
import { parseMarkdown, getTimelineSegments } from "../../parser";

// Total duration: 7s + 5s = 12s.
const STORED_MARKDOWN = `!scene
!duration 7
!text
Restored from storage

---

!scene
!duration 5
!text
Second scene
`;

const STORAGE_KEY = "markdown-video-storage";

function seedStorage(state: Record<string, unknown>) {
  memoryStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state, version: 0 }),
  );
}

describe("store rehydration", () => {
  beforeEach(() => {
    vi.resetModules();
    memoryStorage.clear();
  });

  it("re-parses persisted markdown so scenes, segments and duration match it", async () => {
    seedStorage({
      markdown: STORED_MARKDOWN,
      aspectRatio: "9:16",
      theme: "dracula",
      markers: [],
    });

    const { useVideoStore } = await import("../../use-video-store");
    const state = useVideoStore.getState();

    expect(state.markdown).toBe(STORED_MARKDOWN);
    expect(state.aspectRatio).toBe("9:16");
    expect(state.theme).toBe("dracula");

    // The derived state must come from re-parsing the persisted markdown,
    // not from the default document the store initialized with.
    const expectedScenes = parseMarkdown(STORED_MARKDOWN);
    const expected = getTimelineSegments(expectedScenes);

    expect(state.totalDuration).toBe(12);
    expect(state.totalDuration).toBe(expected.totalDuration);
    expect(state.scenes.map((s) => s.type)).toEqual(
      expectedScenes.map((s) => s.type),
    );
    expect(state.scenes.map((s) => s.duration)).toEqual([7, 5]);
    expect(state.segments).toHaveLength(expected.segments.length);
    expect(state.segments[1].startTime).toBe(7);
  });

  it("rebuilds source maps when re-parsing after rehydration", async () => {
    seedStorage({ markdown: STORED_MARKDOWN, markers: [] });

    const { useVideoStore } = await import("../../use-video-store");
    const state = useVideoStore.getState();

    expect(state.scenes[0].sourceMap?.scene).toBeDefined();
    expect(state.scenes[0].sourceMap?.duration).toBeDefined();
  });

  it("never restores playback-only state even if storage contains stale keys", async () => {
    seedStorage({
      markdown: STORED_MARKDOWN,
      currentTime: 4.2,
      isPlaying: true,
    });

    const { useVideoStore } = await import("../../use-video-store");
    const state = useVideoStore.getState();

    expect(state.markdown).toBe(STORED_MARKDOWN);
    expect(state.currentTime).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it("ignores stale runtime-only metadata and removed localization UI keys", async () => {
    seedStorage({
      markdown: STORED_MARKDOWN,
      markdownRevision: 99,
      markdownOrigin: "editor",
      currentLocale: "es",
      localizationStrings: { welcome: { en: "Welcome", es: "Bienvenido" } },
    });

    const { useVideoStore } = await import("../../use-video-store");
    const state = useVideoStore.getState();
    const runtimeState = state as unknown as Record<string, unknown>;

    expect(state.markdown).toBe(STORED_MARKDOWN);
    expect(state.markdownRevision).toBe(0);
    expect(state.markdownOrigin).toBeNull();
    expect(runtimeState).not.toHaveProperty("currentLocale");
    expect(runtimeState).not.toHaveProperty("localizationStrings");
    expect(runtimeState).not.toHaveProperty("setCurrentLocale");
    expect(runtimeState).not.toHaveProperty("setLocalizationStrings");
    expect(runtimeState).not.toHaveProperty("addLocale");
    expect(runtimeState).not.toHaveProperty("removeLocale");
  });

  it("falls back to the default document when storage is empty", async () => {
    const { useVideoStore } = await import("../../use-video-store");
    const { DEFAULT_MARKDOWN } = await import("../../default-markdown");
    const state = useVideoStore.getState();

    expect(state.markdown).toBe(DEFAULT_MARKDOWN);
    const expected = parseMarkdown(DEFAULT_MARKDOWN);
    expect(state.scenes).toHaveLength(expected.length);
    expect(state.totalDuration).toBeCloseTo(
      expected.reduce((acc, scene) => acc + scene.duration, 0),
    );
  });
});
