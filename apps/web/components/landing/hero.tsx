import Link from "next/link";
import { HeroTransformation } from "./hero-transformation";
import { Reveal } from "./reveal";
import { sourceProofs } from "./provenance-data";

const heroSource = sourceProofs.find((proof) => proof.file === "landing-hero.video.md");

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-28 sm:px-5 md:px-10 md:pb-28 md:pt-36">
      <div aria-hidden="true" className="landing-grid-lines absolute inset-x-0 top-16 h-[720px] opacity-30" />
      <div aria-hidden="true" className="registration-mark absolute left-5 top-24 hidden xl:block" />
      <div aria-hidden="true" className="registration-mark absolute bottom-16 right-8 hidden xl:block" />

      <div className="relative mx-auto max-w-[1520px]">
        <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-end">
          <div>
            <Reveal>
              <p className="mb-6 flex items-center gap-3 font-mono text-[12px] tracking-[-0.02em] text-[color:var(--landing-muted)]">
                <span aria-hidden="true" className="size-2 rounded-[2px] bg-[color:var(--landing-accent)]" />
                provenance-native video pipeline
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="landing-display-tight max-w-[980px] text-[clamp(2.85rem,7.1vw,6.35rem)] font-medium leading-[0.86] tracking-[-0.065em]">
                write markdown.
                <br />
                <span className="text-[color:var(--landing-faint)]">render the video.</span>
              </h1>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="lg:pb-2">
            <p className="max-w-[590px] text-[18px] leading-[1.45] tracking-[-0.018em] text-[color:var(--landing-muted)] md:text-[20px]">
              Markdown Video turns a readable document into a real MP4 — in the editor, from the CLI, in CI,
              or by an agent — without a timeline or hidden project file.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href="/editor"
                className="tool-button tool-button-primary h-9 px-4 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--landing-paper)]"
              >
                Open the editor
              </Link>
              <a
                href="#mcp"
                className="group inline-flex min-h-11 items-center text-[15px] font-medium underline decoration-[color:var(--landing-line)] decoration-1 underline-offset-[3px] transition-colors hover:decoration-[color:var(--landing-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--landing-paper)]"
              >
                Let an agent render it
                <span aria-hidden="true" className="ml-2 transition-transform group-hover:translate-x-1">
                  →
                </span>
              </a>
            </div>
            {heroSource ? (
              <p className="mt-6 font-mono text-[11px] leading-relaxed text-[color:var(--landing-muted)]">
                the artifact below is{" "}
                <a
                  href={heroSource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[color:var(--landing-ink)] underline decoration-[color:var(--landing-line)] underline-offset-[3px] hover:decoration-[color:var(--landing-accent)]"
                >
                  {heroSource.file}
                </a>{" "}
                · {heroSource.bytes.toLocaleString()} bytes
              </p>
            ) : null}
          </Reveal>
        </div>

        <Reveal delay={0.16} className="mt-12 md:mt-16">
          <HeroTransformation />
        </Reveal>
      </div>
    </section>
  );
}
