# 🎬 Markdown to Video

Transform your Markdown into animated videos with a custom syntax that brings your content to life. Markdown to Video is a Next.js-based web application that converts Markdown content into videos with rich animations, transitions, and scene types.

![Markdown to Video Showcase](./public/og-image.png)

## ✨ Features

- **MCP server** — an [MCP](https://modelcontextprotocol.io) endpoint at `/api/mcp` exposes 12 tools: ten authoring/documentation/validation tools plus `render_preview` and `render_video` for direct screenshots and temporary MP4 URLs so a coding agent can author and validate scenes against the same parser the editor uses.

- **Custom Markdown Syntax**: Write videos using an intuitive extended Markdown syntax with custom directives
- **Rich Scene Types**: Support for text, code, images, terminal, diffs, charts, mockups, QR codes, countdowns, progress bars, and more
- **FFmpeg.wasm Export**: Render and download MP4 videos or animated GIFs in the browser
- **Real-time Preview**: See your video content as you edit it with live scene previews
- **Errors as you type**: Unknown directives and invalid values are marked on the line that caused them, with one-click fixes for typos
- **Autocomplete**: Directive names after `!`, and allowed values for properties like `transition`, `animation:` and `type:`
- **Advanced Animations**: Multiple animation types including typewriter, slide, fade, bounce, and custom effects
- **Particle Effects**: Add confetti, snow, rain, sparkles, and fireworks to your scenes
- **Code Syntax Highlighting**: Beautiful syntax highlighting for multiple programming languages
- **Scene Transitions**: Smooth transitions between scenes (fade, slide, wipe, zoom, magic effects)
- **Terminal & Diff Support**: Render terminal commands and code diffs with syntax highlighting
- **Chart Rendering**: Create animated charts (bar, line, pie, donut) embedded in videos
- **Video Variables**: Define and reuse variables throughout your markdown
- **Local Projects**: Autosave one document in browser storage, and open/save it as a `.mdv` file; there is no multi-project library yet
- **Keyboard Shortcuts**: Boost productivity with keyboard shortcuts for common editor actions
- **Find & Replace**: Quickly edit content across your markdown
- **Theme Support**: Light and dark theme with customizable color schemes
- **Experimental Sharing**: Generate links that open a project in the editor; large-project links require a configured Redis backend and expire after 7 days. There is no dedicated embed player yet; iframe embeds currently expose the editor UI

> **Platform note:** The editor is designed primarily for modern desktop browsers. Mobile editing is not optimized yet, and browser-based export can be resource-intensive for longer videos.

## 🤖 Use it from an AI agent (MCP)

The hosted MCP server lets Claude, Cursor or any MCP client write and check scenes with the same parser the editor uses.

Claude Code:

```bash
claude mcp add --transport http markdown-video https://markdown-video-theta.vercel.app/api/mcp/mcp
```

Cursor, Windsurf and other clients that take a JSON config:

```json
{
  "mcpServers": {
    "markdown-video": {
      "url": "https://markdown-video-theta.vercel.app/api/mcp/mcp"
    }
  }
}
```

Then ask your agent something like *"Write a 30-second markdown_video script announcing our v2 release, and validate it."*

## 🏗️ Architecture

```mermaid
flowchart LR
    MD["Markdown source<br/>with scene directives"]
    AGENT["MCP client<br/>Claude, IDEs"]

    subgraph EDITOR["Editor — /editor"]
        ED["markdown-editor"]
        PREV["scene-preview<br/>per scene-type renderers"]
        TL["timeline scrubber"]
        EXP["export-modal"]
    end

    PARSE["lib/parser<br/>index + code, chart,<br/>diff, terminal parsers"]
    STORE["lib/use-video-store<br/>Zustand"]
    MCP["/api/mcp<br/>12 tools: authoring + rendering"]
    FF["@ffmpeg/ffmpeg<br/>wasm, in the browser"]
    MP4["MP4 or GIF download"]
    REDIS[("Upstash Redis<br/>shares, rate limits,<br/>temporary mp4 artifacts")]
    WORKER["render-worker container<br/>Chromium + native ffmpeg"]

    MD --> ED
    ED --> PARSE
    PARSE --> STORE
    STORE --> PREV
    STORE --> TL
    STORE --> EXP
    EXP --> FF
    FF --> MP4
    ED <-->|"/api/projects"| REDIS
    AGENT --> MCP
    MCP --> PARSE
    MCP --> WORKER
    MCP --> REDIS
```

Interactive editing and manual export remain client-side: the parser produces scenes, the preview draws them,
and FFmpeg compiles the same scenes to MP4 or GIF in the browser. The MCP rendering tools are the deliberate exception: they send markdown to `apps/render-worker`, a separate authenticated Chromium + native-ffmpeg container, and store bounded temporary MP4 artifacts in Redis for one hour. Remote image URLs are blocked during worker rendering to prevent server-side request forgery/egress abuse.

## 🏗️ Project Structure

```
apps/web/                       # Next.js application
  ├── app/
  │   ├── layout.tsx            # Root layout
  │   ├── page.tsx              # Landing page
  │   ├── editor/
  │   │   └── page.tsx          # Video editor interface
  │   ├── api/
  │   │   ├── projects/route.ts # API endpoint for temporary share snapshots
  │   │   ├── renders/[id]/    # Range-capable temporary MP4 serving
  │   │   └── mcp/[transport]/  # MCP server (12 tools, including rendering)
  │   └── globals.css
  ├── components/
  │   ├── landing/              # Landing page components
  │   ├── ui/                   # Reusable UI components (50+ Radix UI based)
  │   └── video-editor/
  │       ├── markdown-editor.tsx     # Markdown input editor
  │       ├── scene-preview/          # Video scene renderer
  │       │   ├── scenes/             # Different scene type renderers
  │       │   ├── components/         # Preview helpers
  │       │   └── utils/              # Rendering utilities
  │       ├── timeline.tsx            # Timeline scrubber
  │       ├── export-modal/           # Video export with FFmpeg
  │       ├── templates-panel.tsx     # Template selection
  │       ├── theme-selector.tsx      # Theme customization
  │       └── keyboard-shortcuts.tsx  # Shortcuts reference
  ├── lib/
  │   ├── mcp/
  │   │   ├── syntax-validator.ts # Validation shared with the MCP tools
  │   │   └── documentation.ts    # Directive docs served over MCP
  │   ├── parser/
  │   │   ├── index.ts            # Main markdown parser
  │   │   ├── parsers/            # Specialized parsers for different scenes
  │   │   ├── constants.ts        # Scene types and directives
  │   │   ├── timeline.ts         # Timeline parsing
  │   │   └── utils.ts            # Helper utilities
  │   ├── types.ts                # TypeScript type definitions
  │   ├── use-video-store.ts      # Zustand video state management
  │   ├── redis.ts                # Redis client for share snapshots
  │   ├── github.ts               # GitHub API integration
  │   ├── templates.ts            # Template definitions
  │   └── utils.ts                # General utilities
  └── public/
      ├── og-image.png          # Open Graph image for sharing
      └── site.webmanifest      # PWA manifest
apps/render-worker/             # Authenticated server-side Chromium/ffmpeg renderer
packages/                       # Shared core/scenes packages
```

## ☁️ Deploying MCP rendering

The normal editor needs only the existing web deployment. Enabling `render_preview`/`render_video` additionally requires:

1. Deploy the worker image with the repository root as Docker context:
   `docker build -t markdown-video-render-worker -f apps/render-worker/Dockerfile .`
   Run it with `RENDER_WORKER_SHARED_SECRET` (at least 32 random characters). Optional worker limits are `PORT`, `HOST`, `RENDER_WORKER_CONCURRENCY` (default `1`, max `4`), and `RENDER_WORKER_QUEUE_LIMIT` (default `8`). Prefer a private network; if public, always use HTTPS at the platform/load balancer. Restrict container egress where your host supports it—the browser already blocks non-loopback scene image requests, but network policy is still useful defense in depth.
2. Configure the web app with the same `RENDER_WORKER_SHARED_SECRET` and `RENDER_WORKER_URL`, plus either `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL`/`KV_REST_API_TOKEN`. Set `NEXT_PUBLIC_SITE_URL` to the canonical public web origin so returned render URLs are not host-header derived.
3. Rendered MP4s use IDs containing 128 bits of cryptographic randomness, expire after **1 hour**, and are capped at **6 MiB** before base64 encoding (8 MiB in Redis, chosen below Upstash's common 10 MB request ceiling). `render_preview` allows **10 requests/IP/hour**, `render_video` **5/IP/hour**, and video reads **120/IP/minute**; these policies are fail-closed because rendering is expensive.

The tools are absent only in the sense that they return configuration tool errors when these variables are missing; read-only authoring MCP tools continue to work.

## 🚀 Getting Started

### Prerequisites

- Node.js 20.9 or higher (Node.js 22 is used in CI)
- pnpm 10.25.0 (pinned in `packageManager`; run `corepack enable` if pnpm is not installed)

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Avik-creator/markdown_video.git
   cd markdown_video
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Set up environment variables** (optional for local development):

   ```bash
   cp apps/web/.env.template apps/web/.env.local
   ```

4. **Run the development server**:

   ```bash
   pnpm dev
   ```

5. **Open the application**:
   Visit [http://localhost:3000](http://localhost:3000) in your browser

## 🛠️ Technologies Used

- **Framework**: [Next.js 16](https://nextjs.org/) - React framework with SSR
- **UI Components**: [Radix UI](https://www.radix-ui.com/) - Unstyled, accessible component library
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) - Utility-first CSS framework
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) - Lightweight state manager
- **Markdown Parsing**: Custom parser with extended syntax support
- **Video Rendering**: [FFmpeg.wasm](https://ffmpeg.org/ffmpeg.js/) - Browser-based video encoding
- **Screenshot to Canvas**: [HTML2Canvas Pro](https://html2canvas.hertzen.com/) - DOM to canvas rendering
- **Animations**: [Framer Motion](https://www.framer.com/motion/) - React animation library
- **Database**: [Upstash Redis](https://upstash.com/) - Optional serverless Redis backend for large share links
- **Icons**: [Lucide React](https://lucide.dev/) - SVG icon library
- **Toast Notifications**: [Sonner](https://sonner.emilkowal.ski/) - Toast notification system
- **Themes**: [Next.js Themes](https://github.com/pacocoursey/next-themes) - Theme switching

## 📦 Available Scripts

Run these from the repository root (they delegate to workspace packages through Turborepo; `apps/web` is currently the only application package):

- `pnpm dev` - Start the development server with hot reload
- `pnpm build` - Build the application for production
- `pnpm start` - Start the production server
- `pnpm lint` - Lint the workspace with ESLint
- `pnpm typecheck` - Generate Next.js route types and type-check with `tsc`
- `pnpm test` - Run the test suite with Vitest

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 💖 Sponsors

markdown_video is free and open source, and maintained in my spare time. If it saves you time, or your company builds on it, consider [sponsoring the project on GitHub](https://github.com/sponsors/Avik-creator). Sponsorship pays for maintenance, new scene types, and keeping the hosted editor online.

### Sponsored by

<a href="https://neon.com">
  <img src=".github/assets/neon-logo.svg" alt="Neon" width="200">
</a>

[Neon](https://neon.com) supports markdown_video through the Neon Open Source Program.

## 📄 License

markdown_video is released under the [MIT License](LICENSE). You can use, modify, and distribute it, including for commercial purposes, as long as the copyright notice is kept.

> Code before v1.0.0 was published under CC BY-NC 4.0. From v1.0.0 on, the project is MIT-licensed.

## 👏 Acknowledgments

Built with amazing open-source libraries:

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [FFmpeg.wasm](https://ffmpeg.org/ffmpeg.js/)
- [Framer Motion](https://www.framer.com/motion/)

## 📧 Support

For questions, issues, or suggestions, please [open an issue](https://github.com/Avik-creator/markdown_video/issues) on GitHub.

---

Made with ❤️ by [Avik Mukherjee](https://github.com/Avik-creator)
