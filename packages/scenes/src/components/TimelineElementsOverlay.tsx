"use client";

import { motion } from "framer-motion";
import type { TimelineElement } from "@markdown-video/core";
import { timelineElementVisualState } from "../utils/timeline-animation.js";

function TimelineElementRenderer({
  element,
  sceneTime,
}: {
  element: TimelineElement;
  sceneTime: number;
}) {
  const visualState = timelineElementVisualState(element, sceneTime);
  if (!visualState) return null;

  // The state is already a pure function of sceneTime (including the exit
  // extension), so apply it without a wall-clock tween or AnimatePresence exit.
  // framer-motion's target type uses template-literal index signatures that
  // plain interfaces do not satisfy structurally; these values are the numeric
  // x/y/scale/opacity fields returned by the pure helper.
  const motionTarget = visualState as Record<string, any>;
  const motionProps = {
    initial: motionTarget,
    animate: motionTarget,
    transition: { duration: 0 },
  };

  if (element.type === "text") {
    return (
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        {...motionProps}
      >
        <span className="text-2xl font-bold text-white drop-shadow-lg">
          {element.content}
        </span>
      </motion.div>
    );
  }

  if (element.type === "emoji") {
    return (
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        {...motionProps}
      >
        <span className="text-6xl">{element.content}</span>
      </motion.div>
    );
  }

  return null;
}

export function TimelineElementsOverlay({
  elements,
  sceneTime,
}: {
  elements: TimelineElement[];
  sceneTime: number;
}) {
  if (!elements || elements.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {elements.map((element) => (
        <TimelineElementRenderer
          key={element.id}
          element={element}
          sceneTime={sceneTime}
        />
      ))}
    </div>
  );
}
