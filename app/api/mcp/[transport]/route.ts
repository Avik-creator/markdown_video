// MCP Handler for Markdown Video
// Provides documentation, validation, and guide tools for AI assistants

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  validateMarkdownSyntax,
  quickSyntaxCheck,
  getSyntaxSuggestions,
} from "@/lib/mcp/syntax-validator";
import {
  getAllDirectives,
  getDirectiveDoc,
  getQuickReference,
  getExamplesByCategory,
  searchDocumentation,
} from "@/lib/mcp/documentation";
import { parseMarkdownFull } from "@/lib/parser";

const handler = createMcpHandler(
  (server) => {
    // Tool 1: Validate Markdown Syntax
    server.tool(
      "validate_syntax",
      "Validates markdown syntax for markdown_video and returns detailed error reports",
      {
        markdown: z.string().describe("The markdown content to validate"),
      },
      async ({ markdown }) => {
        const result = validateMarkdownSyntax(markdown);

        const errorText =
          result.errors.length > 0
            ? `\n\n❌ Errors:\n${result.errors
              .map((e) => `  Line ${e.line || "?"}: ${e.message}${e.suggestion ? `\n    💡 ${e.suggestion}` : ""}`)
              .join("\n")}`
            : "";

        const warningText =
          result.warnings.length > 0
            ? `\n\n⚠️  Warnings:\n${result.warnings
              .map((w) => `  Line ${w.line || "?"}: ${w.message}${w.suggestion ? `\n    💡 ${w.suggestion}` : ""}`)
              .join("\n")}`
            : "";

        return {
          content: [
            {
              type: "text",
              text: `📊 Validation Result

✅ Valid: ${result.valid}
🎬 Scenes: ${result.scenes.length}
⏱️  Duration: ${result.totalDuration}s${errorText}${warningText}

${result.valid ? "✨ Your markdown syntax is valid!" : "🔧 Please fix the errors above to proceed."}`,
            },
          ],
        };
      }
    );

    // Tool 2: Quick Syntax Check
    server.tool(
      "quick_check",
      "Performs a quick syntax check without full validation",
      {
        markdown: z.string().describe("The markdown content to check"),
      },
      async ({ markdown }) => {
        const result = quickSyntaxCheck(markdown);

        return {
          content: [
            {
              type: "text",
              text: `🚀 Quick Check Result

🎬 Has Scenes: ${result.hasScenes ? "Yes" : "No"}
📊 Scene Count: ${result.sceneCount}
⏱️  Estimated Duration: ${result.estimatedDuration}s

${result.issues.length > 0 ? `⚠️  Issues Found:\n${result.issues.map((i) => `  • ${i}`).join("\n")}` : "✅ No obvious issues detected"}`,
            },
          ],
        };
      }
    );

    // Tool 3: Get Documentation for Directive
    server.tool(
      "get_directive_docs",
      "Gets comprehensive documentation for a specific directive",
      {
        directive: z
          .string()
          .describe("The directive name (e.g., 'scene', 'text', 'code')"),
      },
      async ({ directive }) => {
        const doc = getDirectiveDoc(directive);

        if (!doc) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Directive "${directive}" not found.\n\n💡 Try searching with the 'search_docs' tool to find similar directives.`,
              },
            ],
          };
        }

        const aliasesText =
          doc.aliases.length > 0
            ? `\n📌 Aliases: ${doc.aliases.map((a) => `!${a}`).join(", ")}`
            : "";

        const propertiesText = doc.properties
          ? `\n\n🔧 Properties:\n${doc.properties
            .map(
              (p) =>
                `  • ${p.name}${p.required ? " (required)" : ""}: ${p.type}\n    ${p.description}${p.default ? `\n    Default: ${p.default}` : ""
                }${p.values ? `\n    Values: ${p.values.join(", ")}` : ""}`
            )
            .join("\n\n")}`
          : "";

        const examplesText = `\n\n📝 Examples:\n${doc.examples
          .map((ex, i) => `\n${i + 1}. \`\`\`markdown\n${ex}\n\`\`\``)
          .join("\n")}`;

        return {
          content: [
            {
              type: "text",
              text: `# !${doc.name}

📖 ${doc.description}
🏷️  Category: ${doc.category}${aliasesText}

💻 Syntax:
\`\`\`
${doc.syntax}
\`\`\`${propertiesText}${examplesText}`,
            },
          ],
        };
      }
    );

    // Tool 4: Get All Directives
    server.tool(
      "list_directives",
      "Lists all available directives grouped by category",
      {},
      async () => {
        const directives = getAllDirectives();
        const byCategory = directives.reduce(
          (acc, doc) => {
            if (!acc[doc.category]) acc[doc.category] = [];
            acc[doc.category].push(doc);
            return acc;
          },
          {} as Record<string, typeof directives>
        );

        const sections = Object.entries(byCategory)
          .map(([category, docs]) => {
            const icon =
              {
                scene: "🎬",
                content: "📝",
                effect: "✨",
                layout: "📐",
                meta: "⚙️",
              }[category] || "📄";

            return `${icon} ${category.toUpperCase()}\n${docs
              .map(
                (d) =>
                  `  • !${d.name}${d.aliases.length > 0 ? ` (aliases: ${d.aliases.join(", ")})` : ""}\n    ${d.description}`
              )
              .join("\n\n")}`;
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `# 📚 All Available Directives

${sections}

💡 Use 'get_directive_docs' with a directive name for detailed documentation.`,
            },
          ],
        };
      }
    );

    // Tool 5: Search Documentation
    server.tool(
      "search_docs",
      "Searches documentation for directives matching a query",
      {
        query: z
          .string()
          .describe("Search query (directive name, alias, or keyword)"),
      },
      async ({ query }) => {
        const results = searchDocumentation(query);

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `❌ No results found for "${query}".\n\n💡 Try:\n  • Using different keywords\n  • Listing all directives with 'list_directives'\n  • Getting the quick reference with 'quick_reference'`,
              },
            ],
          };
        }

        const resultsText = results
          .map(
            (doc) =>
              `• !${doc.name}${doc.aliases.length > 0 ? ` (${doc.aliases.join(", ")})` : ""}\n  ${doc.description}\n  Category: ${doc.category}`
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `🔍 Search Results for "${query}"\n\nFound ${results.length} result(s):\n\n${resultsText}\n\n💡 Use 'get_directive_docs' with a directive name for full documentation.`,
            },
          ],
        };
      }
    );

    // Tool 6: Get Quick Reference
    server.tool(
      "quick_reference",
      "Gets a quick reference guide with common patterns and examples",
      {},
      async () => {
        const reference = getQuickReference();

        return {
          content: [
            {
              type: "text",
              text: reference,
            },
          ],
        };
      }
    );

    // Tool 7: Get Examples by Category
    server.tool(
      "get_examples",
      "Gets example code snippets for a specific category",
      {
        category: z
          .enum(["scene", "content", "effect", "layout", "meta"])
          .describe("Category to get examples for"),
      },
      async ({ category }) => {
        const examples = getExamplesByCategory(category);

        if (examples.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No examples found for category "${category}".`,
              },
            ],
          };
        }

        const examplesText = examples
          .map((ex, i) => `${i + 1}. \`\`\`markdown\n${ex}\n\`\`\``)
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `# 📝 Examples for "${category}"\n\n${examplesText}`,
            },
          ],
        };
      }
    );

    // Tool 8: Parse and Analyze
    server.tool(
      "parse_markdown",
      "Parses markdown and returns detailed scene information",
      {
        markdown: z.string().describe("The markdown content to parse"),
      },
      async ({ markdown }) => {
        try {
          const result = parseMarkdownFull(markdown);
          const { scenes, chapters, variables } = result;

          const scenesText = scenes
            .map(
              (scene, i) =>
                `Scene ${i + 1}:\n  Type: ${scene.type}\n  Duration: ${scene.duration}s\n  Background: ${scene.background || "default"}${scene.transition ? `\n  Transition: ${scene.transition}` : ""
                }${scene.chapter ? `\n  Chapter: ${scene.chapter}` : ""}`
            )
            .join("\n\n");

          const chaptersText =
            chapters.length > 0
              ? `\n\n📑 Chapters:\n${chapters.map((c) => `  • ${c.title} (at ${c.time}s)`).join("\n")}`
              : "";

          const variablesText =
            Object.keys(variables).length > 0
              ? `\n\n🔧 Variables:\n${Object.entries(variables)
                .map(([key, value]) => `  • $${key} = ${value}`)
                .join("\n")}`
              : "";

          const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

          return {
            content: [
              {
                type: "text",
                text: `# 📊 Parse Analysis

🎬 Total Scenes: ${scenes.length}
⏱️  Total Duration: ${totalDuration}s${chaptersText}${variablesText}

📝 Scene Breakdown:
${scenesText}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Parse Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      }
    );

    // Tool 9: Get Syntax Suggestions
    server.tool(
      "get_suggestions",
      "Gets context-aware syntax suggestions based on partial markdown",
      {
        markdown: z
          .string()
          .describe("The partial markdown content to get suggestions for"),
      },
      async ({ markdown }) => {
        const suggestions = getSyntaxSuggestions(markdown);

        if (suggestions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "💡 No specific suggestions available. Try starting with:\n  • !scene - to create a new scene\n  • !text - to add text content\n  • !code - to add a code block",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `💡 Suggested Next Steps:\n\n${suggestions.map((s) => `  • ${s}`).join("\n")}`,
            },
          ],
        };
      }
    );

    // Tool 10: Generate Template
    server.tool(
      "generate_template",
      "Generates a complete markdown template for a specific video type",
      {
        type: z
          .enum([
            "intro",
            "tutorial",
            "code-demo",
            "presentation",
            "announcement",
          ])
          .describe("Type of template to generate"),
      },
      async ({ type }) => {
        const templates: Record<string, string> = {
          intro: `!var brandColor #3b82f6

!scene
!chapter "Welcome"
!duration 5
!background $brandColor
!text
Welcome to My Video
animation: fadeIn
size: 2xl

---

!scene
!transition slide 1s
!duration 4
!text
Let's Get Started
animation: slideUp
size: xl

---

!scene
!emoji 🚀 size:2xl animate:bounce
!duration 3`,

          tutorial: `!scene
!chapter "Introduction"
!duration 5
!text
How to Build Amazing Things
size: 2xl

---

!scene
!chapter "Step 1: Setup"
!transition fade
!text
First, let's set up our environment
animation: fadeIn

---

!scene
!code
typing: true
speed: 50
\`\`\`bash
npm install awesome-library
\`\`\`

---

!scene
!chapter "Step 2: Implementation"
!code
highlight: 2,3
\`\`\`javascript
import { awesome } from 'awesome-library';

awesome.doSomething();
\`\`\`

---

!scene
!text
That's it! You're done! 🎉
size: xl
animation: bounceIn`,

          "code-demo": `!var accentColor #ec4899

!scene
!background $accentColor
!text
Code Demo
size: 2xl

---

!scene
!transition slide
!code
typing: true
speed: 60
highlight: 1,2,3
annotations:
- line: 1 text: "Import the library"
- line: 3 text: "Create an instance"
\`\`\`javascript
import { Library } from 'my-library';

const lib = new Library();
lib.execute();
\`\`\`

---

!scene
!terminal
typing: true
$ npm run build
> Building...
> ✓ Build complete!

---

!scene
!diff javascript
  const config = {
-   mode: 'development',
+   mode: 'production',
    optimize: true
  };`,

          presentation: `!scene
!chapter "Title Slide"
!duration 4
!background linear-gradient(135deg, #667eea 0%, #764ba2 100%)
!text
My Presentation
size: 2xl

---

!scene
!chapter "Agenda"
!transition fade
!text
• Topic 1
• Topic 2  
• Topic 3
size: lg

---

!scene
!chapter "Key Points"
!chart type:bar animate:true
Performance: 95
Reliability: 88
Satisfaction: 92

---

!scene
!chapter "Demo"
!mockup device:browser
content: image
image: /screenshot.png

---

!scene
!chapter "Questions?"
!text
Thank You!
size: 2xl
!qr url:https://example.com/contact label:"Get in touch"`,

          announcement: `!var mainColor #22c55e

!scene
!background $mainColor
!particles type:confetti intensity:high
!countdown from:3 style:digital

---

!scene
!duration 5
!camera zoom:1.5 duration:5s
!text
Big Announcement!
animation: zoomIn
size: 2xl

---

!scene
!transition magic
!emoji 🎉 size:2xl animate:bounce
!text
We're Launching Something New
size: xl

---

!scene
!progress value:100 max:100 style:circle animate:true label:"Coming Soon"
!duration 4`,
        };

        const template = templates[type];

        return {
          content: [
            {
              type: "text",
              text: `# 📝 ${type.toUpperCase().replace("-", " ")} Template

Here's a complete template you can use:

\`\`\`markdown
${template}
\`\`\`

💡 Copy this template and customize it to your needs!`,
            },
          ],
        };
      }
    );
  },
  {
    capabilities: {
      tools: {},
    },
  },
  {
    redisUrl: process.env.REDIS_URL,
    basePath: "/api/mcp",
    verboseLogs: process.env.NODE_ENV === "development",
    maxDuration: 60,
  }
);

export { handler as GET, handler as POST };

