import Link from "next/link";

const resourceLinks = [
  ["repository", "https://github.com/Avik-creator/markdown_video"],
  ["action readme", "https://github.com/Avik-creator/markdown_video/tree/main/action"],
  ["issues", "https://github.com/Avik-creator/markdown_video/issues"],
] as const;

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-[color:var(--landing-line)]/75 px-5 pt-16 md:px-10">
      <div className="mx-auto max-w-[1520px]">
        <div className="grid gap-10 pb-20 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <Link href="/" className="inline-flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--landing-paper)]">
              <span className="grid size-7 place-items-center rounded-[7px] bg-[color:var(--landing-ink)] font-mono text-[11px] font-semibold text-[color:var(--landing-paper)]">
                md
              </span>
              <span className="text-[15px] font-medium tracking-[-0.025em]">markdown_video</span>
            </Link>
            <p className="mt-5 max-w-[360px] text-[14px] leading-[1.5] text-[color:var(--landing-muted)]">
              Plain markdown in. Deterministic video out. Built for editors, terminals, CI, and agents.
            </p>
          </div>

          <nav aria-label="Landing sections">
            <h2 className="font-mono text-[11px] text-[color:var(--landing-muted)]">index</h2>
            <ul className="mt-5 space-y-3 text-[14px] font-medium">
              <li><a className="hover:text-[color:var(--landing-accent-deep)]" href="#mcp">agents + MCP</a></li>
              <li><a className="hover:text-[color:var(--landing-accent-deep)]" href="#action">GitHub Action</a></li>
              <li><a className="hover:text-[color:var(--landing-accent-deep)]" href="#captions">music + captions</a></li>
              <li><a className="hover:text-[color:var(--landing-accent-deep)]" href="#i18n">localization</a></li>
            </ul>
          </nav>

          <nav aria-label="Project resources">
            <h2 className="font-mono text-[11px] text-[color:var(--landing-muted)]">resources</h2>
            <ul className="mt-5 space-y-3 text-[14px] font-medium">
              {resourceLinks.map(([label, href]) => (
                <li key={href}>
                  <a className="hover:text-[color:var(--landing-accent-deep)]" href={href} target="_blank" rel="noopener noreferrer">
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <Link className="hover:text-[color:var(--landing-accent-deep)]" href="/editor">
                  editor
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="flex flex-col justify-between gap-4 border-t border-[color:var(--landing-line)] py-5 font-mono text-[11px] text-[color:var(--landing-muted)] md:flex-row">
          <span>© {new Date().getFullYear()} markdown_video</span>
          <span>paper texture · registration marks · real rendered artifacts</span>
        </div>

        <div aria-hidden="true" className="landing-outline-word landing-display-tight pointer-events-none select-none text-center text-[clamp(5.5rem,17vw,19rem)] font-semibold leading-[0.68] tracking-[-0.09em]">
          markdown
        </div>
      </div>
    </footer>
  );
}
