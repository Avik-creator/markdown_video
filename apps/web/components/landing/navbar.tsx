import Link from "next/link";
import { GitHubStars } from "@/components/github-stars";
import { LandingThemeToggle } from "./theme-toggle";

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

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden translate-y-0.5 sm:block">
            <GitHubStars repo="Avik-creator/markdown_video" stargazersCount={stargazersCount} variant="landing" />
          </div>
          <LandingThemeToggle />
          <Link
            href="/editor"
            className="tool-button tool-button-primary h-8 px-3 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--landing-paper)]"
          >
            open editor
          </Link>
        </div>
      </nav>
    </header>
  );
}
