"use client";

import type { Scene } from "@markdown-video/core";
import {
  cameraTransformToCss,
  getCameraTransform,
} from "../utils/camera-transform.js";

export function CameraWrapper({
  children,
  camera,
  sceneTime = 0,
}: {
  children?: React.ReactNode;
  camera?: Scene["camera"];
  sceneTime?: number;
}) {
  if (!camera) return <>{children}</>;

  // The transform is a pure function of this scene instant and is written
  // directly in render. No animation-control state can survive a scene or
  // effect switch, and synchronous export captures never depend on effect
  // timing for the camera position.
  const transform = getCameraTransform(camera, sceneTime);

  return (
    <div
      className="w-full h-full origin-center"
      style={{ transform: cameraTransformToCss(transform) }}
    >
      {children}
    </div>
  );
}
