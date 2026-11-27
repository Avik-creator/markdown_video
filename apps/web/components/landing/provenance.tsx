import { Reveal } from "./reveal";
import { examplesUrl, sourceProofs } from "./provenance-data";

const launchExcerpt = `!music ./assets/launch-theme.mp3 volume:0.32 fade:0.6s loop:false

!scene
!duration 2.4
!background #130a24
!transition fade
!text
this video is a text file.
size: 2xl
color: #fff4ec
fontFamily: display
animation: fadeIn`;

export function Provenance() {
  const launchSource = sourceProofs[0];

  return (
    <section
      id="provenance"
      className="relative scroll-mt-20 border-t border-[color:var(--landing-line)]/70 px-4 py-20 sm:px-5 md:px-10 md:py-28"
      aria-labelledby="provenance-heading"
    >
      <div className="mx-auto max-w-[1520px]">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <Reveal>
            <p className="flex items-center gap-3 font-mono text-[12px] tracking-[-0.02em] text-[color:var(--landing-muted)]">
              <span aria-hidden="true" className="size-2 rounded-[2px] bg-[color:var(--landing-accent)]" />
              provenance
            </p>
            <h2
              id="provenance-heading"
              className="landing-display-tight mt-6 max-w-[860px] text-[clamp(2.65rem,5.6vw,5.9rem)] font-medium leading-[0.9] tracking-[-0.06em]"
            >
              everything video-shaped here began as text.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="max-w-[620px] text-[18px] leading-[1.48] tracking-[-0.015em] text-[color:var(--landing-muted)] lg:ml-auto">
              No stock motion graphics, no screenshots of a separate tool, no decorative fake player. The clips,
              posters, frames, and caption sidecars on this page were rendered from readable files in{" "}
              <a
                href={examplesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--landing-ink)] underline decoration-[color:var(--landing-line)] underline-offset-[3px] hover:decoration-[color:var(--landing-accent)]"
              >
                examples/
              </a>
              . Open the sources and compare them with the pixels.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="mt-12 grid border-y border-[color:var(--landing-line)] py-7 md:grid-cols-[1fr_auto] md:items-end md:gap-10">
            <p className="landing-display-tight max-w-[900px] text-[clamp(2.15rem,4.7vw,4.9rem)] font-medium leading-[0.94] tracking-[-0.055em]">
              even our launch video is a <span className="mark-highlight">1.8kb text file</span>.
            </p>
            <p className="mt-5 max-w-[360px] font-mono text-[11.5px] leading-[1.65] text-[color:var(--landing-muted)] md:mt-0 md:text-right">
              precisely: 1,837 bytes — small enough for one 4 KB filesystem block. The rendered proof is 26.4s
              of 1920×1080 H.264 video with AAC audio.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:items-start">
          <Reveal className="lg:col-span-8">
            <figure className="landing-card overflow-hidden rounded-md p-2 sm:p-3">
              <video
                controls
                playsInline
                preload="none"
                width={1920}
                height={1080}
                poster="/landing/launch-poster.png"
                aria-label="Markdown Video launch video rendered from launch.video.md"
                className="block aspect-video w-full rounded-[6px] bg-[#130a24]"
              >
                <source src="/landing/launch.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              <figcaption className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-3 font-mono text-[11px] text-[color:var(--landing-muted)]">
                <span>launch.mp4 · user-initiated playback · sound available</span>
                <span>1920×1080 · 30fps · vtt</span>
              </figcaption>
            </figure>
          </Reveal>

          <Reveal delay={0.08} className="lg:col-span-4">
            <div className="overflow-hidden rounded-md border border-white/12 bg-[#10081f] text-[#f8edf5]">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
                <span className="font-mono text-[11px] text-[#c9b7ce]">examples/launch.video.md</span>
                <a
                  href={launchSource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-[#ff8fbf] underline decoration-white/25 underline-offset-[3px] hover:decoration-[#ff8fbf]"
                >
                  open source
                </a>
              </div>
              <pre className="max-h-[330px] overflow-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-[11px] leading-[1.7] text-[#f8edf5]/88">
                <code>{launchExcerpt}</code>
              </pre>
              <div className="border-t border-white/10 px-4 py-3 font-mono text-[10.5px] leading-relaxed text-[#c9b7ce]">
                the file continues for seven more scenes; the whole source is smaller than this page&apos;s
                favicon.
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.14}>
          <div className="mt-10 overflow-hidden rounded-md border border-[color:var(--landing-line)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/68 px-4 py-3 font-mono text-[10.5px] text-[color:var(--landing-muted)] sm:grid-cols-[minmax(0,1.2fr)_90px_minmax(0,1.4fr)]">
              <span>readable source</span>
              <span className="text-right sm:text-left">bytes</span>
              <span className="hidden sm:block">rendered artifact</span>
            </div>
            <ul className="divide-y divide-[color:var(--landing-line)]/75">
              {sourceProofs.map((proof) => (
                <li key={proof.file}>
                  <a
                    href={proof.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-[13px] transition-colors hover:bg-[color:var(--landing-card)]/56 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--landing-accent)] sm:grid-cols-[minmax(0,1.2fr)_90px_minmax(0,1.4fr)]"
                  >
                    <span className="truncate font-mono text-[12px] text-[color:var(--landing-ink)]">
                      {proof.file}
                    </span>
                    <span className="text-right font-mono text-[11px] text-[color:var(--landing-muted)] sm:text-left">
                      {proof.bytes.toLocaleString()}
                    </span>
                    <span className="hidden truncate text-[color:var(--landing-muted)] sm:block">{proof.artifact}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
