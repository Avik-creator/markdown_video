import Link from "next/link"
import { createLucideIcon, Github } from "lucide-react"

const XIcon = createLucideIcon("X", [
  [
    "path",
    {
      d: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
      key: "x-logo-path",
      stroke: "none",
      fill: "currentColor",
    },
  ],
])

const footerLinkClasses =
  "rounded-sm text-gray-600 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-neutral-800 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span className="font-serif font-semibold text-gray-900 dark:text-neutral-100">Markdown Video</span>
        </div>

        <nav aria-label="Footer" className="flex items-center gap-6 text-sm text-gray-600 dark:text-neutral-500">
          <Link href="/editor" className={footerLinkClasses}>
            Editor
          </Link>
          <Link href="#features" className={footerLinkClasses}>
            Features
          </Link>
          <Link href="#syntax" className={footerLinkClasses}>
            Syntax
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/Avik-creator/markdown_video"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Markdown Video on GitHub"
            className={footerLinkClasses}
          >
            <Github aria-hidden="true" className="size-5" />
          </a>
          <a
            href="https://x.com/avikm744"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Avik Mukherjee on X"
            className={footerLinkClasses}
          >
            <XIcon aria-hidden="true" className="size-4.5" />
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-200 dark:border-neutral-800 text-center text-sm text-gray-600 dark:text-neutral-500">
        <p>Built with Next.js, Tailwind CSS, and Framer Motion</p>
      </div>
    </footer>
  )
}
