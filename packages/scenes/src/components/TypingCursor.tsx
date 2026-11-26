"use client";

import type { CSSProperties } from "react";
import { cn } from "../cn.js";
import { pulseOpacityAtTime } from "../utils/animation-math.js";

/**
 * Shared typing cursor. In deterministic rendering (a sceneTime is present),
 * its pulse opacity is a pure function of that time. Without a sceneTime the
 * original CSS pulse animation is retained for non-export consumers.
 */
export function TypingCursor({
  sceneTime,
  className,
  style,
}: {
  sceneTime?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const deterministic = sceneTime !== undefined;

  return (
    <span
      aria-hidden="true"
      className={cn(className, !deterministic && "animate-pulse")}
      style={{
        ...style,
        ...(deterministic ? { opacity: pulseOpacityAtTime(sceneTime) } : {}),
      }}
    />
  );
}
