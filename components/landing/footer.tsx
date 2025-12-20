import Link from "next/link"
import { createLucideIcon, Github, X } from "lucide-react"

const XIcon = createLucideIcon("X", [
  [
    "path",
    {
      d: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
      stroke: "none",
      fill: "currentColor",
    },
  ],
]);

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-neutral-800 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span className="font-serif font-semibold text-gray-900 dark:text-neutral-100">Markdown Video</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-neutral-500">
          <Link href="/editor" className="hover:text-gray-900 dark:hover:text-neutral-100 transition-colors">
            Editor
          </Link>
          <Link href="#features" className="hover:text-gray-900 dark:hover:text-neutral-100 transition-colors">
            Features
          </Link>
          <Link href="#syntax" className="hover:text-gray-900 dark:hover:text-neutral-100 transition-colors">
            Docs
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/Avik-creator/markdown_video"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
          >
            <Github className="size-5" />
          </a>
          <a
            href="https://x.com/avikm744"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
          >
            <XIcon className="size-4.5" />
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-200 dark:border-neutral-800 text-center text-sm text-gray-600 dark:text-neutral-500">
        <p>Built with Next.js, Tailwind CSS, and Framer Motion</p>
      </div>
    </footer>
  )
}
