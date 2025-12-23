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
      <div className="w-72 bg-[#0f0f14] border-l border-white/10 p-4">
        <h3 className="text-sm font-medium mb-4 text-white">
          Scene Properties
        </h3>
        <p className="text-sm text-muted-foreground">No scene selected</p>
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
    <div className="w-72 bg-[#0f0f14] border-l border-white/10 flex flex-col h-full">
      <div className="p-4 border-b border-white/10 shrink-0">
        <h3 className="text-sm font-medium text-white">Scene Properties</h3>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <MousePointerClick className="w-3 h-3 text-pink-400" />
          Click any property to jump to its code
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
        {/* Scene Type */}
        <ClickableProperty sourceRange={sourceMap?.type}>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Layers className="w-3 h-3" />
              Type
            </Label>
            <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
              <TypeIcon className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-white capitalize">
                {currentScene.type}
              </span>
            </div>
          </div>
        </ClickableProperty>

        {/* Duration */}
        <ClickableProperty sourceRange={sourceMap?.duration}>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Duration
            </Label>
            <div className="p-2 bg-white/5 rounded-lg">
              <span className="text-sm text-white">{currentScene.duration}s</span>
            </div>
          </div>
        </ClickableProperty>

        {/* Background */}
        <ClickableProperty sourceRange={sourceMap?.background}>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Palette className="w-3 h-3" />
              Background
            </Label>
            <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
              <div
                className="w-6 h-6 rounded border border-white/20 shrink-0"
                style={{ backgroundColor: currentScene.background || "#1e1e2e" }}
              />
              <span className="text-sm text-white font-mono truncate">
                {currentScene.background || "#1e1e2e"}
              </span>
            </div>
          </div>
        </ClickableProperty>

        {/* Transition */}
        {currentScene.transition && (
          <ClickableProperty sourceRange={sourceMap?.transition}>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Transition
              </Label>
              <div className="p-2 bg-white/5 rounded-lg">
                <span className="text-sm text-white capitalize">
                  {currentScene.transition}
                </span>
                {currentScene.transitionDuration && (
                  <span className="text-xs text-muted-foreground ml-2">
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
              <Label className="text-xs text-muted-foreground">Chapter</Label>
              <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20">
                <span className="text-sm text-pink-400">
                  {currentScene.chapter}
                </span>
              </div>
            </div>
          </ClickableProperty>
        )}

        {/* Text Properties */}
        {currentScene.type === "text" && currentScene.text && (
          <ClickableProperty sourceRange={sourceMap?.text}>
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Text Settings
              </h4>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Content</Label>
                <div className="p-2 bg-white/5 rounded-lg">
                  <p className="text-sm text-white line-clamp-3">
                    {currentScene.text.content}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Animation
                  </Label>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <span className="text-xs text-white">
                      {currentScene.text.animation || "fadeIn"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Size</Label>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <span className="text-xs text-white">
                      {currentScene.text.size || "lg"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Font Family
                </Label>
                <div className="p-2 bg-white/5 rounded-lg">
                  <span className="text-xs text-white capitalize">
                    {currentScene.text.fontFamily || "serif"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Available Fonts
                </Label>
                <div className="p-2 bg-white/5 rounded-lg text-xs text-gray-300 space-y-1">
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
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Code Settings
              </h4>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Language</Label>
                <div className="p-2 bg-white/5 rounded-lg">
                  <span className="text-sm text-white">
                    {currentScene.code.language}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Font Size
                  </Label>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <span className="text-xs text-white">
                      {currentScene.code.fontSize || "sm"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Font Family
                  </Label>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <span className="text-xs text-white">
                      {currentScene.code.fontFamily || "mono"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Height</Label>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <span className="text-xs text-white">
                      {currentScene.code.height
                        ? `${currentScene.code.height}px`
                        : "auto"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Width</Label>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <span className="text-xs text-white">
                      {currentScene.code.width
                        ? `${currentScene.code.width}px`
                        : "auto"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Available Fonts
                </Label>
                <div className="p-2 bg-white/5 rounded-lg text-xs text-gray-300 space-y-1">
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
                  <Label className="text-xs text-muted-foreground">
                    Highlighted Lines
                  </Label>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <span className="text-sm text-yellow-400">
                      {currentScene.code.highlight.lines.join(", ")}
                    </span>
                  </div>
                </div>
              )}

              {currentScene.code.typing && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Typing Effect
                  </Label>
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <span className="text-sm text-emerald-400">
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
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Terminal Settings
              </h4>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Commands</Label>
                <div className="p-2 bg-white/5 rounded-lg">
                  <span className="text-sm text-white">
                    {currentScene.terminal.commands?.length || 0} command(s)
                  </span>
                </div>
              </div>

              {currentScene.terminal.typing && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Typing Effect
                  </Label>
                  <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <span className="text-sm text-cyan-400">
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
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Chart Settings
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <span className="text-xs text-white capitalize">
                      {currentScene.chart.type}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Data Points
                  </Label>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <span className="text-xs text-white">
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
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Mockup Settings
              </h4>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Device</Label>
                <div className="p-2 bg-white/5 rounded-lg">
                  <span className="text-sm text-white capitalize">
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
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Effects
            </h4>

            {currentScene.particles && (
              <ClickableProperty sourceRange={sourceMap?.particles}>
                <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20">
                  <span className="text-sm text-pink-400 capitalize">
                    {currentScene.particles.type} (
                    {currentScene.particles.intensity || "medium"})
                  </span>
                </div>
              </ClickableProperty>
            )}

            {currentScene.camera && (
              <ClickableProperty sourceRange={sourceMap?.camera}>
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <span className="text-sm text-blue-400 capitalize">
                    Camera: {currentScene.camera.effect}{" "}
                    {currentScene.camera.value &&
                      `(${currentScene.camera.value})`}
                  </span>
                </div>
              </ClickableProperty>
            )}

            {currentScene.presenter && (
              <ClickableProperty sourceRange={sourceMap?.presenter}>
                <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <span className="text-sm text-amber-400 capitalize">
                    Presenter: {currentScene.presenter.position}
                  </span>
                </div>
              </ClickableProperty>
            )}
          </div>
        )}
      </div>

      {/* Scene Count Footer - Added shrink-0 */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <p className="text-xs text-muted-foreground">
          {scenes.length} scene{scenes.length !== 1 ? "s" : ""} total
        </p>
      </div>
    </div>
  );
}
