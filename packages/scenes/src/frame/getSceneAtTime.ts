import type { Scene } from "@markdown-video/core";

/**
 * Locate the scene shown at `currentTime` and the time within that scene.
 *
 * A time exactly on a scene boundary belongs to the NEXT scene at time 0 —
 * the strict inequality is what keeps a mid-video boundary from flashing the
 * end state of the previous scene. Only the end-of-video fallthrough differs:
 * when playback reaches (or passes) the total duration, the last scene is
 * pinned to its own end so completed-state rendering (finished animations,
 * final countdown values) does not snap back to the scene's beginning.
 *
 * This is the frame-composition view of playback position: it always returns
 * the same shape (with `currentScene: null` for empty videos), unlike the
 * positional `getSceneAtTime` in @markdown-video/core, which additionally
 * reports the scene index and returns null for empty inputs. The composition
 * helper tolerates out-of-range times because preview scrubbing and frame
 * capture can produce them transiently.
 */
export function getSceneAtTime(scenes: Scene[], currentTime: number) {
  let accumulatedTime = 0;
  for (let i = 0; i < scenes.length; i++) {
    const sceneDuration = scenes[i].duration;
    if (currentTime < accumulatedTime + sceneDuration) {
      return {
        currentScene: scenes[i],
        sceneTime: currentTime - accumulatedTime,
      };
    }
    accumulatedTime += sceneDuration;
  }
  const lastScene = scenes[scenes.length - 1];
  if (!lastScene) {
    return { currentScene: null, sceneTime: 0 };
  }
  return { currentScene: lastScene, sceneTime: lastScene.duration };
}
