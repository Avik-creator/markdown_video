"use client";

import type { Scene } from "@markdown-video/core";
import {
  materializeSplitPanel,
  splitGridStyle,
  type SplitPanel as SplitPanelData,
  type SplitSide,
} from "../utils/split-layout.js";
import { ChartScene } from "./ChartScene.js";
import { CodeScene } from "./CodeScene.js";
import { CountdownScene } from "./CountdownScene.js";
import { DiffScene } from "./DiffScene.js";
import { EmojiScene } from "./EmojiScene.js";
import { ImageScene } from "./ImageScene.js";
import { MockupScene } from "./MockupScene.js";
import { ProgressScene } from "./ProgressScene.js";
import { QRScene } from "./QRScene.js";
import { TerminalScene } from "./TerminalScene.js";
import { TextScene } from "./TextScene.js";
import { TimelineElementsOverlay } from "../components/TimelineElementsOverlay.js";

/**
 * Routes a scene to the same renderer used for top-level scenes. Split panels
 * also use this component, so nested content keeps its normal deterministic
 * sceneTime behavior instead of duplicating scene-specific rendering logic.
 */
export function SceneRenderer({
  scene,
  sceneTime,
  inheritedLocale,
}: {
  scene: Scene;
  sceneTime: number;
  /** Locale inherited from a containing composite scene. */
  inheritedLocale?: string;
}) {
  switch (scene.type) {
    case "text":
      return (
        <TextScene
          scene={scene}
          sceneTime={sceneTime}
          inheritedLocale={inheritedLocale}
        />
      );
    case "code":
      return <CodeScene scene={scene} sceneTime={sceneTime} />;
    case "terminal":
      return <TerminalScene scene={scene} sceneTime={sceneTime} />;
    case "diff":
      return <DiffScene scene={scene} sceneTime={sceneTime} />;
    case "chart":
      return <ChartScene scene={scene} sceneTime={sceneTime} />;
    case "mockup":
      return (
        <MockupScene
          scene={scene}
          sceneTime={sceneTime}
          inheritedLocale={inheritedLocale}
        />
      );
    case "split":
      return (
        <SplitScene
          scene={scene}
          sceneTime={sceneTime}
          inheritedLocale={inheritedLocale}
        />
      );
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
      return (
        <TextScene
          scene={scene}
          sceneTime={sceneTime}
          inheritedLocale={inheritedLocale}
        />
      );
  }
}

function SplitPanel({
  panel,
  parentScene,
  side,
  sceneTime,
  inheritedLocale,
}: {
  panel: SplitPanelData;
  parentScene: Scene;
  side: SplitSide;
  sceneTime: number;
  inheritedLocale?: string;
}) {
  const panelScene = materializeSplitPanel(panel, parentScene, side);

  return (
    <div
      data-split-panel={side}
      className="relative min-w-0 min-h-0 overflow-hidden"
      style={{ background: panel.background }}
    >
      <div className="absolute inset-0">
        <SceneRenderer
          scene={panelScene}
          sceneTime={sceneTime}
          inheritedLocale={inheritedLocale}
        />
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
  inheritedLocale,
}: {
  scene: Scene;
  sceneTime: number;
  inheritedLocale?: string;
}) {
  if (!scene.split) return null;

  const direction =
    scene.split.direction === "vertical" ? "vertical" : "horizontal";
  // A scene-level !locale override applies to the split scene as a whole.
  // Panels can still carry their own locale in programmatic/nested scene data;
  // TextScene gives the panel's own override precedence over this inherited one.
  const panelLocale = scene.locale ?? inheritedLocale;

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
        inheritedLocale={panelLocale}
      />
      <div data-split-divider="true" className="bg-white/10" />
      <SplitPanel
        panel={scene.split.right}
        parentScene={scene}
        side="right"
        sceneTime={sceneTime}
        inheritedLocale={panelLocale}
      />
    </div>
  );
}
