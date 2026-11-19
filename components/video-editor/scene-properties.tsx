"use client";

import { useVideoStore } from "@/lib/use-video-store";
import { useMemo, useCallback } from "react";
import { Label } from "@components/ui/label";
import {
  Layers,
  Type,
  Code,
  ImageIcon,
  Clock,
  Palette,
  Sparkles,
  Terminal,
  BarChart3,
  Smartphone,
  MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourceRange, SceneSourceMap } from "@/lib/types";

interface ClickablePropertyProps {
  children: React.ReactNode;
  sourceRange?: SourceRange;
  className?: string;
}

function ClickableProperty({ children, sourceRange, className }: ClickablePropertyProps) {
  const setHighlightRange = useVideoStore((state) => state.setHighlightRange);
  const highlightRange = useVideoStore((state) => state.highlightRange);
  
  const isHighlighted = highlightRange && sourceRange && 
    highlightRange.startLine === sourceRange.startLine && 
    highlightRange.endLine === sourceRange.endLine;

  const handleClick = useCallback(() => {
    if (sourceRange) {
      setHighlightRange(sourceRange);
    }
  }, [sourceRange, setHighlightRange]);

  if (!sourceRange) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "cursor-pointer transition-all duration-200 rounded-lg relative group",
        "hover:ring-2 hover:ring-pink-500/50 hover:bg-pink-500/5",
        isHighlighted && "ring-2 ring-pink-500 bg-pink-500/10",
        className
      )}
    >
      {children}
      <div className={cn(
        "absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
        isHighlighted && "opacity-100"
      )}>
        <div className="bg-pink-500 rounded-full p-0.5">
          <MousePointerClick className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
    </div>
  );
}

export function SceneProperties() {
  const scenes = useVideoStore((state) => state.scenes);
  const currentTime = useVideoStore((state) => state.currentTime);

  const currentScene = useMemo(() => {
    let accTime = 0;
    for (const scene of scenes) {
      if (currentTime >= accTime && currentTime < accTime + scene.duration) {
        return scene;
      }
      accTime += scene.duration;
    }
    return scenes[scenes.length - 1] || null;
  }, [scenes, currentTime]);
  
  const sourceMap = currentScene?.sourceMap;

  if (!currentScene) {
    return (
      <div className="w-72 bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 p-4">
        <h3 className="text-sm font-medium mb-4 text-gray-900 dark:text-neutral-100">
          Scene Properties
        </h3>
        <p className="text-sm text-gray-600 dark:text-neutral-400">No scene selected</p>
      </div>
    );
  }

  const typeIcons: Record<string, typeof Layers> = {
    text: Type,
    code: Code,
    image: ImageIcon,
    video: Layers,
    split: Layers,
    terminal: Terminal,
    chart: BarChart3,
    mockup: Smartphone,
    diff: Code,
  };
  const TypeIcon = typeIcons[currentScene.type] || Layers;

  return (
    <div className="w-72 bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-neutral-800 shrink-0">
        <h3 className="text-sm font-medium text-gray-900 dark:text-neutral-100">Scene Properties</h3>
        <p className="text-xs text-gray-600 dark:text-neutral-400 mt-1 flex items-center gap-1">
          <MousePointerClick className="w-3 h-3 text-pink-500 dark:text-pink-400" />
          Click any property to jump to its code
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
        {/* Scene Type */}
        <ClickableProperty sourceRange={sourceMap?.type}>
          <div className="space-y-2">
            <Label className="text-xs text-gray-600 dark:text-neutral-400 flex items-center gap-2">
              <Layers className="w-3 h-3" />
              Type
            </Label>
            <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
              <TypeIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <span className="text-sm text-gray-900 dark:text-neutral-100 capitalize">
                {currentScene.type}
              </span>
            </div>
          </div>
        </ClickableProperty>

        {/* Duration */}
        <ClickableProperty sourceRange={sourceMap?.duration}>
          <div className="space-y-2">
            <Label className="text-xs text-gray-600 dark:text-neutral-400 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Duration
            </Label>
            <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
              <span className="text-sm text-gray-900 dark:text-neutral-100">{currentScene.duration}s</span>
            </div>
          </div>
        </ClickableProperty>

        {/* Background */}
        <ClickableProperty sourceRange={sourceMap?.background}>
          <div className="space-y-2">
            <Label className="text-xs text-gray-600 dark:text-neutral-400 flex items-center gap-2">
              <Palette className="w-3 h-3" />
              Background
            </Label>
            <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
              <div
                className="w-6 h-6 rounded border border-gray-300 dark:border-neutral-700 shrink-0"
                style={{ backgroundColor: currentScene.background || "#1e1e2e" }}
              />
              <span className="text-sm text-gray-900 dark:text-neutral-100 font-mono truncate">
                {currentScene.background || "#1e1e2e"}
              </span>
            </div>
          </div>
        </ClickableProperty>

        {/* Transition */}
        {currentScene.transition && (
          <ClickableProperty sourceRange={sourceMap?.transition}>
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 dark:text-neutral-400 flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Transition
              </Label>
              <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                <span className="text-sm text-gray-900 dark:text-neutral-100 capitalize">
                  {currentScene.transition}
                </span>
                {currentScene.transitionDuration && (
                  <span className="text-xs text-gray-500 dark:text-neutral-500 ml-2">
                    ({currentScene.transitionDuration}s)
                  </span>
                )}
              </div>
            </div>
          </ClickableProperty>
        )}

        {/* Chapter */}
        {currentScene.chapter && (
          <ClickableProperty sourceRange={sourceMap?.chapter}>
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 dark:text-neutral-400">Chapter</Label>
              <div className="p-2 bg-pink-50 dark:bg-pink-500/10 rounded-lg border border-pink-200 dark:border-pink-500/20">
                <span className="text-sm text-pink-600 dark:text-pink-400">
                  {currentScene.chapter}
                </span>
              </div>
            </div>
          </ClickableProperty>
        )}

        {/* Text Properties */}
        {currentScene.type === "text" && currentScene.text && (
          <ClickableProperty sourceRange={sourceMap?.text}>
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
              <h4 className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
                Text Settings
              </h4>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-neutral-400">Content</Label>
                <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                  <p className="text-sm text-gray-900 dark:text-neutral-100 line-clamp-3">
                    {currentScene.text.content}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">
                    Animation
                  </Label>
                  <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <span className="text-xs text-gray-900 dark:text-neutral-100">
                      {currentScene.text.animation || "fadeIn"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">Size</Label>
                  <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <span className="text-xs text-gray-900 dark:text-neutral-100">
                      {currentScene.text.size || "lg"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-neutral-400">
                  Font Family
                </Label>
                <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                  <span className="text-xs text-gray-900 dark:text-neutral-100 capitalize">
                    {currentScene.text.fontFamily || "serif"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-neutral-400">
                  Available Fonts
                </Label>
                <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 text-xs text-gray-600 dark:text-neutral-400 space-y-1">
                  <div>• serif (default)</div>
                  <div>• sans</div>
                  <div>• mono</div>
                  <div>• display</div>
                </div>
              </div>
            </div>
          </ClickableProperty>
        )}

        {/* Code Properties */}
        {currentScene.type === "code" && currentScene.code && (
          <ClickableProperty sourceRange={sourceMap?.code}>
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
              <h4 className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
                Code Settings
              </h4>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-neutral-400">Language</Label>
                <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                  <span className="text-sm text-gray-900 dark:text-neutral-100">
                    {currentScene.code.language}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">
                    Font Size
                  </Label>
                  <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <span className="text-xs text-gray-900 dark:text-neutral-100">
                      {currentScene.code.fontSize || "sm"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">
                    Font Family
                  </Label>
                  <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <span className="text-xs text-gray-900 dark:text-neutral-100">
                      {currentScene.code.fontFamily || "mono"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">Height</Label>
                  <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <span className="text-xs text-gray-900 dark:text-neutral-100">
                      {currentScene.code.height
                        ? `${currentScene.code.height}px`
                        : "auto"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">Width</Label>
                  <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <span className="text-xs text-gray-900 dark:text-neutral-100">
                      {currentScene.code.width
                        ? `${currentScene.code.width}px`
                        : "auto"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-neutral-400">
                  Available Fonts
                </Label>
                <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 text-xs text-gray-600 dark:text-neutral-400 space-y-1">
                  <div>• mono (default)</div>
                  <div>• jetbrains</div>
                  <div>• fira</div>
                  <div>• source</div>
                  <div>• inconsolata</div>
                  <div>• courier</div>
                </div>
              </div>

              {currentScene.code.highlight && (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">
                    Highlighted Lines
                  </Label>
                  <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <span className="text-sm text-amber-600 dark:text-yellow-400">
                      {currentScene.code.highlight.lines.join(", ")}
                    </span>
                  </div>
                </div>
              )}

              {currentScene.code.typing && (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">
                    Typing Effect
                  </Label>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                    <span className="text-sm text-emerald-600 dark:text-emerald-400">
                      Enabled @ {currentScene.code.typingSpeed || 40} chars/sec
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ClickableProperty>
        )}

        {/* Terminal Properties */}
        {currentScene.type === "terminal" && currentScene.terminal && (
          <ClickableProperty sourceRange={sourceMap?.terminal}>
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
              <h4 className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
                Terminal Settings
              </h4>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-neutral-400">Commands</Label>
                <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                  <span className="text-sm text-gray-900 dark:text-neutral-100">
                    {currentScene.terminal.commands?.length || 0} command(s)
                  </span>
                </div>
              </div>

              {currentScene.terminal.typing && (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">
                    Typing Effect
                  </Label>
                  <div className="p-2 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg border border-cyan-200 dark:border-cyan-500/20">
                    <span className="text-sm text-cyan-600 dark:text-cyan-400">
                      Speed: {currentScene.terminal.typingSpeed || 30}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ClickableProperty>
        )}

        {/* Chart Properties */}
        {currentScene.type === "chart" && currentScene.chart && (
          <ClickableProperty sourceRange={sourceMap?.chart}>
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
              <h4 className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
                Chart Settings
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">Type</Label>
                  <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <span className="text-xs text-gray-900 dark:text-neutral-100 capitalize">
                      {currentScene.chart.type}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600 dark:text-neutral-400">
                    Data Points
                  </Label>
                  <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <span className="text-xs text-gray-900 dark:text-neutral-100">
                      {currentScene.chart.data.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </ClickableProperty>
        )}

        {/* Mockup Properties */}
        {currentScene.type === "mockup" && currentScene.mockup && (
          <ClickableProperty sourceRange={sourceMap?.mockup}>
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
              <h4 className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
                Mockup Settings
              </h4>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-neutral-400">Device</Label>
                <div className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                  <span className="text-sm text-gray-900 dark:text-neutral-100 capitalize">
                    {currentScene.mockup.device}
                  </span>
                </div>
              </div>
            </div>
          </ClickableProperty>
        )}

        {/* Effects */}
        {(currentScene.particles ||
          currentScene.camera ||
          currentScene.presenter) && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
            <h4 className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
              Effects
            </h4>

            {currentScene.particles && (
              <ClickableProperty sourceRange={sourceMap?.particles}>
                <div className="p-2 bg-pink-50 dark:bg-pink-500/10 rounded-lg border border-pink-200 dark:border-pink-500/20">
                  <span className="text-sm text-pink-600 dark:text-pink-400 capitalize">
                    {currentScene.particles.type} (
                    {currentScene.particles.intensity || "medium"})
                  </span>
                </div>
              </ClickableProperty>
            )}

            {currentScene.camera && (
              <ClickableProperty sourceRange={sourceMap?.camera}>
                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20">
                  <span className="text-sm text-blue-600 dark:text-blue-400 capitalize">
                    Camera: {currentScene.camera.effect}{" "}
                    {currentScene.camera.value &&
                      `(${currentScene.camera.value})`}
                  </span>
                </div>
              </ClickableProperty>
            )}

            {currentScene.presenter && (
              <ClickableProperty sourceRange={sourceMap?.presenter}>
                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/20">
                  <span className="text-sm text-amber-600 dark:text-amber-400 capitalize">
                    Presenter: {currentScene.presenter.position}
                  </span>
                </div>
              </ClickableProperty>
            )}
          </div>
        )}
      </div>

      {/* Scene Count Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-neutral-800 shrink-0">
        <p className="text-xs text-gray-600 dark:text-neutral-400">
          {scenes.length} scene{scenes.length !== 1 ? "s" : ""} total
        </p>
      </div>
    </div>
  );
}
