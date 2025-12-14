"use client"

import { CodeExample, Section, DirectiveDoc } from "../components"

export function AdvancedTab() {
  return (
    <>
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
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="!terminal"
            description="Terminal/CLI scene"
            options={["!terminal", "!shell", "!cli", "!console", "!cmd", "!bash"]}
          />
        </div>
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
    </>
  )
}
