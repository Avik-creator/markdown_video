import { describe, expect, it } from "vitest";
import type { Scene } from "@markdown-video/core";
import { getSceneAtTime } from "../scene-preview";

function sceneWithDuration(duration: number, id = `scene-${duration}`): Scene {
  return { id, duration } as unknown as Scene;
}

// 2s + 3s + 4s = 9s total.
const SCENES = [
  sceneWithDuration(2, "a"),
  sceneWithDuration(3, "b"),
  sceneWithDuration(4, "c"),
];

describe("getSceneAtTime", () => {
  it("returns the containing scene and the time within it", () => {
    expect(getSceneAtTime(SCENES, 0)).toEqual({
      currentScene: SCENES[0],
      sceneTime: 0,
    });
    expect(getSceneAtTime(SCENES, 1.5)).toEqual({
      currentScene: SCENES[0],
      sceneTime: 1.5,
    });
    expect(getSceneAtTime(SCENES, 4.5)).toEqual({
      currentScene: SCENES[1],
      sceneTime: 2.5,
    });
  });

  it("assigns a time exactly on a scene boundary to the next scene at time 0", () => {
    expect(getSceneAtTime(SCENES, 2)).toEqual({
      currentScene: SCENES[1],
      sceneTime: 0,
    });
    expect(getSceneAtTime(SCENES, 5)).toEqual({
      currentScene: SCENES[2],
      sceneTime: 0,
    });
  });

  it("pins the last scene to its own end at the end of playback", () => {
    // At t = totalDuration the completed-state rendering (finished
    // animations, final countdown values) must not snap back to time 0.
    expect(getSceneAtTime(SCENES, 9)).toEqual({
      currentScene: SCENES[2],
      sceneTime: 4,
    });
  });

  it("keeps the last scene at its end when the time overshoots the total", () => {
    expect(getSceneAtTime(SCENES, 9.01)).toEqual({
      currentScene: SCENES[2],
      sceneTime: 4,
    });
    expect(getSceneAtTime(SCENES, 100)).toEqual({
      currentScene: SCENES[2],
      sceneTime: 4,
    });
  });

  it("pins a single-scene video to that scene's duration at its end", () => {
    const single = [sceneWithDuration(2.5, "only")];
    expect(getSceneAtTime(single, 2.5)).toEqual({
      currentScene: single[0],
      sceneTime: 2.5,
    });
  });

  it("returns no scene for an empty video", () => {
    expect(getSceneAtTime([], 0)).toEqual({ currentScene: null, sceneTime: 0 });
    expect(getSceneAtTime([], 5)).toEqual({ currentScene: null, sceneTime: 0 });
  });
});
