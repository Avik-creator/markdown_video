"use client";

import { CodeExample, Section, DirectiveDoc } from "../components";

export function BasicsTab() {
  return (
    <>
      {/* Overview */}
      <Section title="Overview">
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
            Create video scenes using markdown-like syntax. Each scene starts
            with{" "}
            <code className="text-pink-600 dark:text-pink-400 font-mono bg-pink-100 dark:bg-pink-950/30 px-1 py-0.5 rounded">
              !scene
            </code>{" "}
            (or{" "}
            <code className="text-pink-600 dark:text-pink-400 font-mono bg-pink-100 dark:bg-pink-950/30 px-1 py-0.5 rounded">
              !slide
            </code>
            ,{" "}
            <code className="text-pink-600 dark:text-pink-400 font-mono bg-pink-100 dark:bg-pink-950/30 px-1 py-0.5 rounded">
              !frame
            </code>
            ) and can contain text, code, terminal, charts, and more.
          </p>
          <p className="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed">
            <strong className="text-gray-900 dark:text-white">Tip:</strong>{" "}
            Alternative keywords are available to avoid conflicts with other
            markdown parsers. Use{" "}
            <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
              !slide
            </code>{" "}
            instead of{" "}
            <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
              !scene
            </code>
            ,{" "}
            <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
              !heading
            </code>{" "}
            instead of{" "}
            <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/30 px-1 py-0.5 rounded">
              !text
            </code>
            , etc.
          </p>
        </div>
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
          <DirectiveDoc
            directive="!scene"
            description="Starts a new scene block"
            options={["!scene", "!slide", "!frame", "!section", "!page"]}
          />
          <DirectiveDoc
            directive="!duration Xs"
            description="Scene duration in seconds"
            options={["!duration", "!time", "!length"]}
          />
          <DirectiveDoc
            directive="!background"
            description="Background color or gradient"
            options={[
              "!background",
              "!bg",
              "!color",
              "#3b82f6",
              "linear-gradient(...)",
            ]}
          />
          <DirectiveDoc
            directive="!transition"
            description="Transition effect"
            options={[
              "!transition",
              "!trans",
              "!effect",
              "fade",
              "slide",
              "wipe",
              "zoom",
              "magic",
              "none",
            ]}
          />
          <DirectiveDoc
            directive="!chapter"
            description='Chapter marker: !chapter "Introduction"'
          />
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
color: #ffffff

!duration 3s
!background #8b5cf6`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="!text"
            description="Text content directive"
            options={[
              "!text",
              "!heading",
              "!title",
              "!h1",
              "!h2",
              "!paragraph",
              "!p",
            ]}
          />
          <DirectiveDoc
            directive="animation:"
            description="Text animation"
            options={[
              "fadeIn",
              "slideUp",
              "slideDown",
              "bounceIn",
              "typewriter",
            ]}
          />
          <DirectiveDoc
            directive="size:"
            description="Text size"
            options={["sm", "md", "lg", "xl", "2xl"]}
          />
          <DirectiveDoc
            directive="color:"
            description="Text color (hex)"
            options={["#ffffff", "#000000", "#3b82f6"]}
          />
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
          <DirectiveDoc
            directive="!code"
            description="Code block directive"
            options={["!code", "!snippet", "!block", "!codeblock", "!syntax"]}
          />
          <DirectiveDoc
            directive="highlight:"
            description="Lines to highlight"
            options={["2", "1-3", "1,3,5"]}
          />
          <DirectiveDoc
            directive="typing: true"
            description="Enable typing animation"
          />
          <DirectiveDoc
            directive="speed: 40"
            description="Typing speed (chars/sec)"
          />
        </div>
      </Section>

      {/* Image Scenes */}
      <Section title="Image Scenes">
        <CodeExample
          title="image-scene.md"
          code={`!scene
!image src:https://example.com/photo.jpg fit:cover

!duration 4s
!background #1e1e2e`}
        />
        <div className="space-y-2 mt-3">
          <DirectiveDoc
            directive="!image"
            description="Image scene directive"
            options={["!image", "!img", "!photo", "!picture"]}
          />
          <DirectiveDoc directive="src:" description="Image URL (required)" />
          <DirectiveDoc
            directive="fit:"
            description="Image fit mode"
            options={["cover", "contain", "fill"]}
          />
          <DirectiveDoc
            directive="position:"
            description="Image position"
            options={["center", "top", "bottom", "left", "right"]}
          />
          <DirectiveDoc
            directive='alt:"text"'
            description="Alt text for accessibility"
          />
        </div>
      </Section>
    </>
  );
}
