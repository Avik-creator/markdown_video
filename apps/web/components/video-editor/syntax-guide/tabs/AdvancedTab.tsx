"use client";

import { CodeExample, Section, DirectiveDoc } from "../components";
import { directiveOptions, schemaValues } from "../schema";

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
            options={directiveOptions("terminal")}
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
            options={schemaValues("chart", "type")}
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
            options={schemaValues("mockup", "device")}
          />
          <DirectiveDoc directive="bg:" description="Screen background color" />
          <DirectiveDoc
            directive="src:"
            description="Image URL for mockup content"
          />
          <DirectiveDoc
            directive="fit:"
            description="Image fit mode"
            options={schemaValues("mockup", "fit")}
          />
          <DirectiveDoc
            directive="color:"
            description="Text color (for text content)"
          />
          <DirectiveDoc
            directive="size:"
            description="Text size"
            options={schemaValues("mockup", "size")}
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
left:
!text
Left panel copy
right:
!image src:/screenshot.png fit:contain

!duration 4s
!background #1e1e2e`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="split:"
            description="Split direction"
            options={schemaValues("layout", "split")}
          />
          <DirectiveDoc
            directive="left: / right:"
            description="Optional panel labels for child content"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Child directives are assigned to panels in order (first left/top,
          then right/bottom). Use explicit left: and right: labels to direct
          content instead; in vertical layouts those labels mean top and
          bottom respectively.
        </p>
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
            options={schemaValues("emoji", "size")}
          />
          <DirectiveDoc
            directive="animate:"
            description="Animation"
            options={schemaValues("emoji", "animate")}
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
          <DirectiveDoc directive="bg:" description="QR background color" />
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
            options={schemaValues("countdown", "style")}
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
            options={schemaValues("progress", "style")}
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

      {/* Camera Timeline */}
      <Section title="Camera Timeline (Cinematic Control)">
        <CodeExample
          title="camera-keyframes.md"
          code={`!scene
!text
Cinematic Motion
animation: fadeIn
size: 2xl

!camera
- at:0s zoom:1
- at:2s zoom:1.4 pan:right
- at:4s zoom:1 shake:true shakeIntensity:medium

!duration 5s
!background #1e1e2e`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="!camera"
            description="Camera keyframe timeline"
          />
          <DirectiveDoc
            directive="at:"
            description="Keyframe time in seconds"
          />
          <DirectiveDoc
            directive="zoom:"
            description="Zoom level (1 = normal, 1.5 = 150%)"
            options={["1", "1.2", "1.5", "2"]}
          />
          <DirectiveDoc
            directive="pan:"
            description="Pan direction"
            options={schemaValues("camera", "pan")}
          />
          <DirectiveDoc
            directive="shake:"
            description="Enable camera shake"
            options={["true", "false"]}
          />
          <DirectiveDoc
            directive="shakeIntensity:"
            description="Shake intensity"
            options={schemaValues("camera", "shakeIntensity")}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <strong>Cinematic Motion:</strong> Create smooth camera movements with
          keyframe-based animation. Matches After Effects-style thinking for
          professional video production.
        </p>
      </Section>

      {/* Export Formats */}
      <Section title="Export Formats & Targets">
        <CodeExample
          title="export-config.md"
          code={`!export
format: reels
aspectRatio: 9:16
safeArea: true
quality: high
resolution: 1080p

!export
format: shorts
aspectRatio: 9:16
safeArea: true

!export
format: slides
quality: high
includeSubtitles: true`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="format:"
            description="Export target format"
            options={schemaValues("export", "format")}
          />
          <DirectiveDoc
            directive="aspectRatio:"
            description="Video aspect ratio"
            options={schemaValues("export", "aspectRatio")}
          />
          <DirectiveDoc
            directive="safeArea:"
            description="Enable safe area for mobile"
            options={["true", "false"]}
          />
          <DirectiveDoc
            directive="quality:"
            description="Export quality"
            options={schemaValues("export", "quality")}
          />
          <DirectiveDoc
            directive="resolution:"
            description="Video resolution"
            options={["720p", "1080p", "1440p", "4k"]}
          />
          <DirectiveDoc
            directive="includeSubtitles:"
            description="Include subtitle track"
            options={["true", "false"]}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <strong>Multi-Platform Export:</strong> Export to different formats
          optimized for Instagram Reels, YouTube Shorts, PDF slides, and more.
          One markdown → multiple platforms.
        </p>
      </Section>


      {/* Music & Captions */}
      <Section title="Music & Captions">
        <CodeExample
          title="music-captions.md"
          code={`!music https://example.com/theme.mp3 volume:0.4 fade:1s loop:true

!scene
!duration 4
!text
These words become captions`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="volume:"
            description="Music volume from 0 to 1"
            options={["0", "0.4", "1"]}
          />
          <DirectiveDoc
            directive="fade:"
            description="Music fade-in/out seconds (max 30)"
            options={["0", "0.5s", "1s"]}
          />
          <DirectiveDoc
            directive="loop:"
            description="Repeat music shorter than the video"
            options={["true", "false"]}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <strong>Export behavior:</strong> Music starts at 0s, loops by
          default, is truncated at video end, and never extends duration.
          Relative paths such as ./theme.mp3 first use files uploaded in the
          browser-local Assets panel, then static files. Uploads do not travel
          with share links. Remote music must use HTTPS (and CORS in browser
          export). SRT/VTT
          captions are generated from top-level text scenes; burn-in is
          optional and off by default. Burned captions render with the same
          fonts as the rest of the video, so non-Latin text is fully
          supported. GIF output cannot carry audio.
        </p>
      </Section>

      {/* Localization */}
      <Section title="Localization & i18n">
        <CodeExample
          title="localization-basic.md"
          code={`!locales en es

!strings
welcome:
  en: "Welcome to our video"
  es: "Bienvenido a nuestro video"

---

!scene
!text i18n:welcome
animation: fadeIn

!duration 3s

---

!scene
!locale es
!text i18n:welcome
animation: fadeIn

!duration 3s`}
        />
        <CodeExample
          title="localization-keys.md"
          code={`!locales en es fr de

!scene
!text i18n:welcome
animation: fadeIn

!duration 3s

---

!strings
welcome:
  en: "Welcome"
  es: "Bienvenido"
  fr: "Bienvenue"
  de: "Willkommen"`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="!locale"
            description="Set scene locale"
            options={["en", "es", "fr", "de", "ja", "zh"]}
          />
          <DirectiveDoc
            directive="!locales"
            description="Define supported locales"
            options={["en es fr", "en es fr de ja"]}
          />
          <DirectiveDoc
            directive="i18n:"
            description="Reference localization key"
            options={["welcome", "greeting", "title"]}
          />
          <DirectiveDoc
            directive="!strings"
            description="Define localization strings"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <strong>Global Reach:</strong> the first locale in{" "}
          <code className="text-pink-400">!locales</code> is the document
          default. A scene-level <code className="text-pink-400">!locale</code>{" "}
          overrides the preview/export locale for that scene. Translation
          fallback is: effective locale → default locale → first defined
          translation → inline text in the same text object → the literal key.
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
                {"//"}
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
