import Image from "next/image";
import { Reveal } from "./reveal";
import { actionDocsUrl, cliCaptionsDocsUrl, cliMusicDocsUrl, mcpDocsUrl } from "./provenance-data";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[12px] tracking-[-0.02em] text-[color:var(--landing-muted)]">
      <span aria-hidden="true" className="size-2 rounded-[2px] bg-[color:var(--landing-accent)]" />
      {children}
    </p>
  );
}

function CodeBlock({ children, label }: { children: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--landing-line)]/75 bg-[color:var(--landing-code-bg)]">
      <div className="border-b border-[color:var(--landing-line)]/60 px-3 py-2 font-mono text-[10px] text-[color:var(--landing-muted)]">
        {label}
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[11.5px] leading-[1.65] text-[color:var(--landing-ink)]">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function ArtifactCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-[11px] text-[color:var(--landing-muted)]">
      {children}
    </p>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-8 items-center text-[14px] font-medium text-[color:var(--landing-ink)] underline decoration-[color:var(--landing-line)] underline-offset-[3px] transition-colors hover:decoration-[color:var(--landing-accent)]"
    >
      {children}
    </a>
  );
}

export function Workflows() {
  return (
    <section
      id="workflows"
      className="relative scroll-mt-20 border-t border-[color:var(--landing-line)]/70 px-4 py-20 sm:px-5 md:px-10 md:py-28"
      aria-labelledby="workflows-heading"
    >
      <div className="mx-auto max-w-[1520px]">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <Reveal>
            <Eyebrow>four workflows · one document</Eyebrow>
            <h2
              id="workflows-heading"
              className="landing-display-tight mt-6 max-w-[860px] text-[clamp(2.65rem,5.6vw,5.9rem)] font-medium leading-[0.9] tracking-[-0.06em]"
            >
              write once,
              <br />
              <span className="text-[color:var(--landing-faint)]">render anywhere.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="max-w-[620px] text-[18px] leading-[1.48] tracking-[-0.015em] text-[color:var(--landing-muted)] lg:ml-auto">
              These are not four export formats bolted onto a timeline. They are four consumers of the same
              readable input: an agent, a CI runner, an audio/caption renderer, and a locale-specific CLI run.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="mt-12 overflow-hidden rounded-md border border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/55">
            <div className="grid gap-px bg-[color:var(--landing-line)]/65 md:grid-cols-5">
              <div className="bg-[color:var(--landing-paper)] p-5">
                <span className="font-mono text-[10.5px] text-[color:var(--landing-muted)]">input</span>
                <p className="mt-3 font-mono text-[12px] text-[color:var(--landing-ink)]">release.video.md</p>
              </div>
              {[
                ["agent", "MCP tools"],
                ["ci", "GitHub Action"],
                ["sound", "music + captions"],
                ["locale", "--locale es"],
              ].map(([label, detail], index) => (
                <div key={label} className="relative bg-[color:var(--landing-paper)] p-5">
                  <span aria-hidden="true" className="absolute -left-2 top-1/2 hidden -translate-y-1/2 text-[color:var(--landing-accent)] md:block">
                    →
                  </span>
                  <span className="font-mono text-[10.5px] text-[color:var(--landing-muted)]">0{index + 1} · {label}</span>
                  <p className="mt-3 text-[15px] font-medium tracking-[-0.02em]">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-8 xl:grid-cols-2">
          <Reveal>
            <article id="mcp" className="flex h-full scroll-mt-24 flex-col overflow-hidden rounded-md border border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/45">
              <div className="border-b border-[color:var(--landing-line)]/75 p-5 sm:p-6">
                <Eyebrow>01 · mcp for agents</Eyebrow>
                <h3 className="mt-4 text-[clamp(1.7rem,2.6vw,2.5rem)] font-medium leading-[1] tracking-[-0.045em]">
                  the agent that writes the document can render it too.
                </h3>
                <p className="mt-4 text-[15.5px] leading-[1.52] text-[color:var(--landing-muted)]">
                  Connect the hosted MCP server, then use authoring tools plus <code>render_preview</code> and{" "}
                  <code>render_video</code> against the same parser the editor uses.
                </p>
                <div className="mt-5">
                  <CodeBlock label="shell">
{`claude mcp add --transport http markdown-video https://markdownvideo.avikmukherjee.com/mcp`}
                  </CodeBlock>
                </div>
                <div className="mt-4">
                  <TextLink href={mcpDocsUrl}>MCP setup in the repository README</TextLink>
                </div>
              </div>
              <figure className="p-3 sm:p-4">
                <video
                  controls
                  muted
                  loop
                  playsInline
                  preload="none"
                  width={960}
                  height={720}
                  poster="/landing/mcp-agent-poster.webp"
                  aria-label="Rendered terminal animation of the Markdown Video MCP workflow"
                  className="block aspect-[4/3] w-full rounded-[6px] bg-[#fff4ec]"
                >
                  <source src="/landing/mcp-agent.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <ArtifactCaption>
                  <span>rendered from landing-agent-mcp.video.md</span>
                  <span>960×720 · terminal artifact</span>
                </ArtifactCaption>
              </figure>
            </article>
          </Reveal>

          <Reveal delay={0.06}>
            <article id="action" className="flex h-full scroll-mt-24 flex-col overflow-hidden rounded-md border border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/45">
              <div className="border-b border-[color:var(--landing-line)]/75 p-5 sm:p-6">
                <Eyebrow>02 · github action</Eyebrow>
                <h3 className="mt-4 text-[clamp(1.7rem,2.6vw,2.5rem)] font-medium leading-[1] tracking-[-0.045em]">
                  release videos can render in the release pipeline.
                </h3>
                <p className="mt-4 text-[15.5px] leading-[1.52] text-[color:var(--landing-muted)]">
                  The composite action builds the canonical CLI, renders the document, and can upload the MP4
                  to the GitHub release that triggered it.
                </p>
                <div className="mt-5">
                  <CodeBlock label="workflow yaml">
{`- uses: Avik-creator/markdown_video/action@main
  with:
    markdown-path: release.md
    output-name: release-demo.mp4
    upload-release-asset: "true"`}
                  </CodeBlock>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                  <TextLink href={actionDocsUrl}>Action inputs, outputs, and pinning guidance</TextLink>
                </div>
              </div>
              <figure className="p-3 sm:p-4">
                <Image
                  src="/landing/action-workflow.webp"
                  alt="Rendered frame showing a GitHub Actions workflow that renders and uploads a release video"
                  width={960}
                  height={720}
                  sizes="(min-width: 1280px) 42vw, (min-width: 768px) 80vw, 92vw"
                  className="aspect-[4/3] w-full rounded-[6px] object-cover"
                />
                <ArtifactCaption>
                  <span>direct preview capture from landing-action.video.md</span>
                  <span>pin a full sha for production use</span>
                </ArtifactCaption>
              </figure>
            </article>
          </Reveal>

          <Reveal>
            <article id="captions" className="flex h-full scroll-mt-24 flex-col overflow-hidden rounded-md border border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/45">
              <div className="border-b border-[color:var(--landing-line)]/75 p-5 sm:p-6">
                <Eyebrow>03 · music + captions</Eyebrow>
                <h3 className="mt-4 text-[clamp(1.7rem,2.6vw,2.5rem)] font-medium leading-[1] tracking-[-0.045em]">
                  sound belongs to the document. captions leave as artifacts.
                </h3>
                <p className="mt-4 text-[15.5px] leading-[1.52] text-[color:var(--landing-muted)]">
                  Declare document-level audio once. Text scenes generate SRT and VTT sidecars on the same
                  timeline, and burn-in is composited in the renderer when a player needs pixels instead of a
                  sidecar.
                </p>
                <div className="mt-5 space-y-2">
                  <CodeBlock label="document directive">
{`!music ./assets/landing-theme.mp3 volume:0.32 fade:0.7s loop:true`}
                  </CodeBlock>
                  <CodeBlock label="optional burn-in">
{`markdown-video render video.md -o captioned.mp4 --burn-captions`}
                  </CodeBlock>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                  <TextLink href={cliMusicDocsUrl}>music directive documentation</TextLink>
                  <TextLink href={cliCaptionsDocsUrl}>caption sidecar documentation</TextLink>
                  <a
                    href="/landing/captions-demo.vtt"
                    className="inline-flex min-h-8 items-center text-[14px] font-medium text-[color:var(--landing-ink)] underline decoration-[color:var(--landing-line)] underline-offset-[3px] hover:decoration-[color:var(--landing-accent)]"
                  >
                    open the generated VTT
                  </a>
                </div>
              </div>
              <figure className="p-3 sm:p-4">
                <video
                  controls
                  playsInline
                  preload="none"
                  width={960}
                  height={720}
                  poster="/landing/captions-burned-frame.webp"
                  aria-label="Music and captions demo rendered by Markdown Video"
                  className="block aspect-[4/3] w-full rounded-[6px] bg-[#fff4ec]"
                >
                  <source src="/landing/captions-demo.mp4" type="video/mp4" />
                  <track kind="captions" src="/landing/captions-demo.vtt" srcLang="en" label="English" default />
                  Your browser does not support the video tag.
                </video>
                <ArtifactCaption>
                  <span>real AAC audio + generated sidecars</span>
                  <span>poster extracted from burn-in render</span>
                </ArtifactCaption>
              </figure>
            </article>
          </Reveal>

          <Reveal delay={0.06}>
            <article id="i18n" className="flex h-full scroll-mt-24 flex-col overflow-hidden rounded-md border border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/45">
              <div className="border-b border-[color:var(--landing-line)]/75 p-5 sm:p-6">
                <Eyebrow>04 · multi-locale renders</Eyebrow>
                <h3 className="mt-4 text-[clamp(1.7rem,2.6vw,2.5rem)] font-medium leading-[1] tracking-[-0.045em]">
                  translate strings once. render the market you need.
                </h3>
                <p className="mt-4 text-[15.5px] leading-[1.52] text-[color:var(--landing-muted)]">
                  Declare locales and strings in the document, reference them as <code>i18n:keys</code>, then
                  select the output language with the CLI&apos;s locale flag.
                </p>
                <div className="mt-5 space-y-2">
                  <CodeBlock label="document fragment">
{`!locales en es
!strings
headline:
  en: "One source, every locale."
  es: "Una fuente, cada idioma."`}
                  </CodeBlock>
                  <CodeBlock label="render command">
{`markdown-video render examples/landing-i18n.video.md --locale es -o launch-es.mp4`}
                  </CodeBlock>
                </div>
              </div>
              <figure className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
                <div>
                  <Image
                    src="/landing/i18n-en.webp"
                    alt="English preview frame rendered from the localized markdown source"
                    width={960}
                    height={720}
                    sizes="(min-width: 1280px) 21vw, (min-width: 640px) 40vw, 88vw"
                    className="aspect-[4/3] w-full rounded-[6px] object-cover"
                  />
                  <ArtifactCaption>
                    <span>--locale en</span>
                  </ArtifactCaption>
                </div>
                <div>
                  <Image
                    src="/landing/i18n-es.webp"
                    alt="Spanish preview frame rendered from the same localized markdown source"
                    width={960}
                    height={720}
                    sizes="(min-width: 1280px) 21vw, (min-width: 640px) 40vw, 88vw"
                    className="aspect-[4/3] w-full rounded-[6px] object-cover"
                  />
                  <ArtifactCaption>
                    <span>--locale es</span>
                  </ArtifactCaption>
                </div>
              </figure>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
