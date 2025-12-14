"use client"

import { Code, Terminal, BarChart3, Smartphone, Sparkles, Video, Wand2, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import CornerMarkers from "@components/CornerMarkers"

const features = [
  {
    icon: Code,
    title: "Code Highlighting",
    description: "Syntax-highlighted code blocks with line-by-line reveals and annotations.",
  },
  {
    icon: Terminal,
    title: "Terminal Scenes",
    description: "Animated terminal with typing effects, perfect for CLI demonstrations.",
  },
  {
    icon: BarChart3,
    title: "Animated Charts",
    description: "Bar, pie, and donut charts with smooth animations for data presentations.",
  },
  {
    icon: Smartphone,
    title: "Device Mockups",
    description: "Wrap content in iPhone, MacBook, or browser frames instantly.",
  },
  {
    icon: Sparkles,
    title: "Particle Effects",
    description: "Add confetti, snow, or sparkles for engaging transitions.",
  },
  {
    icon: Wand2,
    title: "Camera Effects",
    description: "Zoom, pan, and shake effects to add cinematic flair.",
  },
  {
    icon: Video,
    title: "One-Click Export",
    description: "Export to WebM or MP4 directly from your browser.",
  },
  {
    icon: Zap,
    title: "Live Preview",
    description: "See changes instantly as you type with real-time preview.",
  },
]

export function Features() {
  return (
    <section className="py-24 px-6 border-t border-gray-200 dark:border-neutral-800">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-16 animate-[slideFadeUp_0.4s_ease-out]">
          <h2 className="text-2xl font-serif font-semibold text-gray-900 dark:text-neutral-100 mb-4">
            Features
          </h2>
          <p className="mt-2 text-gray-600 dark:text-neutral-400 leading-relaxed">
            Powerful features to create professional videos without complex software.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={cn(
                "group flex items-start justify-between gap-4 w-full relative",
                "hover:outline-[0.5px] outline-offset-[6px] hover:outline-gray-400/50 dark:hover:outline-neutral-600/50 border-0",
                "animate-[slideFadeUp_0.25s_ease-out]"
              )}
              style={{ animationDelay: `${0.1 + index * 0.05}s`, animationFillMode: "both" }}
            >
              <CornerMarkers />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <feature.icon className="w-5 h-5 text-gray-600 dark:text-neutral-500" />
                  <h3 className="font-medium text-gray-800 dark:text-neutral-200 underline decoration-gray-400 dark:decoration-neutral-600/50 underline-offset-[3px] transition-colors">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
