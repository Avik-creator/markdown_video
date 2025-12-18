"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/types";
import { TextScene } from "./TextScene";
import { CodeScene } from "./CodeScene";
import { ImageScene } from "./ImageScene";

interface DeviceStyle {
  width: number;
  aspectRatio: number;
  borderRadius: string;
  frameColor: string;
  screenRadius: string;
  screenInset: number;
}

const deviceStyles: Record<string, DeviceStyle> = {
  iphone: {
    width: 90,
    aspectRatio: 9 / 19.5,
    borderRadius: "rounded-2xl",
    frameColor: "#1a1a1a",
    screenRadius: "rounded-xl",
    screenInset: 4,
  },
  ipad: {
    width: 140,
    aspectRatio: 3 / 4,
    borderRadius: "rounded-xl",
    frameColor: "#2a2a2a",
    screenRadius: "rounded-lg",
    screenInset: 6,
  },
  macbook: {
    width: 200,
    aspectRatio: 16 / 10,
    borderRadius: "rounded-t-lg",
    frameColor: "#333333",
    screenRadius: "rounded",
    screenInset: 0,
  },
  browser: {
    width: 200,
    aspectRatio: 16 / 9,
    borderRadius: "rounded-lg",
    frameColor: "#1f1f1f",
    screenRadius: "rounded-b-lg",
    screenInset: 0,
  },
  android: {
    width: 90,
    aspectRatio: 9 / 19,
    borderRadius: "rounded-xl",
    frameColor: "#1a1a1a",
    screenRadius: "rounded-lg",
    screenInset: 3,
  },
};

function MockupContent({
  contentScene,
  sceneTime,
}: {
  contentScene: Scene["mockup"];
  sceneTime: number;
}) {
  if (!contentScene?.content) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <span className="text-[8px]">Preview</span>
      </div>
    );
  }

  const content = contentScene.content;
  const mockScene: Scene = {
    id: "mockup-content",
    type: content.type || "text",
    duration: 0,
    background: content.background,
    text: content.text,
    code: content.code,
    image: content.image,
  };

  switch (content.type) {
    case "text":
      return <TextScene scene={mockScene} sceneTime={sceneTime} />;
    case "code":
      return <CodeScene scene={mockScene} sceneTime={sceneTime} />;
    case "image":
      return <ImageScene scene={mockScene} sceneTime={sceneTime} />;
    default:
      return (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <span className="text-[8px]">Preview</span>
        </div>
      );
  }
}

function IPhoneMockup({
  scene,
  style,
  sceneTime,
}: {
  scene: Scene;
  style: DeviceStyle;
  sceneTime: number;
}) {
  const mockup = scene.mockup!;
  const height = style.width / style.aspectRatio;

  return (
    <div
      className={cn(style.borderRadius, "relative shadow-xl overflow-hidden")}
      style={{
        width: style.width,
        height,
        backgroundColor: style.frameColor,
      }}
    >
      {/* Dynamic Island */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bg-black rounded-full z-20"
        style={{ top: 3, width: 28, height: 8 }}
      />
      {/* Screen */}
      <div
        className={cn("absolute overflow-hidden", style.screenRadius)}
        style={{
          inset: style.screenInset,
          backgroundColor: mockup.content.background || "#ffffff",
        }}
      >
        <MockupContent contentScene={mockup} sceneTime={sceneTime} />
      </div>
      {/* Home indicator */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bg-white/30 rounded-full z-20"
        style={{ bottom: 2, width: 32, height: 2 }}
      />
    </div>
  );
}

function AndroidMockup({
  scene,
  style,
  sceneTime,
}: {
  scene: Scene;
  style: DeviceStyle;
  sceneTime: number;
}) {
  const mockup = scene.mockup!;
  const height = style.width / style.aspectRatio;

  return (
    <div
      className={cn(style.borderRadius, "relative shadow-xl overflow-hidden")}
      style={{
        width: style.width,
        height,
        backgroundColor: style.frameColor,
      }}
    >
      {/* Camera */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bg-gray-800 rounded-full z-20 border border-gray-700"
        style={{ top: 4, width: 6, height: 6 }}
      />
      {/* Screen */}
      <div
        className={cn("absolute overflow-hidden", style.screenRadius)}
        style={{
          inset: style.screenInset,
          backgroundColor: mockup.content.background || "#ffffff",
        }}
      >
        <MockupContent contentScene={mockup} sceneTime={sceneTime} />
      </div>
    </div>
  );
}

function IPadMockup({
  scene,
  style,
  sceneTime,
}: {
  scene: Scene;
  style: DeviceStyle;
  sceneTime: number;
}) {
  const mockup = scene.mockup!;
  const height = style.width / style.aspectRatio;

  return (
    <div
      className={cn(style.borderRadius, "relative shadow-xl overflow-hidden")}
      style={{
        width: style.width,
        height,
        backgroundColor: style.frameColor,
      }}
    >
      {/* Camera */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bg-gray-700 rounded-full z-20"
        style={{ top: 4, width: 4, height: 4 }}
      />
      {/* Screen */}
      <div
        className={cn("absolute overflow-hidden", style.screenRadius)}
        style={{
          inset: style.screenInset,
          backgroundColor: mockup.content.background || "#ffffff",
        }}
      >
        <MockupContent contentScene={mockup} sceneTime={sceneTime} />
      </div>
    </div>
  );
}

function MacbookMockup({
  scene,
  style,
  sceneTime,
}: {
  scene: Scene;
  style: DeviceStyle;
  sceneTime: number;
}) {
  const mockup = scene.mockup!;
  const height = style.width / style.aspectRatio;

  return (
    <div className="flex flex-col items-center">
      {/* Screen */}
      <div
        className="rounded-t-lg relative shadow-xl overflow-hidden"
        style={{
          width: style.width,
          height,
          backgroundColor: style.frameColor,
          border: "3px solid #374151",
        }}
      >
        {/* Camera notch */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bg-gray-700 rounded-b z-20 flex items-center justify-center"
          style={{ top: 0, width: 24, height: 6 }}
        >
          <div className="w-1 h-1 bg-gray-500 rounded-full" />
        </div>
        {/* Screen content */}
        <div
          className={cn("w-full h-full overflow-hidden", style.screenRadius)}
          style={{ backgroundColor: mockup.content.background || "#ffffff" }}
        >
          <MockupContent contentScene={mockup} sceneTime={sceneTime} />
        </div>
      </div>
      {/* Base */}
      <div
        className="bg-gradient-to-b from-gray-600 to-gray-700 rounded-b"
        style={{ width: style.width * 1.05, height: 4 }}
      />
      <div
        className="bg-gray-500 rounded-b"
        style={{ width: style.width * 0.6, height: 2 }}
      />
    </div>
  );
}

function BrowserMockup({
  scene,
  style,
  sceneTime,
}: {
  scene: Scene;
  style: DeviceStyle;
  sceneTime: number;
}) {
  const mockup = scene.mockup!;
  const height = style.width / style.aspectRatio;

  return (
    <div
      className={cn(style.borderRadius, "relative shadow-xl overflow-hidden")}
      style={{
        width: style.width,
        backgroundColor: style.frameColor,
      }}
    >
      {/* Browser toolbar */}
      <div
        className="flex items-center gap-1 px-2 bg-gray-800 border-b border-gray-700"
        style={{ height: 18 }}
      >
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 mx-1">
          <div className="bg-gray-700 rounded px-1 py-0.5 text-[6px] text-gray-400 truncate">
            localhost:3000
          </div>
        </div>
      </div>
      {/* Browser content */}
      <div
        className={cn("overflow-hidden", style.screenRadius)}
        style={{
          height,
          backgroundColor: mockup.content.background || "#ffffff",
        }}
      >
        <MockupContent contentScene={mockup} sceneTime={sceneTime} />
      </div>
    </div>
  );
}

export function MockupScene({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  const mockup = scene.mockup;
  if (!mockup) return null;

  const style = deviceStyles[mockup.device] || deviceStyles.browser;
  const controls = useAnimation();

  useEffect(() => {
    if (sceneTime !== undefined) {
      const progress = Math.min(sceneTime / 0.5, 1);
      controls.set({
        opacity: progress,
        y: 20 * (1 - progress),
        scale: 0.95 + 0.05 * progress,
      });
    } else {
      controls.start({ opacity: 1, y: 0, scale: 1 });
    }
  }, [sceneTime, controls]);

  const renderDevice = () => {
    switch (mockup.device) {
      case "iphone":
        return (
          <IPhoneMockup scene={scene} style={style} sceneTime={sceneTime} />
        );
      case "android":
        return (
          <AndroidMockup scene={scene} style={style} sceneTime={sceneTime} />
        );
      case "ipad":
        return <IPadMockup scene={scene} style={style} sceneTime={sceneTime} />;
      case "macbook":
        return (
          <MacbookMockup scene={scene} style={style} sceneTime={sceneTime} />
        );
      case "browser":
      default:
        return (
          <BrowserMockup scene={scene} style={style} sceneTime={sceneTime} />
        );
    }
  };

  return (
    <motion.div
      className="flex items-center justify-center h-full w-full p-4"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={controls}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 20, stiffness: 100 }}
    >
      <div className="transform scale-100 origin-center">{renderDevice()}</div>
    </motion.div>
  );
}
