"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import CornerMarkers from "@components/CornerMarkers"
import { GitHubStars } from "@components/github-stars"

interface NavbarProps {
  stargazersCount?: number
}

export function Navbar({ stargazersCount = 0 }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm border-b border-gray-200 dark:border-neutral-800">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group relative">
          <CornerMarkers variant="static" />
          <span className="font-serif font-semibold text-gray-900 dark:text-neutral-100">Markdown Video</span>
        </Link>

        <div className="flex items-center gap-6">
          <GitHubStars repo="Avik-creator/markdown_video" stargazersCount={stargazersCount} />

          <Link
            href="/editor"
            className={cn(
              "group flex items-center gap-1 relative transition-all duration-300 ease-out",
              "hover:translate-x-[-2px]"
            )}
          >
            <CornerMarkers />
            <span className="text-sm font-medium text-gray-700 dark:text-neutral-300 underline decoration-gray-400 dark:decoration-neutral-600 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-600 dark:group-hover:decoration-neutral-400">
              Open Editor
            </span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
