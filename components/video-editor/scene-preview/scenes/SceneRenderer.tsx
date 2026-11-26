"use client";

import type { Scene } from "@/lib/types";
import {
  materializeSplitPanel,
  splitGridStyle,
  type SplitPanel as SplitPanelData,
  type SplitSide,
} from "../utils/split-layout";
import { ChartScene } from "./ChartScene";
import { CodeScene } from "./CodeScene";
import { CountdownScene } from "./CountdownScene";
import { DiffScene } from "./DiffScene";
import { EmojiScene } from "./EmojiScene";
import { ImageScene } from "./ImageScene";
import { MockupScene } from "./MockupScene";
import { ProgressScene } from "./ProgressScene";
import { QRScene } from "./QRScene";
import { TerminalScene } from "./TerminalScene";
import { TextScene } from "./TextScene";
import { TimelineElementsOverlay } from "../components/TimelineElementsOverlay";

/**
 * Routes a scene to the same renderer used for top-level scenes. Split panels
 * also use this component, so nested content keeps its normal deterministic
 * sceneTime behavior instead of duplicating scene-specific rendering logic.
 */
export function SceneRenderer({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  switch (scene.type) {
    case "text":
      return <TextScene scene={scene} sceneTime={sceneTime} />;
    case "code":
      return <CodeScene scene={scene} sceneTime={sceneTime} />;
    case "terminal":
      return <TerminalScene scene={scene} sceneTime={sceneTime} />;
    case "diff":
      return <DiffScene scene={scene} sceneTime={sceneTime} />;
    case "chart":
      return <ChartScene scene={scene} sceneTime={sceneTime} />;
    case "mockup":
      return <MockupScene scene={scene} sceneTime={sceneTime} />;
    case "split":
      return <SplitScene scene={scene} sceneTime={sceneTime} />;
    case "image":
      return <ImageScene scene={scene} sceneTime={sceneTime} />;
    case "emoji":
      return <EmojiScene scene={scene} sceneTime={sceneTime} />;
    case "qr":
      return <QRScene scene={scene} sceneTime={sceneTime} />;
    case "countdown":
      return <CountdownScene scene={scene} sceneTime={sceneTime} />;
    case "progress":
      return <ProgressScene scene={scene} sceneTime={sceneTime} />;
    default:
      return <TextScene scene={scene} sceneTime={sceneTime} />;
  }
}

function SplitPanel({
  panel,
  parentScene,
  side,
  sceneTime,
}: {
  panel: SplitPanelData;
  parentScene: Scene;
  side: SplitSide;
  sceneTime: number;
}) {
  const panelScene = materializeSplitPanel(panel, parentScene, side);

  return (
    <div
      data-split-panel={side}
      className="relative min-w-0 min-h-0 overflow-hidden"
      style={{ background: panel.background }}
    >
      <div className="absolute inset-0">
        <SceneRenderer scene={panelScene} sceneTime={sceneTime} />
      </div>
      {panelScene.timelineElements &&
        panelScene.timelineElements.length > 0 && (
          <TimelineElementsOverlay
            elements={panelScene.timelineElements}
            sceneTime={sceneTime}
          />
        )}
    </div>
  );
}

/**
 * Two-panel layout renderer. `horizontal` places the panels left/right;
 * `vertical` places them top/bottom. The parser represents both panels as
 * `left` and `right`; in a vertical split those are the first/top and
 * second/bottom panels respectively.
 */
export function SplitScene({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  if (!scene.split) return null;

  const direction =
    scene.split.direction === "vertical" ? "vertical" : "horizontal";

  return (
    <div
      data-split-direction={direction}
      className="grid h-full w-full overflow-hidden"
      style={splitGridStyle(direction, scene.split.ratio)}
    >
      <SplitPanel
        panel={scene.split.left}
        parentScene={scene}
        side="left"
        sceneTime={sceneTime}
      />
      <div data-split-divider="true" className="bg-white/10" />
      <SplitPanel
        panel={scene.split.right}
        parentScene={scene}
        side="right"
        sceneTime={sceneTime}
      />
    </div>
  );
}
