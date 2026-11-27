import Image from "next/image";
import { Reveal } from "./reveal";

type EvidenceRow = {
  capability: string;
  syntax: string;
  proof: string;
  href: string;
  image?: {
    src: string;
    alt: string;
  };
};

const evidenceRows: EvidenceRow[] = [
  {
    capability: "typography",
    syntax: "fontFamily: serif | sans | mono | display\nsize: 2xl",
    proof: "pipeline-frame-1.webp uses display type rendered from the document, not a static mockup.",
    href: "/landing/pipeline-frame-1.webp",
    image: {
      src: "/landing/pipeline-frame-1.webp",
      alt: "Rendered typography frame showing write markdown render the video",
    },
  },
  {
    capability: "transitions",
    syntax: "!transition fade\n!transition slide 0.5s\n!transition wipe | zoom | magic | none",
    proof: "hero-showcase.mp4 crosses four scene boundaries using the declared fade transitions.",
    href: "/landing/hero-showcase.mp4",
  },
  {
    capability: "animation",
    syntax: "animation: fadeIn | slideUp | slideDown | slideLeft\nanimation: slideRight | bounceIn | zoomIn | typewriter | none",
    proof: "pipeline-frame-4.webp is the closing slideUp scene captured by the renderer.",
    href: "/landing/pipeline-frame-4.webp",
    image: {
      src: "/landing/pipeline-frame-4.webp",
      alt: "Rendered closing animation frame with the text agents CI music locales",
    },
  },
  {
    capability: "audio",
    syntax: "!music ./assets/landing-theme.mp3 volume:0.32 fade:0.7s loop:true",
    proof: "captions-demo.mp4 carries an AAC mix of the referenced music file.",
    href: "/landing/captions-demo.mp4",
  },
  {
    capability: "captions",
    syntax: "markdown-video render video.md -o out.mp4\n# writes out.srt + out.vtt\nmarkdown-video render video.md -o captioned.mp4 --burn-captions",
    proof: "the VTT contains real timeline cues; the poster is extracted from a burn-in render.",
    href: "/landing/captions-demo.vtt",
  },
  {
    capability: "localization",
    syntax: "!locales en es\n!text i18n:headline\nmarkdown-video render video.md --locale es",
    proof: "the English and Spanish frames are direct preview captures of the same source.",
    href: "/landing/i18n-es.webp",
    image: {
      src: "/landing/i18n-es.webp",
      alt: "Spanish localized frame rendered from the shared markdown source",
    },
  },
  {
    capability: "resolution + fps",
    syntax: "--resolution 480p | 720p | 1080p | 1440p | 4k\n--fps 1..60 --aspect-ratio 16:9 | 9:16 | 1:1 | 4:3",
    proof: "launch.mp4 probes as 1920×1080 H.264 at 30fps; hero-showcase.mp4 as 960×720 at 18fps.",
    href: "/landing/launch.mp4",
  },
];

export function Capabilities() {
  return (
    <section
      id="capabilities"
      className="relative scroll-mt-20 border-t border-[color:var(--landing-line)]/70 px-4 py-20 sm:px-5 md:px-10 md:py-28"
      aria-labelledby="capabilities-heading"
    >
      <div className="mx-auto max-w-[1520px]">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <Reveal>
            <p className="flex items-center gap-3 font-mono text-[12px] tracking-[-0.02em] text-[color:var(--landing-muted)]">
              <span aria-hidden="true" className="size-2 rounded-[2px] bg-[color:var(--landing-accent)]" />
              capabilities as proof
            </p>
            <h2
              id="capabilities-heading"
              className="landing-display-tight mt-6 max-w-[860px] text-[clamp(2.65rem,5.6vw,5.9rem)] font-medium leading-[0.9] tracking-[-0.06em]"
            >
              no testimonials.
              <br />
              <span className="text-[color:var(--landing-faint)]">just evidence.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="max-w-[620px] text-[18px] leading-[1.48] tracking-[-0.015em] text-[color:var(--landing-muted)] lg:ml-auto">
              Every row names real syntax and points at an artifact rendered from it. If a capability cannot be
              inspected in the repository or the output, it does not belong on this page.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="mt-12 overflow-hidden rounded-md border border-[color:var(--landing-line)]">
            <div className="hidden grid-cols-[170px_minmax(0,1fr)_minmax(0,1fr)_150px] gap-px border-b border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/70 px-4 py-3 font-mono text-[10.5px] text-[color:var(--landing-muted)] lg:grid">
              <span>capability</span>
              <span>real syntax</span>
              <span>artifact evidence</span>
              <span>inspect</span>
            </div>
            <div className="divide-y divide-[color:var(--landing-line)]/75">
              {evidenceRows.map((row) => (
                <article key={row.capability} className="grid gap-4 px-4 py-5 lg:grid-cols-[170px_minmax(0,1fr)_minmax(0,1fr)_150px] lg:items-center">
                  <h3 className="text-[18px] font-medium tracking-[-0.025em]">{row.capability}</h3>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-[color:var(--landing-line)]/65 bg-[color:var(--landing-code-bg)] px-3 py-2 font-mono text-[10.5px] leading-[1.6] text-[color:var(--landing-ink)]">
                    <code>{row.syntax}</code>
                  </pre>
                  <div className="flex items-center gap-3">
                    {row.image ? (
                      <Image
                        src={row.image.src}
                        alt={row.image.alt}
                        width={960}
                        height={720}
                        sizes="96px"
                        className="hidden aspect-[4/3] w-24 shrink-0 rounded-[4px] border border-[color:var(--landing-line)]/60 object-cover sm:block"
                      />
                    ) : null}
                    <p className="text-[13.5px] leading-[1.48] text-[color:var(--landing-muted)]">{row.proof}</p>
                  </div>
                  <a
                    href={row.href}
                    className="inline-flex min-h-8 items-center font-mono text-[11px] text-[color:var(--landing-ink)] underline decoration-[color:var(--landing-line)] underline-offset-[3px] hover:decoration-[color:var(--landing-accent)]"
                  >
                    open artifact →
                  </a>
                </article>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
