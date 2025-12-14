"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import CornerMarkers from "@/components/CornerMarkers"

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <div className="absolute top-0 left-0 right-0 h-px bg-gray-200 dark:bg-neutral-800" />

      {/* Main heading */}
      <h1
        className="text-4xl md:text-6xl font-serif font-semibold text-center max-w-3xl leading-tight text-gray-900 dark:text-neutral-100 mb-6 animate-[slideFadeUp_0.4s_ease-out]"
      >
        Create videos with <span className="underline decoration-gray-400 dark:decoration-neutral-600 underline-offset-4">Markdown</span>
      </h1>

      {/* Subtitle */}
      <p className="mt-4 text-lg md:text-xl text-gray-600 dark:text-neutral-400 text-center max-w-2xl leading-relaxed animate-[slideFadeUp_0.5s_ease-out]">
        Transform simple markdown syntax into stunning animated videos. Perfect for tutorials, demos, and presentations.
      </p>

      {/* CTA Link */}
      <div className="mt-10 animate-[slideFadeUp_0.6s_ease-out]">
        <Link
          href="/editor"
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-[-2px]"
          )}
        >
          <CornerMarkers />
          <h2 className="grow text-lg font-serif font-semibold text-gray-900 dark:text-neutral-100 underline decoration-gray-500 dark:decoration-neutral-400/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            Start Creating
          </h2>
        </Link>
      </div>
    </section>
  )
}
