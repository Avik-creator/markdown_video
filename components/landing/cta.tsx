"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import CornerMarkers from "@/components/CornerMarkers"

export function CTA() {
  return (
    <section className="py-24 px-6 border-t border-gray-200 dark:border-neutral-800">
      <div className="max-w-4xl mx-auto text-center animate-[slideFadeUp_0.4s_ease-out]">
        <h2 className="text-2xl font-serif font-semibold text-gray-900 dark:text-neutral-100 mb-4">
          Ready to create?
        </h2>
        <p className="mt-2 mb-10 text-gray-600 dark:text-neutral-400 leading-relaxed max-w-xl mx-auto">
            Start building stunning videos with just markdown. No account required, free to use.
          </p>
        <Link
          href="/editor"
          className={cn(
            "group inline-flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-[-2px]"
          )}
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-gray-900 dark:text-neutral-100 underline decoration-gray-500 dark:decoration-neutral-400/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
              Open Editor
          </span>
            </Link>
        </div>
    </section>
  )
}
