import { describe, expect, it } from "vitest";
import type { Scene } from "../../types.js";
import { getSceneAtTime, getTimelineSegments } from "../timeline.js";

const scenes: Scene[] = [
  {
    id: "intro",
    type: "text",
    duration: 2,
    background: "#111111",
    chapter: "Intro",
  },
  {
    id: "code",
    type: "code",
    duration: 3.5,
  },
];

describe("getTimelineSegments", () => {
  it("accumulates scene durations into ordered timeline segments", () => {
    const result = getTimelineSegments(scenes);

    expect(result.totalDuration).toBe(5.5);
    expect(result.segments).toMatchObject([
      {
        sceneId: "intro",
        startTime: 0,
        endTime: 2,
        duration: 2,
        color: "#111111",
        label: "2s",
        chapter: "Intro",
      },
      {
        sceneId: "code",
        startTime: 2,
        endTime: 5.5,
        duration: 3.5,
        label: "3.5s",
      },
    ]);
  });

  it("uses the scene color palette when a scene has no explicit background", () => {
    const result = getTimelineSegments(scenes);

    expect(result.segments[1].color).toMatch(/^#/);
    expect(result.segments[1].color).not.toBe("#111111");
  });

  it("returns an empty timeline for no scenes", () => {
    expect(getTimelineSegments([])).toEqual({ segments: [], totalDuration: 0 });
  });
});

describe("getSceneAtTime", () => {
  it("returns the containing scene and scene-local time", () => {
    expect(getSceneAtTime(scenes, 1.25)).toMatchObject({
      index: 0,
      sceneTime: 1.25,
    });
    expect(getSceneAtTime(scenes, 1.25)?.scene.id).toBe("intro");
  });

  it("uses the next scene at an exact scene boundary", () => {
    const result = getSceneAtTime(scenes, 2);

    expect(result?.scene.id).toBe("code");
    expect(result).toMatchObject({ index: 1, sceneTime: 0 });
  });

  it("clamps times beyond the end to the end of the last scene", () => {
    const result = getSceneAtTime(scenes, 99);

    expect(result?.scene.id).toBe("code");
    expect(result).toMatchObject({ index: 1, sceneTime: 3.5 });
  });

  it("returns null when there are no scenes", () => {
    expect(getSceneAtTime([], 0)).toBeNull();
  });
});
