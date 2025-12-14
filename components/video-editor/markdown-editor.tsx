"use client"
import { useVideoStore } from "@/lib/use-video-store"
import { useEffect, useState, useRef, useCallback } from "react"
import { FileText, Wand2, Terminal, BarChart3, Smartphone, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

const EXAMPLE_TEMPLATES = {
  intro: `!scene
!text
Welcome to My Video
animation: bounceIn
size: 2xl

!duration 3s
!background #3b82f6
!transition fade`,
  code: `!scene
!code
highlight: 2-4
typing: true
speed: 40
\`\`\`typescript
const greeting = "Hello"
console.log(greeting)
// More code here
\`\`\`

!duration 4s
!background #1e1e2e
!transition slide`,
  text: `!scene
!text
Add your message here
animation: slideUp
size: lg

!duration 3s
!background #8b5cf6`,
  terminal: `!scene
!terminal
$ npm install next
$ npm run dev
> Ready on http://localhost:3000

!duration 5s
!background #0d0d0d
!transition slide`,
  chart: `!scene
!chart type:bar animate:true
React: 85
Vue: 70
Angular: 60

!duration 5s
!background #1e1e2e
!transition fade`,
  mockup: `!scene
!mockup device:iphone

!presenter position:bottom-right
!duration 4s
!background #1a1a24
!transition zoom`,
  particles: `!scene
!text
Celebration Time!
animation: bounceIn
size: 2xl

!particles type:confetti intensity:high
!duration 4s
!background #ec4899
!transition fade`,
}

function getLineClassName(line: string): string {
  const trimmed = line.trim()

  if (trimmed === "---") return "text-orange-400"
  if (trimmed.startsWith("//")) return "text-gray-500"
  if (trimmed.startsWith("+") && !trimmed.startsWith("++")) return "text-green-400"
  if (trimmed.startsWith("-") && !trimmed.startsWith("--") && !trimmed.startsWith("---")) return "text-red-400"
  if (trimmed.startsWith("!")) return "text-pink-400"
  if (trimmed.startsWith("```")) return "text-emerald-400"
  if (trimmed.startsWith("$") || trimmed.startsWith(">")) return "text-cyan-400"
  if (trimmed.includes(":")) return "text-purple-400"

  return "text-gray-400"
}

export function MarkdownEditor() {
  const markdown = useVideoStore((state) => state.markdown)
  const setMarkdown = useVideoStore((state) => state.setMarkdown)
  const [localMarkdown, setLocalMarkdown] = useState(markdown)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMarkdown(localMarkdown)
    }, 500)
    return () => clearTimeout(timeout)
  }, [localMarkdown, setMarkdown])

  useEffect(() => {
    setLocalMarkdown(markdown)
  }, [markdown])

  const insertTemplate = (type: keyof typeof EXAMPLE_TEMPLATES) => {
    const template = EXAMPLE_TEMPLATES[type]
    const separator = localMarkdown.trim() ? "\n\n---\n\n" : ""
    const newMarkdown = localMarkdown + separator + template
    setLocalMarkdown(newMarkdown)

    // Focus textarea after insert
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight
      }
    }, 0)
  }

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const lines = localMarkdown.split("\n")
  const lineCount = lines.length

  return (
    <div className="w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-pink-500" />
          <h2 className="text-sm font-medium text-white">Editor</h2>
        </div>
        <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded">{lineCount} lines</span>
      </div>

      {/* Quick insert buttons */}
      <div className="p-2 border-b border-zinc-800 flex gap-1 flex-wrap shrink-0 bg-zinc-900/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertTemplate("intro")}
          className="text-xs h-7 text-pink-400 hover:text-pink-300 hover:bg-pink-500/10"
        >
          <Wand2 className="w-3 h-3 mr-1" />
          Intro
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertTemplate("text")}
          className="text-xs h-7 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
        >
          Text
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertTemplate("code")}
          className="text-xs h-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
        >
          Code
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertTemplate("terminal")}
          className="text-xs h-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
        >
          <Terminal className="w-3 h-3 mr-1" />
          Term
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertTemplate("chart")}
          className="text-xs h-7 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
        >
          <BarChart3 className="w-3 h-3 mr-1" />
          Chart
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertTemplate("mockup")}
          className="text-xs h-7 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
        >
          <Smartphone className="w-3 h-3 mr-1" />
          Device
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertTemplate("particles")}
          className="text-xs h-7 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
        >
          <Sparkles className="w-3 h-3 mr-1" />
          FX
        </Button>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="w-10 bg-zinc-900 border-r border-zinc-800 overflow-hidden shrink-0 select-none"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="py-3">
            {lines.map((_, i) => (
              <div
                key={i}
                className="text-xs text-zinc-600 font-mono text-right pr-2"
                style={{ height: "20px", lineHeight: "20px" }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={localMarkdown}
          onChange={(e) => setLocalMarkdown(e.target.value)}
          onScroll={handleScroll}
          className="flex-1 resize-none bg-zinc-950 border-0 text-sm font-mono text-zinc-300 focus:outline-none focus-visible:ring-0 p-3 overflow-auto"
          placeholder="Enter your scene markdown..."
          spellCheck={false}
          style={{
            lineHeight: "20px",
            caretColor: "#ec4899",
            tabSize: 2,
          }}
        />
      </div>

      {/* Footer hint */}
      <div className="p-2 border-t border-zinc-800 bg-zinc-900/50 shrink-0">
        <p className="text-xs text-zinc-500">
          Press <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-pink-400">?</kbd> for syntax
          guide
        </p>
      </div>
    </div>
  )
}
