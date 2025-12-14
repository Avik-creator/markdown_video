"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play } from "lucide-react"
import Link from "next/link"

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <div className="absolute top-0 left-0 right-0 h-px bg-zinc-800" />

      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 mb-8"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-sm text-zinc-400">Now in public beta</span>
      </motion.div>

      {/* Main heading */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-5xl md:text-7xl font-bold text-center max-w-4xl leading-tight text-white"
      >
        Create videos with <span className="text-pink-500">Markdown</span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 text-lg md:text-xl text-zinc-400 text-center max-w-2xl"
      >
        Transform simple markdown syntax into stunning animated videos. Perfect for tutorials, demos, and presentations.
      </motion.p>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col sm:flex-row items-center gap-4 mt-10"
      >
        <Button asChild size="lg" className="gap-2 bg-white text-black hover:bg-zinc-200 px-8">
          <Link href="/editor">
            Start Creating
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="gap-2 border-zinc-700 hover:bg-zinc-900 bg-transparent text-zinc-300"
        >
          <Play className="w-4 h-4" />
          Watch Demo
        </Button>
      </motion.div>

      {/* Demo Preview */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="mt-20 w-full max-w-5xl"
      >
        <div className="relative rounded-xl overflow-hidden border border-zinc-800">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-1 rounded-md bg-zinc-800 text-xs text-zinc-500">markdown.video/editor</div>
            </div>
          </div>

          {/* Editor preview */}
          <div className="aspect-[16/9] bg-zinc-950 flex">
            {/* Left - Code */}
            <div className="w-1/3 p-4 border-r border-zinc-800 font-mono text-sm">
              <div className="space-y-1">
                <p>
                  <span className="text-pink-500">!scene</span>
                </p>
                <p>
                  <span className="text-pink-500">!text</span>
                </p>
                <p className="text-white">Welcome to Markdown Video</p>
                <p>
                  <span className="text-violet-400">animation:</span> <span className="text-cyan-400">bounceIn</span>
                </p>
                <p>
                  <span className="text-violet-400">size:</span> <span className="text-cyan-400">2xl</span>
                </p>
                <p className="text-zinc-600 mt-4">---</p>
                <p className="mt-2">
                  <span className="text-pink-500">!scene</span>
                </p>
                <p>
                  <span className="text-pink-500">!terminal</span>
                </p>
                <p className="text-emerald-400">$ npm create video</p>
                <p className="text-zinc-500">{"> Ready!"}</p>
              </div>
            </div>

            {/* Center - Preview */}
            <div className="flex-1 flex items-center justify-center bg-blue-600">
              <motion.p
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="text-3xl font-bold text-white text-center"
              >
                Welcome to
                <br />
                Markdown Video
              </motion.p>
            </div>

            {/* Right - Properties */}
            <div className="w-1/4 p-4 border-l border-zinc-800 text-sm">
              <p className="text-zinc-500 text-xs mb-3">Scene Properties</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-zinc-600">Type</p>
                  <p className="text-white">Text</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-600">Duration</p>
                  <p className="text-white">3s</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-600">Animation</p>
                  <p className="text-white">bounceIn</p>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="h-16 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 gap-2">
            <div className="flex-1 flex gap-1">
              <div className="h-8 flex-1 rounded bg-blue-600 flex items-center justify-center text-xs text-white">
                3s
              </div>
              <div className="h-8 flex-1 rounded bg-violet-600 flex items-center justify-center text-xs text-white">
                3s
              </div>
              <div className="h-8 flex-1 rounded bg-pink-600 flex items-center justify-center text-xs text-white">
                4s
              </div>
              <div className="h-8 flex-1 rounded bg-emerald-600 flex items-center justify-center text-xs text-white">
                5s
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
