"use client"

import { motion } from "framer-motion"
import { Copy, Check } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

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
    <section className="py-24 px-6 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Description */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <p className="text-sm text-pink-500 font-medium mb-4">SIMPLE SYNTAX</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Write markdown,
              <br />
              get videos
            </h2>
            <p className="text-lg text-zinc-400 mb-8">
              No timeline. No keyframes. Just write what you want to show using our intuitive markdown syntax. Each
              scene is a few lines of text.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                  <span className="text-pink-500 font-bold text-sm">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Define scenes with !scene</h4>
                  <p className="text-sm text-zinc-500">Each scene is separated by --- dividers</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <span className="text-violet-500 font-bold text-sm">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Add content and effects</h4>
                  <p className="text-sm text-zinc-500">Text, code, charts, terminal - all with simple directives</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <span className="text-blue-500 font-bold text-sm">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Export and share</h4>
                  <p className="text-sm text-zinc-500">One click to export as WebM or MP4 video</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right - Code example */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <span className="text-sm text-zinc-500">example.mdv</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 gap-2 text-zinc-500 hover:text-white"
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
              <div className="p-4 font-mono text-sm max-h-[400px] overflow-auto bg-zinc-950">
                <pre className="whitespace-pre-wrap">
                  {exampleCode.split("\n").map((line, i) => (
                    <div key={i} className="flex">
                      <span className="w-8 text-zinc-700 select-none">{i + 1}</span>
                      <span>
                        {line.startsWith("!") && <span className="text-pink-500">{line.split(" ")[0]}</span>}
                        {line.startsWith("!") && line.includes(" ") && (
                          <span className="text-cyan-400"> {line.split(" ").slice(1).join(" ")}</span>
                        )}
                        {line.startsWith("$") && <span className="text-emerald-400">{line}</span>}
                        {line.startsWith(">") && <span className="text-zinc-500">{line}</span>}
                        {line.includes(":") &&
                          !line.startsWith("!") &&
                          !line.startsWith("$") &&
                          !line.startsWith(">") && (
                            <>
                              <span className="text-violet-400">{line.split(":")[0]}:</span>
                              <span className="text-cyan-400">{line.split(":").slice(1).join(":")}</span>
                            </>
                          )}
                        {line === "---" && <span className="text-zinc-600">{line}</span>}
                        {!line.startsWith("!") &&
                          !line.startsWith("$") &&
                          !line.startsWith(">") &&
                          !line.includes(":") &&
                          line !== "---" && <span className="text-white">{line}</span>}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
