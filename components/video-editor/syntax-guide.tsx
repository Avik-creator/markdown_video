"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X, Copy, Check, Code, Type, Wand2 } from "lucide-react"
import { useState } from "react"

interface SyntaxGuideProps {
  onClose: () => void
}

function CodeExample({ code, title }: { code: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg bg-[#1e1e2e] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-white"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="p-3 text-xs font-mono text-gray-300 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {children}
    </div>
  )
}

function DirectiveDoc({
  directive,
  description,
  options,
}: {
  directive: string
  description: string
  options?: string[]
}) {
  return (
    <div className="space-y-1">
      <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-pink-400">{directive}</code>
      <p className="text-xs text-muted-foreground">{description}</p>
      {options && (
        <div className="flex flex-wrap gap-1 mt-1">
          {options.map((opt) => (
            <span key={opt} className="text-xs bg-white/5 px-1.5 py-0.5 rounded text-cyan-400">
              {opt}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function SyntaxGuide({ onClose }: SyntaxGuideProps) {
  return (
    <div className="w-[420px] bg-[#0f0f14] border-l border-white/10 flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <h2 className="font-semibold text-white">Syntax Guide</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-muted-foreground hover:text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="basics" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 bg-white/5 p-1 shrink-0">
          <TabsTrigger value="basics" className="text-xs gap-1.5">
            <Type className="w-3 h-3" /> Basics
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs gap-1.5">
            <Code className="w-3 h-3" /> Advanced
          </TabsTrigger>
          <TabsTrigger value="effects" className="text-xs gap-1.5">
            <Wand2 className="w-3 h-3" /> Effects
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <TabsContent value="basics" className="p-4 space-y-6 mt-0 data-[state=inactive]:hidden">
            {/* Overview */}
            <Section title="Overview">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create video scenes using markdown-like syntax. Each scene starts with{" "}
                <code className="text-pink-400">!scene</code> and can contain text, code, terminal, charts, and more.
              </p>
            </Section>

            {/* Basic Scene */}
            <Section title="Scene Structure">
              <CodeExample
                title="scene-structure.md"
                code={`!scene
!text
Your content here
animation: fadeIn
size: lg

!duration 3s
!background #3b82f6
!transition fade

---`}
              />
            </Section>

            {/* Scene Directives */}
            <Section title="Core Directives">
              <div className="space-y-3">
                <DirectiveDoc directive="!scene" description="Starts a new scene block" />
                <DirectiveDoc directive="!duration Xs" description="Scene duration in seconds" />
                <DirectiveDoc
                  directive="!background"
                  description="Background color or gradient"
                  options={["#3b82f6", "linear-gradient(...)"]}
                />
                <DirectiveDoc
                  directive="!transition"
                  description="Transition effect"
                  options={["fade", "slide", "wipe", "zoom", "magic", "none"]}
                />
                <DirectiveDoc directive="!chapter" description='Chapter marker: !chapter "Introduction"' />
              </div>
            </Section>

            {/* Text Scenes */}
            <Section title="Text Scenes">
              <CodeExample
                title="text-scene.md"
                code={`!scene
!text
Hello World!
animation: bounceIn
size: 2xl

!duration 3s
!background #8b5cf6`}
              />
              <div className="space-y-2 mt-3">
                <DirectiveDoc
                  directive="animation:"
                  description="Text animation"
                  options={["fadeIn", "slideUp", "slideDown", "bounceIn", "typewriter"]}
                />
                <DirectiveDoc directive="size:" description="Text size" options={["sm", "md", "lg", "xl", "2xl"]} />
              </div>
            </Section>

            {/* Code Scenes */}
            <Section title="Code Scenes">
              <CodeExample
                title="code-scene.md"
                code={`!scene
!code
highlight: 2-4
typing: true
speed: 40
\`\`\`typescript
const msg = "Hello"
console.log(msg)
\`\`\`

!duration 5s
!background #1e1e2e`}
              />
              <div className="space-y-2 mt-3">
                <DirectiveDoc directive="highlight:" description="Lines to highlight" options={["2", "1-3", "1,3,5"]} />
                <DirectiveDoc directive="typing: true" description="Enable typing animation" />
                <DirectiveDoc directive="speed: 40" description="Typing speed (chars/sec)" />
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="advanced" className="p-4 space-y-6 mt-0 data-[state=inactive]:hidden">
            {/* Terminal */}
            <Section title="Terminal Scene">
              <CodeExample
                title="terminal.md"
                code={`!scene
!terminal
typing: true
speed: 30
$ npm install next
$ npm run dev
> Ready on localhost:3000

!duration 5s
!background #0d0d0d`}
              />
            </Section>

            {/* Diff */}
            <Section title="Code Diff">
              <CodeExample
                title="diff.md"
                code={`!scene
!diff typescript
- const old = "before"
+ const new = "after"
  unchanged line

!duration 4s
!background #1e1e2e`}
              />
            </Section>

            {/* Chart */}
            <Section title="Charts">
              <CodeExample
                title="chart.md"
                code={`!scene
!chart type:bar animate:true
React: 85
Vue: 70
Angular: 60

!duration 5s
!background #1e1e2e`}
              />
              <div className="space-y-2 mt-3">
                <DirectiveDoc directive="type:" description="Chart type" options={["bar", "pie", "donut", "line"]} />
                <DirectiveDoc directive="animate: true" description="Enable chart animation" />
              </div>
            </Section>

            {/* Mockup */}
            <Section title="Device Mockups">
              <CodeExample
                title="mockup.md"
                code={`!scene
!mockup device:iphone

!duration 4s
!background #1a1a24`}
              />
              <div className="space-y-2 mt-3">
                <DirectiveDoc
                  directive="device:"
                  description="Device type"
                  options={["iphone", "ipad", "macbook", "browser", "android"]}
                />
              </div>
            </Section>

            {/* Split Layout */}
            <Section title="Split Layout">
              <CodeExample
                title="split.md"
                code={`!scene
!layout split:horizontal

!duration 4s
!background #1e1e2e`}
              />
              <div className="space-y-2 mt-3">
                <DirectiveDoc directive="split:" description="Split direction" options={["horizontal", "vertical"]} />
              </div>
            </Section>

            {/* Variables */}
            <Section title="Variables">
              <CodeExample
                title="variables.md"
                code={`!var brandColor #3b82f6
!var title My Project

!scene
!text
$title
animation: fadeIn

!background $brandColor`}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Define variables with <code className="text-pink-400">!var name value</code> and use with{" "}
                <code className="text-cyan-400">$name</code>
              </p>
            </Section>
          </TabsContent>

          <TabsContent value="effects" className="p-4 space-y-6 mt-0 data-[state=inactive]:hidden">
            {/* Particles */}
            <Section title="Particle Effects">
              <CodeExample
                title="particles.md"
                code={`!scene
!text
Celebration!

!particles type:confetti intensity:high
!duration 4s
!background #8b5cf6`}
              />
              <div className="space-y-2 mt-3">
                <DirectiveDoc
                  directive="type:"
                  description="Particle type"
                  options={["confetti", "snow", "sparkles", "rain", "fireworks"]}
                />
                <DirectiveDoc
                  directive="intensity:"
                  description="Particle density"
                  options={["low", "medium", "high"]}
                />
              </div>
            </Section>

            {/* Camera */}
            <Section title="Camera Effects">
              <CodeExample
                title="camera.md"
                code={`!scene
!text
Dramatic Zoom!

!camera zoom:1.5 duration:2s
!duration 4s`}
              />
              <div className="space-y-2 mt-3">
                <DirectiveDoc directive="zoom:1.5" description="Zoom in/out (1 = normal)" />
                <DirectiveDoc directive="pan:left" description="Pan camera direction" />
                <DirectiveDoc directive="shake:true" description="Camera shake effect" />
              </div>
            </Section>

            {/* Callout */}
            <Section title="Callouts">
              <CodeExample
                title="callout.md"
                code={`!scene
!code
\`\`\`js
const x = 1
\`\`\`

!callout arrow:down "Important!"
!duration 4s`}
              />
              <div className="space-y-2 mt-3">
                <DirectiveDoc
                  directive="arrow:"
                  description="Arrow direction"
                  options={["up", "down", "left", "right"]}
                />
                <DirectiveDoc directive="target:line:3" description="Target a specific line" />
              </div>
            </Section>

            {/* Presenter */}
            <Section title="Presenter Mode">
              <CodeExample
                title="presenter.md"
                code={`!scene
!mockup device:browser

!presenter position:bottom-right size:md shape:circle
!duration 5s`}
              />
              <div className="space-y-2 mt-3">
                <DirectiveDoc
                  directive="position:"
                  description="PiP position"
                  options={["top-left", "top-right", "bottom-left", "bottom-right"]}
                />
                <DirectiveDoc directive="size:" description="PiP size" options={["sm", "md", "lg"]} />
                <DirectiveDoc directive="shape:" description="PiP shape" options={["circle", "square", "rounded"]} />
              </div>
            </Section>

            {/* Color Palette */}
            <Section title="Color Palette">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { color: "#ef4444", name: "Red" },
                  { color: "#f97316", name: "Orange" },
                  { color: "#eab308", name: "Yellow" },
                  { color: "#22c55e", name: "Green" },
                  { color: "#06b6d4", name: "Cyan" },
                  { color: "#3b82f6", name: "Blue" },
                  { color: "#8b5cf6", name: "Violet" },
                  { color: "#ec4899", name: "Pink" },
                ].map(({ color }) => (
                  <div key={color} className="text-center">
                    <div className="w-full h-8 rounded" style={{ backgroundColor: color }} />
                    <span className="text-xs text-gray-500 mt-1 block">{color}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Keyboard Shortcuts */}
            <Section title="Keyboard Shortcuts">
              <div className="space-y-2">
                {[
                  { keys: "Space", action: "Play / Pause" },
                  { keys: "←  →", action: "Seek 1 second" },
                  { keys: "Home / End", action: "Go to start/end" },
                  { keys: "?", action: "Toggle guide" },
                ].map(({ keys, action }) => (
                  <div key={keys} className="flex items-center justify-between">
                    <kbd className="text-xs bg-white/10 px-2 py-1 rounded font-mono">{keys}</kbd>
                    <span className="text-xs text-muted-foreground">{action}</span>
                  </div>
                ))}
              </div>
            </Section>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
