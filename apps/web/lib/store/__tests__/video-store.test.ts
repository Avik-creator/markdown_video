import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "./memory-storage";
import { useVideoStore } from "../../use-video-store";

// Two scenes: 4s + 2s = 6s total.
const CONTROLLED_MARKDOWN = `!scene
!duration 4
!text
Hello

---

!scene
!duration 2
!text
World
`;

const STORAGE_KEY = "markdown-video-storage";

function resetStore() {
  useVideoStore.getState().pause();
  useVideoStore.getState().setPlaybackSpeed(1);
  useVideoStore.getState().setTheme("default");
  useVideoStore.getState().setAspectRatio("16:9");
  useVideoStore.getState().setExportSettings({ fps: 30 });
  useVideoStore.getState().setActiveLocale(null);
  useVideoStore.getState().setMarkdown(CONTROLLED_MARKDOWN, false);
  useVideoStore.setState({ currentTime: 0, isPlaying: false, markers: [] });
}


describe("document music state", () => {
  beforeEach(resetStore);

  it("derives music from markdown and clears it on the next parse", () => {
    useVideoStore.getState().setMarkdown(`!music theme.mp3 volume:0.25 fade:0.5s loop:false
${CONTROLLED_MARKDOWN}`, false);

    expect(useVideoStore.getState().music).toEqual({
      src: "theme.mp3",
      volume: 0.25,
      fade: 0.5,
      loop: false,
    });

    useVideoStore.getState().setMarkdown(CONTROLLED_MARKDOWN, false);
    expect(useVideoStore.getState().music).toBeUndefined();
  });
});

describe("frame stepping", () => {
  beforeEach(resetStore);

  it("nextFrame advances exactly one frame at the default 30fps", () => {
    useVideoStore.setState({ currentTime: 1 });
    useVideoStore.getState().nextFrame();
    expect(useVideoStore.getState().currentTime).toBeCloseTo(1 + 1 / 30);
  });

  it("prevFrame steps back exactly one frame at the default 30fps", () => {
    useVideoStore.setState({ currentTime: 1 });
    useVideoStore.getState().prevFrame();
    expect(useVideoStore.getState().currentTime).toBeCloseTo(1 - 1 / 30);
  });

  it("steps by the project's configured frame rate", () => {
    useVideoStore.getState().setExportSettings({ fps: 60 });
    useVideoStore.setState({ currentTime: 1 });
    useVideoStore.getState().nextFrame();
    expect(useVideoStore.getState().currentTime).toBeCloseTo(1 + 1 / 60);
    useVideoStore.getState().prevFrame();
    useVideoStore.getState().prevFrame();
    expect(useVideoStore.getState().currentTime).toBeCloseTo(1 - 1 / 60);
  });

  it("falls back to 30fps when the configured frame rate is invalid", () => {
    useVideoStore.getState().setExportSettings({ fps: 0 });
    useVideoStore.setState({ currentTime: 1 });
    useVideoStore.getState().nextFrame();
    expect(useVideoStore.getState().currentTime).toBeCloseTo(1 + 1 / 30);
  });

  it("clamps nextFrame at totalDuration", () => {
    useVideoStore.setState({ currentTime: 5.999 });
    useVideoStore.getState().nextFrame();
    expect(useVideoStore.getState().currentTime).toBe(6);
  });

  it("clamps prevFrame at 0", () => {
    useVideoStore.setState({ currentTime: 0.01 });
    useVideoStore.getState().prevFrame();
    expect(useVideoStore.getState().currentTime).toBe(0);
  });
});

describe("markdown mutation metadata", () => {
  beforeEach(() => {
    resetStore();
    useVideoStore.setState({ history: { past: [], future: [] } });
  });

  it("bumps the runtime-only revision and leaves external mutations untagged", () => {
    const revisionBefore = useVideoStore.getState().markdownRevision;

    useVideoStore
      .getState()
      .setMarkdown(CONTROLLED_MARKDOWN.replace("!duration 4", "!duration 5"), false);

    expect(useVideoStore.getState().markdownRevision).toBe(revisionBefore + 1);
    expect(useVideoStore.getState().markdownOrigin).toBeNull();
  });

  it("treats identical-text writes as no-ops without touching history or revision", () => {
    const revisionBefore = useVideoStore.getState().markdownRevision;
    const historyBefore = useVideoStore.getState().history;

    useVideoStore.getState().setMarkdown(CONTROLLED_MARKDOWN);

    expect(useVideoStore.getState().markdownRevision).toBe(revisionBefore);
    expect(useVideoStore.getState().history).toBe(historyBefore);
  });

  it("keeps the redo future intact after a zero-replacement replaceAll", () => {
    const editedMarkdown = CONTROLLED_MARKDOWN.replace("!duration 4", "!duration 3");
    useVideoStore.getState().setMarkdown(editedMarkdown);
    useVideoStore.getState().undo();
    expect(useVideoStore.getState().history.future).toHaveLength(1);

    useVideoStore.getState().setMarkdown(CONTROLLED_MARKDOWN);
    expect(useVideoStore.getState().history.future).toHaveLength(1);

    // A replaceAll that does change text must still clear the redo future.
    useVideoStore.setState({ findText: "Hello", replaceText: "Hi" });
    useVideoStore.getState().replaceAll();
    expect(useVideoStore.getState().markdown).toContain("Hi");
    expect(useVideoStore.getState().history.future).toHaveLength(0);
  });

  it("tags undo and redo mutations without changing their document behavior", () => {
    const editedMarkdown = CONTROLLED_MARKDOWN.replace(
      "!duration 4",
      "!duration 3",
    );
    useVideoStore.getState().setMarkdown(editedMarkdown);
    const revisionAfterEdit = useVideoStore.getState().markdownRevision;

    useVideoStore.getState().undo();
    expect(useVideoStore.getState().markdown).toBe(CONTROLLED_MARKDOWN);
    expect(useVideoStore.getState().markdownOrigin).toBe("undo");
    expect(useVideoStore.getState().markdownRevision).toBe(revisionAfterEdit + 1);

    useVideoStore.getState().redo();
    expect(useVideoStore.getState().markdown).toBe(editedMarkdown);
    expect(useVideoStore.getState().markdownOrigin).toBe("redo");
    expect(useVideoStore.getState().markdownRevision).toBe(revisionAfterEdit + 2);
  });
});

describe("localization state", () => {
  beforeEach(resetStore);

  const localizedMarkdown = `!locales en es fr
!strings
welcome:
  en: "Welcome"
  es: "Bienvenido"
  fr: "Bienvenue"

---

!scene
!text i18n:welcome
`;

  it("recomputes locales, strings, and the default locale on setMarkdown", () => {
    useVideoStore.getState().setMarkdown(localizedMarkdown, false);
    const state = useVideoStore.getState();

    expect(state.locales).toEqual(["en", "es", "fr"]);
    expect(state.defaultLocale).toBe("en");
    expect(state.localizationStrings).toEqual({
      welcome: { en: "Welcome", es: "Bienvenido", fr: "Bienvenue" },
    });
  });

  it("clears document-derived localization state for a monolingual document", () => {
    useVideoStore.getState().setMarkdown(localizedMarkdown, false);
    useVideoStore.getState().setMarkdown(CONTROLLED_MARKDOWN, false);
    const state = useVideoStore.getState();

    expect(state.locales).toEqual([]);
    expect(state.localizationStrings).toEqual({});
    expect(state.defaultLocale).toBeUndefined();
  });

  it("stores activeLocale as runtime-only state and does not validate or clear it eagerly", () => {
    useVideoStore.getState().setMarkdown(localizedMarkdown, false);
    useVideoStore.getState().setActiveLocale("es");
    expect(useVideoStore.getState().activeLocale).toBe("es");

    // Document edits recompute derived tables but do not erase the user's
    // runtime selection. Resolution ignores it if it is no longer declared.
    useVideoStore.getState().setMarkdown(CONTROLLED_MARKDOWN, false);
    expect(useVideoStore.getState().activeLocale).toBe("es");

    const raw = memoryStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).state).not.toHaveProperty("activeLocale");
  });
});

describe("persistence", () => {
  beforeEach(resetStore);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists project content but not playback-only or derived state", () => {
    useVideoStore.getState().seekTo(2);
    useVideoStore.getState().play();

    const raw = memoryStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw as string);

    expect(stored.state).toHaveProperty("markdown", CONTROLLED_MARKDOWN);
    expect(stored.state).toHaveProperty("aspectRatio");
    expect(stored.state).toHaveProperty("theme");
    expect(stored.state).toHaveProperty("markers");

    expect(stored.state).not.toHaveProperty("currentTime");
    expect(stored.state).not.toHaveProperty("isPlaying");
    expect(stored.state).not.toHaveProperty("playbackSpeed");
    expect(stored.state).not.toHaveProperty("scenes");
    expect(stored.state).not.toHaveProperty("segments");
    expect(stored.state).not.toHaveProperty("totalDuration");
    expect(stored.state).not.toHaveProperty("markdownRevision");
    expect(stored.state).not.toHaveProperty("markdownOrigin");
    expect(stored.state).not.toHaveProperty("currentLocale");
    expect(stored.state).not.toHaveProperty("localizationStrings");
  });

  it("exposes real document-derived localization state without legacy mutation APIs", () => {
    const state = useVideoStore.getState() as unknown as Record<string, unknown>;

    expect(state).toHaveProperty("locales");
    expect(state).toHaveProperty("localizationStrings");
    expect(state).toHaveProperty("activeLocale");
    expect(state).toHaveProperty("setActiveLocale");
    expect(state).not.toHaveProperty("currentLocale");
    expect(state).not.toHaveProperty("setCurrentLocale");
    expect(state).not.toHaveProperty("setLocalizationStrings");
    expect(state).not.toHaveProperty("addLocale");
    expect(state).not.toHaveProperty("removeLocale");
  });

  it("does not write to localStorage for playback-only updates", () => {
    const spy = vi.spyOn(memoryStorage, "setItem");
    spy.mockClear();

    // Simulate playback ticks plus all playback-only state transitions.
    useVideoStore.getState().seekTo(1);
    useVideoStore.getState().seekTo(1.033);
    useVideoStore.getState().seekTo(1.066);
    useVideoStore.getState().play();
    useVideoStore.getState().pause();
    useVideoStore.getState().toggle();
    useVideoStore.getState().toggle();
    useVideoStore.getState().setPlaybackSpeed(2);
    useVideoStore.setState({ currentTime: 3.5 });

    expect(spy).not.toHaveBeenCalled();
  });

  it("writes to localStorage when persisted content changes", () => {
    const spy = vi.spyOn(memoryStorage, "setItem");
    spy.mockClear();

    useVideoStore
      .getState()
      .setMarkdown(`${CONTROLLED_MARKDOWN}\n!scene\n!duration 1\n`, false);
    expect(spy).toHaveBeenCalled();

    spy.mockClear();
    useVideoStore.getState().setTheme("dracula");
    expect(spy).toHaveBeenCalled();

    spy.mockClear();
    useVideoStore.getState().addMarker(1, "chapter note");
    expect(spy).toHaveBeenCalled();
  });
});
