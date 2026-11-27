import Link from "next/link";
import { LoopingVideo } from "./looping-video";
import { Reveal } from "./reveal";

const sourceSnippet = `!scene
!duration 1.6
!background #f4f0e6
!transition fade
!text
write markdown.
get the mp4.
size: 2xl
fontFamily: display`;

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-32 md:px-10 md:pb-28 md:pt-40">
      <div aria-hidden="true" className="landing-grid-lines absolute inset-x-0 top-16 h-[620px] opacity-35" />
      <div aria-hidden="true" className="registration-mark absolute left-5 top-24 hidden xl:block" />
      <div aria-hidden="true" className="registration-mark absolute bottom-16 right-8 hidden xl:block" />

      <div className="relative mx-auto max-w-[1520px]">
        <div className="grid items-end gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
          <div className="max-w-[760px]">
            <Reveal>
              <p className="mb-7 flex items-center gap-3 font-mono text-[12px] tracking-[-0.02em] text-[color:var(--landing-muted)]">
                <span aria-hidden="true" className="size-2 rounded-[2px] bg-[color:var(--landing-accent)]" />
                markdown → mp4 · deterministic by design
              </p>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="landing-display-tight text-[clamp(3.7rem,8.5vw,7.6rem)] font-medium leading-[0.84] tracking-[-0.065em]">
                write markdown.
                <br />
                <span className="text-[color:var(--landing-faint)]">render the video.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-8 max-w-[590px] text-[19px] leading-[1.42] tracking-[-0.018em] text-[color:var(--landing-muted)] md:text-[21px]">
                markdown_video turns a plain document into real MP4s — in the editor, from the CLI, in CI, or
                by an AI agent through MCP.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Link
                  href="/editor"
                  className="tool-button tool-button-primary h-9 px-4 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--landing-paper)]"
                >
                  write in the editor
                </Link>
                <a
                  href="#mcp"
                  className="group inline-flex min-h-11 items-center text-[15px] font-medium underline decoration-[color:var(--landing-line)] decoration-1 underline-offset-[3px] transition-colors hover:decoration-[color:var(--landing-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--landing-paper)]"
                >
                  let an agent render it
                  <span aria-hidden="true" className="ml-2 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <dl className="mt-14 grid max-w-[620px] grid-cols-2 gap-x-8 gap-y-5 border-t border-[color:var(--landing-line)] pt-6 text-[13px] leading-snug sm:grid-cols-4">
                {[
                  ["12", "MCP tools"],
                  ["CI", "release action"],
                  ["SRT/VTT", "caption sidecars"],
                  ["multi", "locale renders"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt className="font-mono text-[11px] lowercase text-[color:var(--landing-muted)]">{label}</dt>
                    <dd className="mt-1 font-medium tracking-[-0.02em]">{value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal delay={0.16} className="relative lg:min-h-[590px]">
            <div className="relative lg:pl-14 lg:pt-16">
              <figure className="landing-card relative z-10 overflow-hidden rounded-md p-2 sm:p-3">
                <div className="overflow-hidden rounded-[13px]">
                  <LoopingVideo
                    src="/landing/hero-showcase.mp4"
                    poster="/landing/hero-showcase-poster.webp"
                    label="Rendered markdown_video hero demonstration"
                    className="block aspect-[4/3] w-full scale-[1.06] object-cover"
                  />
                </div>
                <figcaption className="flex items-center justify-between px-2 pb-1 pt-3 font-mono text-[11px] text-[color:var(--landing-muted)]">
                  <span>landing-hero.video.md</span>
                  <span>960×720 · 105 kb</span>
                </figcaption>
              </figure>

              <div className="landing-dark-card absolute -left-3 top-0 z-20 hidden w-[330px] -rotate-2 rounded-md p-4 text-[color:var(--landing-dark-card-ink)] md:block lg:-left-1">
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="font-mono text-[11px] text-white/46">source.md</span>
                  <span className="flex gap-1.5" aria-hidden="true">
                    <i className="size-2 rounded-full bg-[#ef6056]" />
                    <i className="size-2 rounded-full bg-[#e8bb45]" />
                    <i className="size-2 rounded-full bg-[#59c36a]" />
                  </span>
                </div>
                <pre className="overflow-hidden whitespace-pre-wrap font-mono text-[11.5px] leading-[1.65] text-white/82">
                  {sourceSnippet}
                </pre>
              </div>

              <div className="landing-card absolute -bottom-5 right-4 z-20 hidden rotate-1 rounded-full px-4 py-2 font-mono text-[11px] text-[color:var(--landing-muted)] sm:block">
                out.mp4 · deterministic render
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
