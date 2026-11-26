// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseMarkdown } from "@/lib/parser";
import { useVideoStore } from "@/lib/use-video-store";
import { Timeline } from "../timeline";

const TIMELINE_MARKDOWN = [
  "!scene",
  "!text",
  "Alpha",
  "!duration 2s",
  "",
  "---",
  "",
  "!scene",
  "!text",
  "Beta",
  "!duration 2s",
  "",
  "---",
  "",
  "!scene",
  "!text",
  "Gamma",
  "!duration 2s",
].join("\n");

function sceneButtons() {
  return screen.getAllByRole("button", { name: /Text scene/ });
}

function parsedTextScenes() {
  return parseMarkdown(useVideoStore.getState().markdown).map(
    (scene) => scene.text?.content
  );
}

describe("Timeline accessibility", () => {
  beforeEach(() => {
    act(() => {
      useVideoStore.getState().setMarkdown(TIMELINE_MARKDOWN, false);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("gives the scrub control an accessible slider name and value", () => {
    render(<Timeline />);

    const slider = screen.getByRole("slider", {
      name: "Seek through the video timeline",
    });
    expect(slider.getAttribute("aria-orientation")).toBe("horizontal");
    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe(
      useVideoStore.getState().totalDuration.toString()
    );
    expect(slider.getAttribute("aria-valuetext")).toContain("seconds");
  });

  it("moves a focused scene one position later with Ctrl+ArrowRight and keeps focus on it", async () => {
    const { container } = render(<Timeline />);
    const firstScene = sceneButtons()[0];
    firstScene.focus();

    fireEvent.keyDown(firstScene, { key: "ArrowRight", ctrlKey: true });

    expect(parsedTextScenes()).toEqual(["Beta", "Alpha", "Gamma"]);

    await waitFor(() => {
      const movedScene = container.querySelector(
        '[data-timeline-scene-position="1"]'
      );
      expect(movedScene).not.toBeNull();
      expect(document.activeElement).toBe(movedScene);
    });
    expect(screen.getByRole("status").textContent).toContain(
      "Scene moved to position 2 of 3"
    );
  });

  it("moves a focused scene one position earlier with Cmd+ArrowLeft", () => {
    render(<Timeline />);
    const secondScene = sceneButtons()[1];
    secondScene.focus();

    fireEvent.keyDown(secondScene, { key: "ArrowLeft", metaKey: true });

    expect(parsedTextScenes()).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(screen.getByRole("status").textContent).toContain(
      "Scene moved to position 1 of 3"
    );
  });

  it("does not reorder for plain arrows or Shift+Ctrl+Arrow combinations", () => {
    render(<Timeline />);
    const firstScene = sceneButtons()[0];

    fireEvent.keyDown(firstScene, { key: "ArrowRight" });
    fireEvent.keyDown(firstScene, {
      key: "ArrowRight",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(parsedTextScenes()).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("announces when a scene is already at the requested boundary", () => {
    render(<Timeline />);
    const firstScene = sceneButtons()[0];

    fireEvent.keyDown(firstScene, { key: "ArrowLeft", ctrlKey: true });

    expect(parsedTextScenes()).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(screen.getByRole("status").textContent).toContain(
      "Scene is already at the start"
    );
  });
});
