import Link from "next/link";
import { Reveal } from "./reveal";

export function CTA() {
  return (
    <section className="relative overflow-hidden border-t border-[color:var(--landing-line)]/70 px-5 py-28 md:px-10 md:py-40" aria-labelledby="cta-heading">
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:var(--landing-line)]/75" />
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[980px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:var(--landing-line)]/45" />
      <div aria-hidden="true" className="registration-mark absolute left-8 top-10 hidden md:block" />

      <div className="relative mx-auto max-w-[980px] text-center">
        <Reveal>
          <p className="font-mono text-[12px] text-[color:var(--landing-muted)]">final render</p>
          <h2 id="cta-heading" className="landing-display-tight mt-6 text-[clamp(4rem,10vw,10rem)] font-medium leading-[0.85] tracking-[-0.065em]">
            write less.
            <br />
            <span className="text-[color:var(--landing-faint)]">render more.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-8 max-w-[570px] text-[18px] leading-[1.48] text-[color:var(--landing-muted)]">
            Start in the browser editor, or point your agent at the MCP server and let the document become the
            video pipeline.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <Link
              href="/editor"
              className="inline-flex h-12 items-center rounded-full bg-[color:var(--landing-ink)] px-6 text-[15px] font-medium text-[color:var(--landing-paper)] landing-action-shadow transition-colors hover:bg-[color:var(--landing-accent-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--landing-paper)]"
            >
              open the editor
            </Link>
            <a
              href="https://github.com/Avik-creator/markdown_video"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-[15px] font-medium underline decoration-[color:var(--landing-line)] underline-offset-8 transition-colors hover:decoration-[color:var(--landing-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--landing-paper)]"
            >
              read the source
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
