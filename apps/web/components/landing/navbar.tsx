"use client"

import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import CornerMarkers from "@components/CornerMarkers"
import { GitHubStars } from "@components/github-stars"

interface NavbarProps {
  stargazersCount?: number
}

export function Navbar({ stargazersCount = 0 }: NavbarProps) {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm border-b border-gray-200 dark:border-neutral-800"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="Markdown Video home"
          className="flex min-w-0 items-center gap-2 group relative rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
        >
          <Image
            src="/icon-192.png"
            alt=""
            width={32}
            height={32}
            priority
            className="size-8 shrink-0 rounded-sm"
          />
          <span className="hidden sm:inline font-serif font-semibold text-gray-900 dark:text-neutral-100">
            Markdown Video
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-3 sm:gap-6">
          <GitHubStars repo="Avik-creator/markdown_video" stargazersCount={stargazersCount} />

          <Link
            href="/editor"
            className={cn(
              "group flex items-center gap-1 relative rounded-sm transition-all duration-300 ease-out",
              "hover:-translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
            )}
          >
            <CornerMarkers />
            <span className="text-sm font-medium text-gray-700 dark:text-neutral-300 underline decoration-gray-400 dark:decoration-neutral-600 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-600 dark:group-hover:decoration-neutral-400">
              <span className="sm:hidden">Editor</span>
              <span className="hidden sm:inline">Open Editor</span>
            </span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
