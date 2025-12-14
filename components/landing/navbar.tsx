"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Github } from "lucide-react"

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-pink-500 flex items-center justify-center">
            <span className="text-xs font-bold text-white">M</span>
          </div>
          <span className="font-semibold text-white">Markdown Video</span>
        </Link>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
          <Button asChild size="sm" className="bg-white text-black hover:bg-zinc-200">
            <Link href="/editor">Open Editor</Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}
