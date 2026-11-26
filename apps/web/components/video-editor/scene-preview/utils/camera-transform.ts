import type { Scene } from "@markdown-video/core";

export interface CameraTransform {
  scale: number;
  x: number;
  y: number;
}

export const IDENTITY_CAMERA_TRANSFORM: CameraTransform = {
  scale: 1,
  x: 0,
  y: 0,
};

function formatTransformNumber(value: number) {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Serialize in the same translate-then-scale order used by framer-motion. */
export function cameraTransformToCss({
  scale,
  x,
  y,
}: CameraTransform) {
  return `translateX(${formatTransformNumber(x)}px) translateY(${formatTransformNumber(
    y
  )}px) scale(${formatTransformNumber(scale)})`;
}

/**
 * Calculate the complete camera transform for one instant.
 *
 * This is intentionally a pure function of `(camera, sceneTime)`: every
 * branch returns all three transform components, so switching scenes or
 * camera effects can never inherit scale/x/y state from a previous branch.
 */
export function getCameraTransform(
  camera: Scene["camera"] | undefined,
  sceneTime = 0
): CameraTransform {
  if (!camera) return IDENTITY_CAMERA_TRANSFORM;

  if (camera.keyframes && camera.keyframes.length > 0) {
    // Find current and next keyframe.
    let currentKeyframe = camera.keyframes[0];
    let nextKeyframe = camera.keyframes[0];

    for (let i = 0; i < camera.keyframes.length; i++) {
      if (camera.keyframes[i].at <= sceneTime) {
        currentKeyframe = camera.keyframes[i];
        nextKeyframe = camera.keyframes[i + 1] || camera.keyframes[i];
      }
    }

    // Calculate interpolation.
    const timeDiff = nextKeyframe.at - currentKeyframe.at;
    const progress =
      timeDiff > 0 ? (sceneTime - currentKeyframe.at) / timeDiff : 0;
    const clampedProgress = Math.max(0, Math.min(1, progress));

    // Interpolate zoom.
    const currentZoom = currentKeyframe.zoom || 1;
    const nextZoom = nextKeyframe.zoom || 1;
    const zoom = currentZoom + (nextZoom - currentZoom) * clampedProgress;

    // Pan animation.
    const panAmount = currentKeyframe.panAmount || 50;
    const panMap: Record<string, number> = {
      left: -panAmount,
      right: panAmount,
      up: 0,
      down: 0,
    };
    const panX = currentKeyframe.pan ? panMap[currentKeyframe.pan] || 0 : 0;
    const panY =
      currentKeyframe.pan === "down"
        ? panAmount
        : currentKeyframe.pan === "up"
          ? -panAmount
          : 0;

    // Deterministic shake based on sceneTime.
    let shakeX = 0;
    let shakeY = 0;
    if (currentKeyframe.shake) {
      const shakeIntensity =
        currentKeyframe.shakeIntensity === "high"
          ? 10
          : currentKeyframe.shakeIntensity === "medium"
            ? 5
            : 2;
      shakeX = Math.sin(sceneTime * 50) * shakeIntensity;
      shakeY = Math.cos(sceneTime * 50) * shakeIntensity;
    }

    return {
      scale: zoom,
      x: panX + shakeX,
      y: panY + shakeY,
    };
  }

  // Fallback to simple camera effects. Every fallback returns the complete
  // transform, unlike the old effect-driven branch updates which left
  // unmentioned components stuck at their previous values.
  if (camera.effect === "zoom") {
    return {
      scale: camera.value || 1.5,
      x: 0,
      y: 0,
    };
  }

  if (camera.effect === "pan") {
    return {
      scale: 1,
      x: (camera.value || 1) * 50,
      y: 0,
    };
  }

  if (camera.effect === "shake") {
    return {
      scale: 1,
      x: Math.sin(sceneTime * 50) * 5,
      y: Math.cos(sceneTime * 50) * 5,
    };
  }

  return IDENTITY_CAMERA_TRANSFORM;
}
