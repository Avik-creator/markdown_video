// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MARKDOWN } from "@/lib/default-markdown";

const videoEditorProps = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@components/video-editor/video-editor", () => ({
  VideoEditor: (props: unknown) => {
    videoEditorProps.current = props;
    return <div data-testid="video-editor-stub" />;
  },
}));

import {
  ShareProjectGate,
  isUntouchedDefaultMarkdown,
} from "../share-project-gate";

const STORAGE_KEY = "markdown-video-storage";
const SHARED_MARKDOWN = "!scene\n!text\nShared project\n!duration 3s";

function saveMarkdown(markdown: string) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: { markdown }, version: 0 })
  );
}

function renderGate() {
  let utils: ReturnType<typeof render> | undefined;
  act(() => {
    utils = render(<ShareProjectGate initialMarkdown={SHARED_MARKDOWN} />);
  });
  return utils!;
}

describe("isUntouchedDefaultMarkdown", () => {
  it("matches the exact default document", () => {
    expect(isUntouchedDefaultMarkdown(DEFAULT_MARKDOWN)).toBe(true);
  });

  it("tolerates trailing whitespace differences only", () => {
    expect(isUntouchedDefaultMarkdown(`${DEFAULT_MARKDOWN}\n`)).toBe(true);
    expect(isUntouchedDefaultMarkdown(`${DEFAULT_MARKDOWN}\n\n  \n`)).toBe(true);
  });

  it("does not match edited, emptied, or leading-whitespace-modified documents", () => {
    expect(isUntouchedDefaultMarkdown(`${DEFAULT_MARKDOWN}extra`)).toBe(false);
    expect(isUntouchedDefaultMarkdown(`\n${DEFAULT_MARKDOWN}`)).toBe(false);
    expect(isUntouchedDefaultMarkdown("")).toBe(false);
    expect(isUntouchedDefaultMarkdown("   ")).toBe(false);
    expect(
      isUntouchedDefaultMarkdown(DEFAULT_MARKDOWN.replace("Welcome", "Hola"))
    ).toBe(false);
  });
});

describe("ShareProjectGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    videoEditorProps.current = null;
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("accepts immediately when the visitor has no saved project", () => {
    renderGate();

    expect(videoEditorProps.current).toEqual({
      initialMarkdown: SHARED_MARKDOWN,
      isEmbed: false,
    });
    expect(document.body.textContent).not.toContain("Open shared project?");
  });

  it("accepts without prompting when the saved project is the untouched default", () => {
    saveMarkdown(DEFAULT_MARKDOWN);

    renderGate();

    expect(videoEditorProps.current).toEqual({
      initialMarkdown: SHARED_MARKDOWN,
      isEmbed: false,
    });
    expect(document.body.textContent).not.toContain("Open shared project?");
  });

  it("accepts without prompting when the saved default only gained trailing whitespace", () => {
    saveMarkdown(`${DEFAULT_MARKDOWN}\n\n`);

    renderGate();

    expect(videoEditorProps.current).not.toBeNull();
    expect(document.body.textContent).not.toContain("Open shared project?");
  });

  it("accepts without prompting when the saved project already is the shared one", () => {
    saveMarkdown(SHARED_MARKDOWN);

    renderGate();

    expect(videoEditorProps.current).not.toBeNull();
    expect(document.body.textContent).not.toContain("Open shared project?");
  });

  it("prompts when the saved project has real edits", () => {
    saveMarkdown("!scene\n!text\nMy own project\n!duration 3s");

    renderGate();

    expect(videoEditorProps.current).toBeNull();
    expect(document.body.textContent).toContain("Open shared project?");
  });

  it("prompts when the saved document was emptied, which is a real state worth protecting", () => {
    saveMarkdown("");

    renderGate();

    expect(videoEditorProps.current).toBeNull();
    expect(document.body.textContent).toContain("Open shared project?");
  });
});
