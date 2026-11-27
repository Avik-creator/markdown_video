"use client";

import Image from "next/image";
import { useState } from "react";
import { HERO_SOURCE_LINES } from "./hero-transformation";

const previewFrames = [
  {
    src: "/landing/pipeline-frame-1.webp",
    time: 0.9,
    label: "opening text scene",
  },
  {
    src: "/landing/pipeline-frame-2.webp",
    time: 3,
    label: "typed markdown scene",
  },
  {
    src: "/landing/pipeline-frame-3.webp",
    time: 5.9,
    label: "terminal render scene",
  },
  {
    src: "/landing/pipeline-frame-4.webp",
    time: 7.2,
    label: "closing accent scene",
  },
] as const;

const commandChain = `$ markdown-video preview examples/landing-hero.video.md \\
  --times 0.9,3,5.9,7.2 --resolution 720p \\
  --aspect-ratio 4:3 --output-dir preview-frames
✓ 4 exact-timeline PNG captures · 960×720

$ markdown-video render examples/landing-hero.video.md \\
  -o hero-showcase.mp4 --resolution 720p \\
  --aspect-ratio 4:3 --fps 18
✓ 144 frames · 8.0s · mp4 + srt + vtt`;

function ChainArrow({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--landing-muted)]">
      <span className="h-px min-w-6 flex-1 bg-[color:var(--landing-line-strong)]" />
      <span>{label}</span>
      <span className="text-[color:var(--landing-accent)]">→</span>
    </div>
  );
}

export function PipelineDemo() {
  const [frameIndex, setFrameIndex] = useState(1);
  const activeFrame = previewFrames[frameIndex];

  return (
    <section
      id="pipeline"
      className="relative scroll-mt-20 border-t border-[color:var(--landing-line)]/70 px-4 py-20 sm:px-5 md:px-10 md:py-28"
      aria-labelledby="pipeline-heading"
    >
      <div className="mx-auto max-w-[1520px]">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="flex items-center gap-3 font-mono text-[12px] tracking-[-0.02em] text-[color:var(--landing-muted)]">
              <span aria-hidden="true" className="size-2 rounded-[2px] bg-[color:var(--landing-accent)]" />
              source-to-output demo
            </p>
            <h2
              id="pipeline-heading"
              className="landing-display-tight mt-6 max-w-[820px] text-[clamp(2.65rem,5.6vw,5.9rem)] font-medium leading-[0.9] tracking-[-0.06em]"
            >
              watch the bytes become frames.
            </h2>
          </div>
          <p className="max-w-[620px] text-[18px] leading-[1.48] tracking-[-0.015em] text-[color:var(--landing-muted)] lg:ml-auto">
            <code>preview</code> seeks the real browser renderer and captures exact-timeline PNGs.{" "}
            <code>render</code> encodes the continuous frame sequence. Same document, same scene math, two
            inspectable kinds of output.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-md border border-white/12 bg-[#10081f] text-[#f8edf5]">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 font-mono text-[11px] text-[#c9b7ce]">
            <span>real command chain</span>
            <span>run from the repository root</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-[11px] leading-[1.7] text-[#f8edf5]/90 sm:text-[11.5px]">
            <code>{commandChain}</code>
          </pre>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-[0.82fr_1fr_1.12fr] xl:items-stretch">
          <article className="flex min-h-[320px] flex-col overflow-hidden rounded-md border border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/55 md:col-span-2 xl:col-span-1">
            <div className="border-b border-[color:var(--landing-line)]/75 p-4">
              <span className="font-mono text-[10.5px] text-[color:var(--landing-muted)]">01 · document</span>
              <h3 className="mt-2 text-[20px] font-medium tracking-[-0.03em]">the whole input stays readable</h3>
            </div>
            <div
              className="max-h-[330px] flex-1 overflow-auto bg-[#10081f] px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff4fa3] xl:max-h-[440px]"
              role="region"
              aria-label="Complete markdown source used for the pipeline demo"
              tabIndex={0}
            >
              <pre className="font-mono text-[10.5px] leading-[1.65] text-[#f8edf5]/86">
                <code>{HERO_SOURCE_LINES.join("\n")}</code>
              </pre>
            </div>
            <div className="border-t border-[color:var(--landing-line)]/75 px-4 py-3 font-mono text-[10.5px] text-[color:var(--landing-muted)]">
              examples/landing-hero.video.md · 751 bytes
            </div>
          </article>

          <article className="flex flex-col overflow-hidden rounded-md border border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/55">
            <div className="border-b border-[color:var(--landing-line)]/75 p-4">
              <span className="font-mono text-[10.5px] text-[color:var(--landing-muted)]">02 · preview frames</span>
              <h3 className="mt-2 text-[20px] font-medium tracking-[-0.03em]">scrub exact renderer captures</h3>
            </div>
            <div className="p-3">
              <Image
                src={activeFrame.src}
                alt={`Exact markdown-video preview frame at ${activeFrame.time} seconds: ${activeFrame.label}`}
                width={960}
                height={720}
                sizes="(min-width: 1280px) 30vw, (min-width: 768px) 44vw, 88vw"
                className="aspect-[4/3] w-full rounded-[6px] object-cover"
              />
              <div className="px-1 pt-4">
                <label htmlFor="pipeline-frame-scrub" className="flex items-center justify-between gap-4 font-mono text-[11px] text-[color:var(--landing-muted)]">
                  <span>exact timeline position</span>
                  <span className="text-[color:var(--landing-ink)]">t={activeFrame.time.toFixed(1)}s</span>
                </label>
                <input
                  id="pipeline-frame-scrub"
                  type="range"
                  min={0}
                  max={previewFrames.length - 1}
                  step={1}
                  value={frameIndex}
                  aria-valuetext={`${activeFrame.time.toFixed(1)} seconds, ${activeFrame.label}`}
                  onChange={(event) => setFrameIndex(Number(event.currentTarget.value))}
                  className="mt-3 w-full accent-[color:var(--landing-accent)]"
                />
                <div aria-hidden="true" className="mt-2 flex justify-between font-mono text-[9.5px] text-[color:var(--landing-muted)]">
                  {previewFrames.map((frame) => (
                    <span key={frame.time}>{frame.time.toFixed(1)}s</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-auto border-t border-[color:var(--landing-line)]/75 px-4 py-3 font-mono text-[10.5px] text-[color:var(--landing-muted)]">
              direct PNG capture · no video extraction
            </div>
          </article>

          <article className="flex flex-col overflow-hidden rounded-md border border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/55">
            <div className="border-b border-[color:var(--landing-line)]/75 p-4">
              <span className="font-mono text-[10.5px] text-[color:var(--landing-muted)]">03 · rendered mp4</span>
              <h3 className="mt-2 text-[20px] font-medium tracking-[-0.03em]">the continuous output matches</h3>
            </div>
            <figure className="p-3">
              <video
                controls
                muted
                loop
                playsInline
                preload="none"
                width={960}
                height={720}
                poster="/landing/hero-showcase-poster.webp"
                aria-label="Rendered MP4 output for the source-to-output pipeline demo"
                className="block aspect-[4/3] w-full rounded-[6px] bg-[#fff4ec]"
              >
                <source src="/landing/hero-showcase.mp4" type="video/mp4" />
                <track kind="captions" src="/landing/hero-showcase.vtt" srcLang="en" label="English" default />
                Your browser does not support the video tag.
              </video>
              <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-[10.5px] text-[color:var(--landing-muted)]">
                <span>same source · encoded mp4</span>
                <span>user-initiated playback</span>
              </figcaption>
            </figure>
            <div className="mt-auto border-t border-[color:var(--landing-line)]/75 px-4 py-3">
              <ChainArrow label="document → frames → mp4" />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
