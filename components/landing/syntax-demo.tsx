"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@components/ui/button"

const exampleCode = `!scene
!text
Hello World
animation: bounceIn
size: 2xl

!duration 3s
!background #3b82f6
!transition fade

---

!scene
!terminal
$ npm create markdown-video
$ cd my-project
$ npm run dev
> Ready on localhost:3000

!duration 5s
!background #0d0d0d

---

!scene
!chart type:bar animate:true
React: 95
Vue: 82
Svelte: 78

!duration 4s
!background #1a1a24`

export function SyntaxDemo() {
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable")
      }

      await navigator.clipboard.writeText(exampleCode)
      setCopied(true)

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy the example. Please copy it manually.")
    }
  }

  return (
    <section
      id="syntax"
      aria-labelledby="syntax-heading"
      className="py-24 px-6 border-t border-gray-200 dark:border-neutral-800 scroll-mt-14"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Description */}
          <div className="min-w-0 animate-[slideFadeUp_0.4s_ease-out]">
            <h2
              id="syntax-heading"
              className="text-2xl font-serif font-semibold text-gray-900 dark:text-neutral-100 mb-4"
            >
              Simple syntax
            </h2>
            <p className="mt-2 mb-8 text-gray-600 dark:text-neutral-400 leading-relaxed">
              No timeline. No keyframes. Just write what you want to show using our intuitive markdown syntax. Each
              scene is a few lines of text.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-800 dark:text-neutral-200 mb-1">Define scenes with !scene</h3>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Each scene is separated by --- dividers</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 dark:text-neutral-200 mb-1">Add content and effects</h3>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Text, code, charts, terminal - all with simple directives</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 dark:text-neutral-200 mb-1">Export your video</h3>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Render an MP4 video or animated GIF in your browser</p>
              </div>
            </div>
          </div>

          {/* Right - Code example */}
          <div className="min-w-0 animate-[slideFadeUp_0.5s_ease-out]">
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
                <span className="truncate text-sm text-gray-600 dark:text-neutral-500">example.mdv</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  aria-label={copied ? "Example copied" : "Copy example markdown"}
                  className="h-8 shrink-0 gap-2 text-gray-600 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-neutral-100"
                >
                  {copied ? (
                    <>
                      <Check aria-hidden="true" className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              {/* Code */}
              <div className="p-4 font-mono text-sm max-h-100 overflow-auto bg-white dark:bg-neutral-950">
                <pre className="whitespace-pre-wrap break-words">
                  {exampleCode.split("\n").map((line, i) => (
                    <span key={i} className="flex min-w-0">
                      <span aria-hidden="true" className="w-8 shrink-0 text-gray-400 dark:text-neutral-700 select-none">{i + 1}</span>
                      <span className="min-w-0">
                        {line.startsWith("!") && <span className="text-pink-500">{line.split(" ")[0]}</span>}
                        {line.startsWith("!") && line.includes(" ") && (
                          <span className="text-cyan-400"> {line.split(" ").slice(1).join(" ")}</span>
                        )}
                        {line.startsWith("$") && <span className="text-emerald-400">{line}</span>}
                        {line.startsWith(">") && <span className="text-gray-500 dark:text-neutral-500">{line}</span>}
                        {line.includes(":") &&
                          !line.startsWith("!") &&
                          !line.startsWith("$") &&
                          !line.startsWith(">") && (
                            <>
                              <span className="text-violet-400">{line.split(":")[0]}:</span>
                              <span className="text-cyan-400">{line.split(":").slice(1).join(":")}</span>
                            </>
                          )}
                        {line === "---" && <span className="text-gray-400 dark:text-neutral-600">{line}</span>}
                        {!line.startsWith("!") &&
                          !line.startsWith("$") &&
                          !line.startsWith(">") &&
                          !line.includes(":") &&
                          line !== "---" && <span className="text-gray-900 dark:text-white">{line}</span>}
                      </span>
                    </span>
                  ))}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? "Example copied to clipboard" : ""}
      </span>
    </section>
  )
}
