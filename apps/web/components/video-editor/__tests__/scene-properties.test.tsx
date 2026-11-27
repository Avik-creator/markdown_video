// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SceneProperties } from "../scene-properties";
import { useVideoStore } from "@/lib/use-video-store";

const TEXT_SCENE = `!scene
!text
Welcome
animation: fadeIn
size: xl

!duration 3s
!background #ff0000
!transition fade 0.5s`;

const CHART_SCENE = `!scene
!chart type:bar
React: 85
Vue: 70

!duration 4s`;

function resetStore(markdown = TEXT_SCENE) {
  useVideoStore.getState().setMarkdown(markdown, false);
  useVideoStore.setState({
    history: { past: [], future: [] },
    highlightRange: null,
    currentTime: 0,
    isPlaying: false,
  });
}

describe("SceneProperties schema-driven editing", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    resetStore();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders effective scene metadata values from the markdown", () => {
    render(<SceneProperties />);

    expect((screen.getByLabelText("Duration Seconds") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("Background Color") as HTMLInputElement).value).toBe("#ff0000");
    expect((screen.getByLabelText("Transition Type") as HTMLSelectElement).value).toBe("fade");
    expect((screen.getByLabelText("Text Size") as HTMLSelectElement).value).toBe("xl");
  });

  it("writes a valid numeric edit back into markdown and derived state", () => {
    render(<SceneProperties />);
    const input = screen.getByLabelText("Duration Seconds");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "5" } });

    expect(useVideoStore.getState().markdown).toContain("!duration 5s");
    expect(useVideoStore.getState().scenes[0].duration).toBe(5);
  });

  it("rejects an invalid duration without mutating markdown", () => {
    render(<SceneProperties />);
    const before = useVideoStore.getState().markdown;
    const input = screen.getByLabelText("Duration Seconds");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0" } });

    expect(screen.getByText(/greater than 0/)).toBeTruthy();
    expect(useVideoStore.getState().markdown).toBe(before);

    fireEvent.blur(input);
    expect((screen.getByLabelText("Duration Seconds") as HTMLInputElement).value).toBe("3");
  });

  it("edits a positional enum independently from its sibling duration", () => {
    render(<SceneProperties />);

    fireEvent.change(screen.getByLabelText("Transition Type"), {
      target: { value: "slide" },
    });

    expect(useVideoStore.getState().markdown).toContain("!transition slide 0.5s");
    expect(useVideoStore.getState().scenes[0].transition).toBe("slide");
    expect(useVideoStore.getState().scenes[0].transitionDuration).toBe(0.5);
  });

  it("edits a block property in place instead of replacing scene content", () => {
    render(<SceneProperties />);

    fireEvent.change(screen.getByLabelText("Text Size"), {
      target: { value: "2xl" },
    });

    const markdown = useVideoStore.getState().markdown;
    expect(markdown).toContain("size: 2xl");
    expect(markdown).toContain("Welcome");
    expect(markdown).toContain("animation: fadeIn");
  });

  it("clears optional explicit metadata without touching other lines", () => {
    render(<SceneProperties />);

    fireEvent.click(screen.getByLabelText("Reset Background Color to default"));

    const markdown = useVideoStore.getState().markdown;
    expect(markdown).not.toContain("!background #ff0000");
    expect(markdown).toContain("!duration 3s");
    expect(markdown).toContain("!transition fade 0.5s");
  });

  it("keeps source jump integration on editable properties", () => {
    render(<SceneProperties />);

    fireEvent.click(screen.getByLabelText("Jump to Duration Seconds in markdown source"));

    expect(useVideoStore.getState().highlightRange).toEqual({ startLine: 7, endLine: 7 });
  });

  it("toggles inline chart booleans away from their schema default", () => {
    resetStore(CHART_SCENE);
    render(<SceneProperties />);

    const toggle = screen.getByLabelText("Chart Animate");
    // animate defaults to true in the directive schema; the first click writes
    // an explicit false instead of redundantly writing the effective default.
    expect((toggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(toggle);

    expect(useVideoStore.getState().markdown).toContain("!chart type:bar animate:false");
  });
});
