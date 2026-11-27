import { Reveal } from "./reveal";
import { actionDocsUrl, cliRenderDocsUrl } from "./provenance-data";

const releaseExcerpt = `!scene
!duration 2
!text
markdown-video
size: xl
animation: fadeIn
fontFamily: display

---

!scene
!duration 2
!text
Release notes as code
size: lg
animation: slideUp
fontFamily: sans
!code
fontFamily: jetbrains
\`\`\`sh
markdown-video render release.md -o release.mp4
\`\`\``;

const proofRows = [
  {
    title: "readable in review",
    copy: "Scene order, timing, copy, color, and typography are visible before anything renders.",
    proof: "!duration 2 · animation: fadeIn",
  },
  {
    title: "diffable in PRs",
    copy: "A changed line is a changed line. Reviewers do not need to open a binary project file.",
    proof: "git diff -- examples/release.video.md",
  },
  {
    title: "agent-friendly",
    copy: "An agent can read, write, validate, preview, and render the same plaintext artifact.",
    proof: "render_video(markdown)",
  },
  {
    title: "local or CI",
    copy: "The CLI is canonical locally; the composite action invokes the same renderer in GitHub Actions.",
    proof: "markdown-video render input.md -o out.mp4",
  },
] as const;

export function MarkdownFirst() {
  return (
    <section
      id="markdown-first"
      className="relative scroll-mt-20 border-t border-[color:var(--landing-line)]/70 px-4 py-20 sm:px-5 md:px-10 md:py-28"
      aria-labelledby="markdown-first-heading"
    >
      <div className="mx-auto max-w-[1520px]">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <p className="flex items-center gap-3 font-mono text-[12px] tracking-[-0.02em] text-[color:var(--landing-muted)]">
              <span aria-hidden="true" className="size-2 rounded-[2px] bg-[color:var(--landing-accent)]" />
              markdown-first workflow
            </p>
            <h2
              id="markdown-first-heading"
              className="landing-display-tight mt-6 text-[clamp(2.65rem,5.6vw,5.9rem)] font-medium leading-[0.9] tracking-[-0.06em]"
            >
              no timeline.
              <br />
              <span className="text-[color:var(--landing-faint)]">no hidden project file.</span>
            </h2>
            <p className="mt-7 max-w-[580px] text-[18px] leading-[1.48] tracking-[-0.015em] text-[color:var(--landing-muted)]">
              The timeline is derived, not maintained. The project is the document: readable in review,
              diffable in a pull request, small enough for an agent&apos;s context window, and renderable in the
              same way locally or in CI.
            </p>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
              <a
                href={cliRenderDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] font-medium underline decoration-[color:var(--landing-line)] underline-offset-[3px] hover:decoration-[color:var(--landing-accent)]"
              >
                CLI render reference
              </a>
              <a
                href={actionDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] font-medium underline decoration-[color:var(--landing-line)] underline-offset-[3px] hover:decoration-[color:var(--landing-accent)]"
              >
                GitHub Action reference
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="grid overflow-hidden rounded-md border border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/50 md:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-[color:var(--landing-line)]/75 md:border-b-0 md:border-r">
                <div className="border-b border-[color:var(--landing-line)]/75 px-4 py-3 font-mono text-[10.5px] text-[color:var(--landing-muted)]">
                  examples/release.video.md · real excerpt
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words px-4 py-5 font-mono text-[11.5px] leading-[1.75] text-[color:var(--landing-ink)]">
                  <code>{releaseExcerpt}</code>
                </pre>
              </div>
              <div className="p-4 sm:p-5">
                <p className="font-mono text-[10.5px] text-[color:var(--landing-muted)]">what the workflow preserves</p>
                <div className="mt-4 space-y-3">
                  {proofRows.map((row, index) => (
                    <div key={row.title} className="rounded-md border border-[color:var(--landing-line)]/70 bg-[color:var(--landing-paper)]/52 p-4">
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-[10px] text-[color:var(--landing-muted)]">0{index + 1}</span>
                        <h3 className="text-[16px] font-medium tracking-[-0.02em]">{row.title}</h3>
                      </div>
                      <p className="mt-2 text-[13.5px] leading-[1.48] text-[color:var(--landing-muted)]">{row.copy}</p>
                      <code className="mt-3 block overflow-x-auto whitespace-nowrap font-mono text-[10.5px] text-[color:var(--landing-accent-deep)]">
                        {row.proof}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
