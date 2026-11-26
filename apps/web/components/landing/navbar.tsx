import Link from "next/link";
import { GitHubStars } from "@/components/github-stars";

export function Navbar({ stargazersCount = 0 }: { stargazersCount?: number }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--landing-line)]/60 bg-[color:var(--landing-paper)]/86 backdrop-blur-xl">
      <nav
        className="mx-auto flex h-16 max-w-[1520px] items-center justify-between px-5 md:px-10"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="group flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--landing-paper)]"
        >
          <span className="grid size-7 place-items-center rounded-[7px] bg-[color:var(--landing-ink)] font-mono text-[11px] font-semibold lowercase tracking-[-0.08em] text-[color:var(--landing-paper)] transition-transform duration-300 group-hover:-rotate-3">
            md
          </span>
          <span className="text-[15px] font-medium tracking-[-0.025em]">markdown_video</span>
        </Link>

        <div className="hidden items-center gap-7 text-[13px] font-medium text-[color:var(--landing-muted)] lg:flex">
          <a className="transition-colors hover:text-[color:var(--landing-ink)]" href="#mcp">
            agents
          </a>
          <a className="transition-colors hover:text-[color:var(--landing-ink)]" href="#action">
            ci
          </a>
          <a className="transition-colors hover:text-[color:var(--landing-ink)]" href="#captions">
            sound + captions
          </a>
          <a className="transition-colors hover:text-[color:var(--landing-ink)]" href="#i18n">
            i18n
          </a>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden translate-y-0.5 sm:block [&_a]:text-[color:var(--landing-muted)] [&_a:hover]:text-[color:var(--landing-ink)]">
            <GitHubStars repo="Avik-creator/markdown_video" stargazersCount={stargazersCount} />
          </div>
          <Link
            href="/editor"
            className="inline-flex h-10 items-center rounded-full bg-[color:var(--landing-ink)] px-4 text-[13px] font-medium text-[color:var(--landing-paper)] shadow-[0_8px_18px_rgba(23,21,18,0.14)] transition-colors hover:bg-[color:var(--landing-accent-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--landing-paper)]"
          >
            open editor
          </Link>
        </div>
      </nav>
    </header>
  );
}
