"use client"

import { motion } from "framer-motion"
import { Code, Terminal, BarChart3, Smartphone, Sparkles, Video, Wand2, Zap } from "lucide-react"

const features = [
  {
    icon: Code,
    title: "Code Highlighting",
    description: "Syntax-highlighted code blocks with line-by-line reveals and annotations.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Terminal,
    title: "Terminal Scenes",
    description: "Animated terminal with typing effects, perfect for CLI demonstrations.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: BarChart3,
    title: "Animated Charts",
    description: "Bar, pie, and donut charts with smooth animations for data presentations.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    icon: Smartphone,
    title: "Device Mockups",
    description: "Wrap content in iPhone, MacBook, or browser frames instantly.",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    icon: Sparkles,
    title: "Particle Effects",
    description: "Add confetti, snow, or sparkles for engaging transitions.",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
  {
    icon: Wand2,
    title: "Camera Effects",
    description: "Zoom, pan, and shake effects to add cinematic flair.",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    icon: Video,
    title: "One-Click Export",
    description: "Export to WebM or MP4 directly from your browser.",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  {
    icon: Zap,
    title: "Live Preview",
    description: "See changes instantly as you type with real-time preview.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
]

export function Features() {
  return (
    <section className="py-24 px-6 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-sm text-pink-500 font-medium mb-4"
          >
            FEATURES
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-white"
          >
            Everything you need
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto"
          >
            Powerful features to create professional videos without complex software.
          </motion.p>
        </div>

        {/* Features grid - removed gradient icons, using solid colors */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group p-5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <div className={`w-10 h-10 rounded-lg ${feature.bg} flex items-center justify-center mb-4`}>
                <feature.icon className={`w-5 h-5 ${feature.color}`} />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-500">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
