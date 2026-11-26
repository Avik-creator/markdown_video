import { Reveal } from "./reveal";

const documentExample = `!locales en es
!strings
headline:
  en: "One source, every locale."
  es: "Una fuente, cada idioma."

!scene
!duration 2
!background #f4f0e6
!text i18n:headline
size: 2xl
fontFamily: display
animation: none`;

const cliExample = `markdown-video render video.md -o out.mp4 \\
  --resolution 720p --fps 24 --locale es`;

export function TypeSpecimen() {
  return (
    <section className="relative overflow-hidden border-y border-[color:var(--landing-line)]/70 py-20 md:py-28" aria-labelledby="type-heading">
      <h2 id="type-heading" className="sr-only">
        Typography and rendering specimen
      </h2>
      <div aria-hidden="true" className="landing-ruler absolute left-0 right-0 top-8 h-3 opacity-60" />
      <div className="mx-auto max-w-[1520px] px-5 md:px-10">
        <Reveal>
          <div className="flex flex-col leading-none">
            <span className="landing-serif-tight text-[clamp(5rem,15vw,16rem)] font-bold tracking-[-0.075em]">
              markdown
            </span>
            <span className="landing-outline-word landing-display-tight self-end text-[clamp(4.6rem,13vw,14rem)] font-semibold tracking-[-0.075em]">
              render
            </span>
            <span className="mt-2 font-mono text-[clamp(3.8rem,10vw,10rem)] font-semibold tracking-[-0.11em] text-[color:var(--landing-accent)]">
              .mp4
            </span>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-12 flex flex-col justify-between gap-5 border-t border-[color:var(--landing-line)] pt-5 font-mono text-[11px] leading-relaxed text-[color:var(--landing-muted)] md:flex-row">
            <span>type is content here — not decoration</span>
            <span>renderer fontFamily values: serif / sans / mono / display</span>
            <span>animations: fadeIn / slideUp / typewriter / none</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function SyntaxDemo() {
  return (
    <section className="relative px-5 py-24 md:px-10 md:py-32" aria-labelledby="document-heading">
      <div className="mx-auto max-w-[1520px]">
        <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <Reveal>
            <p className="flex items-center gap-3 font-mono text-[12px] text-[color:var(--landing-muted)]">
              <span aria-hidden="true" className="size-2 rounded-[2px] bg-[color:var(--landing-accent)]" />
              the document is the interface
            </p>
            <h2 id="document-heading" className="landing-display-tight mt-6 text-[clamp(3rem,6vw,6.4rem)] font-medium leading-[0.9] tracking-[-0.06em]">
              no timeline.
              <br />
              <span className="text-[color:var(--landing-faint)]">no hidden project file.</span>
            </h2>
            <p className="mt-7 max-w-[560px] text-[18px] leading-[1.48] tracking-[-0.015em] text-[color:var(--landing-muted)]">
              Scenes, text, code, mockups, music, captions, and localization live in readable markdown. Diff it in
              review, generate it with an agent, then render the same file locally or in CI.
            </p>

            <div className="mt-9 overflow-x-auto rounded-[14px] border border-[color:var(--landing-line)] bg-[color:var(--landing-code-bg)] px-4 py-3 font-mono text-[11.5px] leading-relaxed shadow-[inset_0_1px_0_var(--landing-inset-highlight)]">
              <code className="whitespace-pre">{cliExample}</code>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="landing-dark-card relative rounded-[20px] p-4 text-[#f4efe2] sm:p-5">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                <span className="font-mono text-[11px] text-white/48">landing-i18n.video.md</span>
                <span className="rounded-full border border-white/12 px-2.5 py-1 font-mono text-[10px] text-white/58">
                  utf-8 markdown
                </span>
              </div>
              <pre className="overflow-x-auto font-mono text-[12px] leading-[1.75] text-white/84 sm:text-[12.5px]">
                {documentExample}
              </pre>
              <div className="mt-5 grid gap-px overflow-hidden rounded-[12px] border border-white/10 bg-white/10 font-mono text-[10.5px] text-white/62 sm:grid-cols-3">
                <span className="bg-[color:var(--landing-dark-card-bg)] px-3 py-2">01 parse directives</span>
                <span className="bg-[color:var(--landing-dark-card-bg)] px-3 py-2">02 rasterize scenes</span>
                <span className="bg-[color:var(--landing-dark-card-bg)] px-3 py-2">03 encode mp4 + sidecars</span>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.14}>
          <div className="mt-20 grid border-y border-[color:var(--landing-line)] md:grid-cols-4">
            {[
              ["write", "plain markdown, readable in review"],
              ["preview", "iterate in the editor or through MCP"],
              ["render", "CLI flags control resolution, fps, speed, aspect ratio"],
              ["publish", "attach MP4s and caption sidecars to releases"],
            ].map(([title, copy], index) => (
              <div
                key={title}
                className={`border-[color:var(--landing-line)]/75 px-5 py-7 ${
                  index > 0 ? "border-t md:border-l md:border-t-0" : ""
                }`}
              >
                <span className="font-mono text-[11px] text-[color:var(--landing-muted)]">0{index + 1}</span>
                <h3 className="mt-5 text-[22px] font-medium tracking-[-0.035em]">{title}</h3>
                <p className="mt-2 text-[14px] leading-[1.45] text-[color:var(--landing-muted)]">{copy}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
