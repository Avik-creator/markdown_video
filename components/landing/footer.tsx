import Link from "next/link"
import { Github, Twitter } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-pink-500 flex items-center justify-center">
            <span className="text-xs font-bold text-white">M</span>
          </div>
          <span className="font-semibold text-white">Markdown Video</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-zinc-500">
          <Link href="/editor" className="hover:text-white transition-colors">
            Editor
          </Link>
          <Link href="#features" className="hover:text-white transition-colors">
            Features
          </Link>
          <Link href="#syntax" className="hover:text-white transition-colors">
            Docs
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <Twitter className="w-5 h-5" />
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-zinc-800 text-center text-sm text-zinc-600">
        <p>Built with Next.js, Tailwind CSS, and Framer Motion</p>
      </div>
    </footer>
  )
}
