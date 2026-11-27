import Image from "next/image";
import { LoopingVideo } from "./looping-video";
import { Reveal } from "./reveal";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[12px] tracking-[-0.02em] text-[color:var(--landing-muted)]">
      <span aria-hidden="true" className="size-2 rounded-[2px] bg-[color:var(--landing-accent)]" />
      {children}
    </p>
  );
}

function CodeLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[color:var(--landing-line)]/70 bg-[color:var(--landing-code-bg)] px-4 py-3 font-mono text-[11.5px] leading-relaxed text-[color:var(--landing-ink)] shadow-[inset_0_1px_0_var(--landing-inset-highlight)]">
      <code className="whitespace-nowrap">{children}</code>
    </div>
  );
}

function ArtifactCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-center justify-between gap-4 px-1 font-mono text-[11px] text-[color:var(--landing-muted)]">
      {children}
    </p>
  );
}

export function Features() {
  return (
    <section className="relative border-t border-[color:var(--landing-line)]/70 px-5 py-24 md:px-10 md:py-32" aria-labelledby="capabilities-heading">
      <div className="mx-auto max-w-[1520px]">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <Reveal>
            <Eyebrow>built for the way video gets made now</Eyebrow>
            <h2 id="capabilities-heading" className="landing-display-tight mt-6 max-w-[820px] text-[clamp(2.9rem,5.8vw,5.8rem)] font-medium leading-[0.88] tracking-[-0.06em]">
              one document.
              <br />
              <span className="text-[color:var(--landing-faint)]">four ways out.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-[600px] text-[19px] leading-[1.45] tracking-[-0.018em] text-[color:var(--landing-muted)] md:ml-auto">
              The important paths are first-class: an agent can call MCP, CI can run the action, sound and
              captions belong to the document, and every locale renders from the same source.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.14}>
          <div className="mt-16 grid overflow-hidden rounded-md border border-[color:var(--landing-line)] bg-[color:var(--landing-card)]/62 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["01", "MCP for agents", "render previews and final videos through 12 HTTP tools"],
              ["02", "GitHub Action", "render release videos in CI and upload release assets"],
              ["03", "music + captions", "document-level audio, SRT/VTT sidecars, optional burn-in"],
              ["04", "multi-locale", "translate strings once; render any locale with --locale"],
            ].map(([number, title, copy], index) => (
              <div
                key={title}
                className={`min-h-[172px] border-[color:var(--landing-line)]/75 p-6 ${
                  [
                    "",
                    "border-t md:border-t-0 md:border-l",
                    "border-t xl:border-t-0 xl:border-l",
                    "border-t md:border-l xl:border-t-0 xl:border-l",
                  ][index]
                }`}
              >
                <span className="font-mono text-[11px] text-[color:var(--landing-muted)]">{number}</span>
                <h3 className="mt-8 text-[21px] font-medium tracking-[-0.035em]">{title}</h3>
                <p className="mt-2 text-[14px] leading-[1.45] text-[color:var(--landing-muted)]">{copy}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <div className="mt-24 grid gap-x-10 gap-y-24 lg:grid-cols-12 lg:gap-y-28">
          <Reveal className="lg:col-span-7">
            <article id="mcp" className="scroll-mt-28">
              <div className="max-w-[620px]">
                <Eyebrow>agents first</Eyebrow>
                <h3 className="mt-5 text-[clamp(2.35rem,4vw,4.35rem)] font-medium leading-[0.94] tracking-[-0.055em]">
                  your agent can render the video it just wrote.
                </h3>
                <p className="mt-5 text-[17px] leading-[1.5] text-[color:var(--landing-muted)]">
                  Connect the hosted MCP server, then let Claude or another MCP client create documents, preview
                  frames, and render final MP4s with tools like <code>render_preview</code> and <code>render_video</code>.
                </p>
                <div className="mt-6">
                  <CodeLine>
                    claude mcp add --transport http markdown-video https://markdownvideo.avikmukherjee.com/mcp
                  </CodeLine>
                </div>
              </div>

              <div className="mt-9">
                <div className="landing-card overflow-hidden rounded-md p-2 sm:p-3">
                  <div className="overflow-hidden rounded-[13px]">
                    <LoopingVideo
                      src="/landing/mcp-agent.mp4"
                      poster="/landing/mcp-agent-poster.webp"
                      label="Terminal animation showing an MCP client connecting and rendering video"
                      className="block aspect-[4/3] w-full scale-[1.6] object-cover"
                    />
                  </div>
                </div>
                <ArtifactCaption>
                  <span>rendered artifact · MCP terminal flow</span>
                  <span>26 kb mp4</span>
                </ArtifactCaption>
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.08} className="lg:col-span-5 lg:pt-24">
            <article id="action" className="scroll-mt-28">
              <div>
                <Eyebrow>ci without choreography</Eyebrow>
                <h3 className="mt-5 text-[clamp(2.2rem,3.4vw,3.8rem)] font-medium leading-[0.96] tracking-[-0.052em]">
                  release videos can render themselves.
                </h3>
                <p className="mt-5 text-[17px] leading-[1.5] text-[color:var(--landing-muted)]">
                  The composite GitHub Action prepares the workspace, invokes the CLI, and can upload the rendered
                  MP4 back to the GitHub release that triggered it.
                </p>
                <div className="mt-6 space-y-2">
                  <CodeLine>uses: Avik-creator/markdown_video/action@&lt;sha&gt;</CodeLine>
                  <CodeLine>upload-release-asset: &quot;true&quot;</CodeLine>
                </div>
              </div>

              <div className="mt-9 lg:-mr-8">
                <Image
                  src="/landing/action-workflow.webp"
                  alt="Rendered GitHub Actions workflow for markdown_video release rendering"
                  width={960}
                  height={720}
                  className="landing-card aspect-[4/3] w-full rounded-md object-cover"
                />
                <ArtifactCaption>
                  <span>workflow artifact</span>
                  <span>release → mp4 asset</span>
                </ArtifactCaption>
              </div>
            </article>
          </Reveal>

          <Reveal className="lg:col-span-5 lg:pt-10">
            <article id="captions" className="scroll-mt-28">
              <div>
                <Eyebrow>sound and words stay together</Eyebrow>
                <h3 className="mt-5 text-[clamp(2.2rem,3.4vw,3.8rem)] font-medium leading-[0.96] tracking-[-0.052em]">
                  music is a directive. captions are artifacts.
                </h3>
                <p className="mt-5 text-[17px] leading-[1.5] text-[color:var(--landing-muted)]">
                  Add document-level audio with volume, fade, and loop controls. Text scenes generate SRT and VTT
                  sidecars, with optional burn-in for players that need captions baked into the pixels — composited
                  into the frames at render time, so any ffmpeg build works and every script your fonts
                  cover renders correctly.
                </p>
                <div className="mt-6">
                  <CodeLine>!music ./assets/theme.mp3 volume:0.32 fade:0.7s loop:true</CodeLine>
                </div>
              </div>

              <div className="mt-9">
                <div className="landing-card overflow-hidden rounded-md p-2 sm:p-3">
                  <video
                    controls
                    width={960}
                    height={720}
                    preload="none"
                    poster="/landing/captions-burned-frame.webp"
                    aria-label="music and captions demo rendered by markdown_video"
                    className="block aspect-[4/3] w-full rounded-[13px] bg-[#f4f0e6] object-cover"
                  >
                    <source src="/landing/captions-demo.mp4" type="video/mp4" />
                    <track kind="captions" src="/landing/captions-demo.vtt" srcLang="en" label="English" default />
                    Your browser does not support the video tag.
                  </video>
                </div>
                <ArtifactCaption>
                  <span>playable demo · real AAC audio + generated VTT</span>
                  <span>poster: real burn-in frame</span>
                </ArtifactCaption>
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.08} className="lg:col-span-7">
            <article id="i18n" className="scroll-mt-28">
              <div className="max-w-[640px] lg:ml-auto">
                <Eyebrow>one source, every locale</Eyebrow>
                <h3 className="mt-5 text-[clamp(2.35rem,4vw,4.35rem)] font-medium leading-[0.94] tracking-[-0.055em]">
                  translate strings once. render the market you need.
                </h3>
                <p className="mt-5 text-[17px] leading-[1.5] text-[color:var(--landing-muted)]">
                  Declare locales, attach translations with <code>!strings</code>, reference them with{" "}
                  <code>!text i18n:key</code>, and render a specific language using the CLI&apos;s <code>--locale</code>{" "}
                  flag.
                </p>
                <div className="mt-6">
                  <CodeLine>markdown-video render video.md --locale es -o launch-es.mp4</CodeLine>
                </div>
              </div>

              <div className="relative mt-9 grid gap-4 sm:grid-cols-2 lg:pl-10">
                <figure className="landing-card overflow-hidden rounded-md p-2">
                  <Image
                    src="/landing/i18n-en.webp"
                    alt="English frame rendered from the localized markdown source"
                    width={960}
                    height={720}
                    className="aspect-[4/3] w-full rounded-md object-cover"
                  />
                  <figcaption className="px-2 pb-1 pt-3 font-mono text-[11px] text-[color:var(--landing-muted)]">
                    --locale en
                  </figcaption>
                </figure>
                <figure className="landing-card overflow-hidden rounded-md p-2 sm:translate-y-8">
                  <Image
                    src="/landing/i18n-es.webp"
                    alt="Spanish frame rendered from the same localized markdown source"
                    width={960}
                    height={720}
                    className="aspect-[4/3] w-full rounded-md object-cover"
                  />
                  <figcaption className="px-2 pb-1 pt-3 font-mono text-[11px] text-[color:var(--landing-muted)]">
                    --locale es
                  </figcaption>
                </figure>
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
