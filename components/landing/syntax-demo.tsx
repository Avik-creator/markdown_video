"use client"

import { Copy, Check } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

  const handleCopy = () => {
    navigator.clipboard.writeText(exampleCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="syntax" className="py-24 px-6 border-t border-gray-200 dark:border-neutral-800">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Description */}
          <div className="animate-[slideFadeUp_0.4s_ease-out]">
            <h2 className="text-2xl font-serif font-semibold text-gray-900 dark:text-neutral-100 mb-4">
              Simple syntax
            </h2>
            <p className="mt-2 mb-8 text-gray-600 dark:text-neutral-400 leading-relaxed">
              No timeline. No keyframes. Just write what you want to show using our intuitive markdown syntax. Each
              scene is a few lines of text.
            </p>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-800 dark:text-neutral-200 mb-1">Define scenes with !scene</h4>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Each scene is separated by --- dividers</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 dark:text-neutral-200 mb-1">Add content and effects</h4>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Text, code, charts, terminal - all with simple directives</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 dark:text-neutral-200 mb-1">Export and share</h4>
                <p className="text-sm text-gray-600 dark:text-neutral-400">One click to export as WebM or MP4 video</p>
              </div>
            </div>
          </div>

          {/* Right - Code example */}
          <div className="animate-[slideFadeUp_0.5s_ease-out]">
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
                <span className="text-sm text-gray-600 dark:text-neutral-500">example.mdv</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 gap-2 text-gray-600 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-neutral-100"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              {/* Code */}
              <div className="p-4 font-mono text-sm max-h-[400px] overflow-auto bg-white dark:bg-neutral-950">
                <pre className="whitespace-pre-wrap">
                  {exampleCode.split("\n").map((line, i) => (
                    <div key={i} className="flex">
                      <span className="w-8 text-gray-400 dark:text-neutral-700 select-none">{i + 1}</span>
                      <span>
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
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
