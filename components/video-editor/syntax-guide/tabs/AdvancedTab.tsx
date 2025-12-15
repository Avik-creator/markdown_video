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
          title="mockup-text.md"
          code={`!scene
!mockup device:iphone bg:#1e1e2e
Hello World!
color: #ffffff
size: lg

!duration 4s`}
        />
        <CodeExample
          title="mockup-image.md"
          code={`!scene
!mockup device:browser bg:#ffffff
src: https://example.com/screenshot.png
fit: cover

!duration 4s`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="device:"
            description="Device type"
            options={["iphone", "ipad", "macbook", "browser", "android"]}
          />
          <DirectiveDoc directive="bg:" description="Screen background color" />
          <DirectiveDoc
            directive="src:"
            description="Image URL for mockup content"
          />
          <DirectiveDoc
            directive="fit:"
            description="Image fit mode"
            options={["cover", "contain", "fill"]}
          />
          <DirectiveDoc
            directive="color:"
            description="Text color (for text content)"
          />
          <DirectiveDoc
            directive="size:"
            description="Text size"
            options={["sm", "md", "lg", "xl"]}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Add text or images inside mockups. Use src: for images. Mockups
          display realistic device frames with Dynamic Island, keyboard bases,
          and browser toolbars.
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

      {/* Editor Features */}
      <Section title="Editor Features">
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-lg p-3 space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
              Comment Toggle
            </h4>
            <p className="text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
              Select lines and press{" "}
              <code className="text-pink-600 dark:text-pink-400 font-mono bg-pink-100 dark:bg-pink-950/30 px-1 py-0.5 rounded">
                Cmd+/
              </code>{" "}
              (Mac) or{" "}
              <code className="text-pink-600 dark:text-pink-400 font-mono bg-pink-100 dark:bg-pink-950/30 px-1 py-0.5 rounded">
                Ctrl+/
              </code>{" "}
              (Windows/Linux) to toggle comments. Comments are prefixed with{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                //
              </code>
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
              Find & Replace
            </h4>
            <p className="text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
              Press{" "}
              <code className="text-pink-600 dark:text-pink-400 font-mono bg-pink-100 dark:bg-pink-950/30 px-1 py-0.5 rounded">
                Ctrl+F
              </code>{" "}
              to find or{" "}
              <code className="text-pink-600 dark:text-pink-400 font-mono bg-pink-100 dark:bg-pink-950/30 px-1 py-0.5 rounded">
                Ctrl+H
              </code>{" "}
              for find & replace.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
              Keyboard Shortcuts
            </h4>
            <p className="text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
              Press{" "}
              <code className="text-pink-600 dark:text-pink-400 font-mono bg-pink-100 dark:bg-pink-950/30 px-1 py-0.5 rounded">
                K
              </code>{" "}
              to view all available keyboard shortcuts.
            </p>
          </div>
        </div>
      </Section>

      {/* Customization Guide */}
      <Section title="Customization Guide">
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-3 space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
              Text Font Families
            </h4>
            <p className="text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
              Use{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                fontFamily:
              </code>{" "}
              with options:{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                serif
              </code>
              ,{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                sans
              </code>
              ,{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                mono
              </code>
              ,{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                display
              </code>
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
              Code Font Families
            </h4>
            <p className="text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
              Use{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                fontFamily:
              </code>{" "}
              with options:{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                mono
              </code>
              ,{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                jetbrains
              </code>
              ,{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                fira
              </code>
              ,{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                source
              </code>
              ,{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                inconsolata
              </code>
              ,{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                courier
              </code>
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
              Code Block Sizing
            </h4>
            <p className="text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
              Control code block dimensions with{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                fontSize:
              </code>{" "}
              (xs, sm, md, lg),{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                height:
              </code>
              , and{" "}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
                width:
              </code>{" "}
              (in pixels).
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
              Multi-Line Text
            </h4>
            <p className="text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
              Create multiple lines in text scenes by using line breaks. Each
              line will be rendered on a separate line while maintaining
              animations and styling.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
