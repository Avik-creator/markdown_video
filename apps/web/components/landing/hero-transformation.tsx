"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export const HERO_SOURCE_LINES = [
  "!scene",
  "!duration 1.8",
  "!background #fff4ec",
  "!transition fade",
  "!text",
  "write markdown.",
  "render the video.",
  "size: 2xl",
  "color: #2b1030",
  "fontFamily: display",
  "animation: none",
  "",
  "---",
  "",
  "!scene",
  "!duration 2.4",
  "!background #130a24",
  "!transition fade",
  "!code",
  "typing: true",
  "speed: 85",
  "fontSize: lg",
  "fontFamily: jetbrains",
  "width: 1180",
  "```md",
  "!scene",
  "!duration 1.8",
  "!background #fff4ec",
  "!text",
  "write markdown.",
  "render the video.",
  "```",
  "",
  "---",
  "",
  "!scene",
  "!duration 2",
  "!background #0c0718",
  "!transition fade",
  "!terminal",
  "typing: true",
  "speed: 85",
  "$ markdown-video render landing-hero.video.md -o hero-showcase.mp4",
  "> 960×720 · 18fps · captions written",
  "",
  "---",
  "",
  "!scene",
  "!duration 1.8",
  "!background #ff4fa3",
  "!transition fade",
  "!text",
  "agents. CI. music. locales.",
  "size: 2xl",
  "color: #130a24",
  "fontFamily: sans",
  "animation: slideUp",
];

const SCENE_RANGES = [
  [0, 10],
  [14, 31],
  [35, 43],
  [47, 56],
] as const;

const SCENE_ENDS = [1.8, 4.2, 6.2, 8.1] as const;

function sceneIndexAt(time: number) {
  if (time < SCENE_ENDS[0]) return 0;
  if (time < SCENE_ENDS[1]) return 1;
  if (time < SCENE_ENDS[2]) return 2;
  return 3;
}

function toneForLine(line: string) {
  if (line.startsWith("!")) return "text-[#ffa24c]";
  if (line === "---" || line.startsWith("```")) return "text-[#8f7f99]";
  if (line.startsWith("$") || line.startsWith(">")) return "text-[#3ee6e0]";
  if (/^[A-Za-z][A-Za-z0-9]*:/.test(line)) return "text-[#ff8fbf]";
  if (/^#(?:[0-9a-f]{3}){1,2}$/i.test(line)) return "text-[#ffa24c]";
  return "text-[#f8edf5]";
}

export function HeroTransformation() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const reduceMotion = useReducedMotion();
  const [activeScene, setActiveScene] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reduceMotion) {
      video.pause();
      return;
    }

    void video.play().catch(() => {
      // Low-power and data-saving modes can refuse muted autoplay. The real
      // poster and controls still expose the complete artifact.
    });
  }, [reduceMotion]);

  useEffect(() => {
    const container = scrollRef.current;
    const firstLine = lineRefs.current[SCENE_RANGES[activeScene][0]];
    if (!container || !firstLine) return;

    container.scrollTo({
      top: Math.max(firstLine.offsetTop - 48, 0),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [activeScene, reduceMotion]);

  const updateFromVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;
    setActiveScene(sceneIndexAt(time));
    setCurrentTime(Math.floor(time * 10) / 10);
  };

  return (
    <figure
      className="relative"
      aria-labelledby="hero-transformation-title"
      aria-describedby="hero-transformation-description"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-[color:var(--landing-muted)]">
        <span id="hero-transformation-title">one readable input · one rendered output</span>
        <span aria-hidden="true">
          scene {String(activeScene + 1).padStart(2, "0")}/04 · {currentTime.toFixed(1)}s
        </span>
      </div>
      <p id="hero-transformation-description" className="sr-only">
        The markdown source on the left is the source for the MP4 on the right. As the video plays or is
        scrubbed, the lines that produced the current scene are highlighted.
      </p>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_72px_minmax(0,1.08fr)] lg:items-stretch">
        <div className="flex min-h-[360px] flex-col overflow-hidden rounded-md border border-white/12 bg-[#10081f] text-[#f8edf5] shadow-[0_1px_2px_var(--shadow)] lg:h-[400px] lg:min-h-0 xl:h-[520px]">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
            <span className="truncate font-mono text-[11px] text-[#c9b7ce]">examples/landing-hero.video.md</span>
            <span className="flex gap-1.5" aria-hidden="true">
              <i className="size-2 rounded-full bg-[#ef6056]" />
              <i className="size-2 rounded-full bg-[#e8bb45]" />
              <i className="size-2 rounded-full bg-[#59c36a]" />
            </span>
          </div>
          <div
            ref={scrollRef}
            className="relative max-h-[380px] flex-1 overflow-auto py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff4fa3] lg:max-h-none"
            aria-label="Full markdown source for the hero video"
            role="region"
            tabIndex={0}
          >
            {HERO_SOURCE_LINES.map((line, index) => {
              const active = index >= SCENE_RANGES[activeScene][0] && index <= SCENE_RANGES[activeScene][1];
              return (
                <div
                  key={`${index}-${line}`}
                  ref={(node) => {
                    lineRefs.current[index] = node;
                  }}
                  className={`grid grid-cols-[2.5rem_minmax(0,1fr)] border-l-2 px-3 font-mono text-[10.5px] leading-[1.55] transition-colors duration-200 sm:text-[11.5px] ${
                    active
                      ? "border-[#ff4fa3] bg-[#ff4fa3]/12"
                      : "border-transparent"
                  }`}
                >
                  <span aria-hidden="true" className={`select-none pr-3 text-right ${active ? "text-[#ffa24c]" : "text-[#75647d]"}`}>
                    {index + 1}
                  </span>
                  <code className={`whitespace-pre-wrap break-words ${toneForLine(line)} ${line ? "" : "min-h-[1.55em]"}`}>
                    {line || " "}
                  </code>
                </div>
              );
            })}
          </div>
          <div className="border-t border-white/10 px-4 py-2 font-mono text-[10px] text-[#c9b7ce]">
            highlighted lines are the scene being rendered
          </div>
        </div>

        <div aria-hidden="true" className="flex h-16 items-center justify-center lg:h-auto lg:flex-col lg:py-10">
          <span className="h-px w-10 bg-[color:var(--landing-line-strong)] lg:h-10 lg:w-px" />
          <span className="mx-2 grid size-9 shrink-0 rotate-90 place-items-center rounded-full border border-[color:var(--landing-line-strong)] bg-[color:var(--landing-paper)] font-mono text-[13px] text-[color:var(--landing-accent)] lg:my-2 lg:rotate-0">
            →
          </span>
          <span className="h-px w-10 bg-[color:var(--landing-line-strong)] lg:h-10 lg:w-px" />
          <span className="mt-0 hidden font-mono text-[10px] text-[color:var(--landing-muted)] lg:mt-3 lg:block [writing-mode:vertical-rl]">
            markdown-video render
          </span>
        </div>

        <div className="landing-card overflow-hidden rounded-md p-2 sm:p-3">
          <video
            ref={videoRef}
            controls
            muted
            loop
            playsInline
            preload="metadata"
            width={960}
            height={720}
            poster="/landing/hero-showcase-poster.webp"
            aria-label="Rendered MP4 produced from the adjacent markdown source"
            className="block aspect-[4/3] w-full rounded-[6px] bg-[#fff4ec]"
            onTimeUpdate={updateFromVideo}
            onSeeked={updateFromVideo}
          >
            <source src="/landing/hero-showcase.mp4" type="video/mp4" />
            <track kind="captions" src="/landing/hero-showcase.vtt" srcLang="en" label="English" default />
            Your browser does not support the video tag.
          </video>
          <figcaption className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-3 font-mono text-[11px] text-[color:var(--landing-muted)]">
            <span>hero-showcase.mp4</span>
            <span>960×720 · 18fps · generated vtt</span>
          </figcaption>
        </div>
      </div>
    </figure>
  );
}
