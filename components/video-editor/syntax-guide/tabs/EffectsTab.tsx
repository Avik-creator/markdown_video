"use client"

import { CodeExample, Section, DirectiveDoc } from "../components"

export function EffectsTab() {
  return (
    <>
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
    </>
  )
}
