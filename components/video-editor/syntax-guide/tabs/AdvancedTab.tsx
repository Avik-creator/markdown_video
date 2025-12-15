"use client";

import { CodeExample, Section, DirectiveDoc } from "../components";

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
            options={[
              "!terminal",
              "!shell",
              "!cli",
              "!console",
              "!cmd",
              "!bash",
            ]}
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
          <DirectiveDoc
            directive="type:"
            description="Chart type"
            options={["bar", "pie", "donut", "line"]}
          />
          <DirectiveDoc
            directive="animate: true"
            description="Enable chart animation"
          />
        </div>
      </Section>

      {/* Mockup */}
      <Section title="Device Mockups">
        <CodeExample
          title="mockup.md"
          code={`!scene
!mockup device:iphone bg:#1e1e2e
Hello World!
color: #ffffff
size: lg

!duration 4s
!background #1a1a24`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="device:"
            description="Device type"
            options={["iphone", "ipad", "macbook", "browser", "android"]}
          />
          <DirectiveDoc
            directive="bg:"
            description="Screen background color"
            options={["#ffffff", "#1e1e2e", "#000000"]}
          />
          <DirectiveDoc
            directive="color:"
            description="Text color inside mockup"
          />
          <DirectiveDoc
            directive="size:"
            description="Text size"
            options={["sm", "md", "lg", "xl"]}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Add text content directly below the mockup directive. Mockups display
          realistic device frames with Dynamic Island, keyboard bases, and
          browser toolbars.
        </p>
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
          <DirectiveDoc
            directive="split:"
            description="Split direction"
            options={["horizontal", "vertical"]}
          />
        </div>
      </Section>

      {/* Emoji */}
      <Section title="Emoji Scene">
        <CodeExample
          title="emoji.md"
          code={`!scene
!emoji 🎉 size:xl animate:bounce

!duration 3s
!background #8b5cf6`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="size:"
            description="Emoji size"
            options={["sm", "md", "lg", "xl", "2xl"]}
          />
          <DirectiveDoc
            directive="animate:"
            description="Animation"
            options={["bounce", "spin", "pulse", "shake", "none"]}
          />
        </div>
      </Section>

      {/* QR Code */}
      <Section title="QR Code">
        <CodeExample
          title="qr.md"
          code={`!scene
!qr url:https://example.com size:200 label:"Scan me"

!duration 4s
!background #1e1e2e`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc directive="url:" description="URL to encode" />
          <DirectiveDoc
            directive="size:"
            description="QR code size in pixels"
          />
          <DirectiveDoc directive="color:" description="QR code color" />
          <DirectiveDoc directive='label:"text"' description="Label below QR" />
        </div>
      </Section>

      {/* Countdown */}
      <Section title="Countdown">
        <CodeExample
          title="countdown.md"
          code={`!scene
!countdown from:10 style:circle color:#ec4899

!duration 10s
!background #1e1e2e`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc directive="from:" description="Start number" />
          <DirectiveDoc
            directive="style:"
            description="Display style"
            options={["digital", "circle", "minimal"]}
          />
          <DirectiveDoc directive="color:" description="Countdown color" />
        </div>
      </Section>

      {/* Progress */}
      <Section title="Progress Bar">
        <CodeExample
          title="progress.md"
          code={`!scene
!progress value:75 style:bar animate:true label:"Loading..."

!duration 4s
!background #1e1e2e`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="value:"
            description="Progress value (0-100)"
          />
          <DirectiveDoc
            directive="max:"
            description="Maximum value (default: 100)"
          />
          <DirectiveDoc
            directive="style:"
            description="Display style"
            options={["bar", "circle", "semicircle"]}
          />
          <DirectiveDoc
            directive="animate:"
            description="Animate progress"
            options={["true", "false"]}
          />
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
          Define variables with{" "}
          <code className="text-pink-400">!var name value</code> and use with{" "}
          <code className="text-cyan-400">$name</code>
        </p>
      </Section>
    </>
  );
}
