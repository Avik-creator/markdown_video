# markdown-video CLI

Headless renderer for markdown-video documents. The CLI serves the production
`@markdown-video/render-page` build from disk on an ephemeral loopback origin,
drives its promise-based `window.__mv` API with Playwright Chromium, writes JPEG
frames to native ffmpeg over `image2pipe`, and validates output paths before
rendering.

## Prerequisites

- Node.js 20+
- ffmpeg **and ffprobe** available on `PATH` (or pass `--ffmpeg` / set
  `FFMPEG_BIN`; ffprobe is needed by the integration tests)
- Playwright Chromium:

  ```sh
  pnpm --filter markdown-video exec playwright install chromium
  ```

Before use in this monorepo, build the workspace dependencies:

```sh
pnpm --filter @markdown-video/render-page build
pnpm --filter markdown-video build
```

The CLI intentionally does not vendor an ffmpeg binary. Bundled ffmpeg builds
can be LGPL or GPL depending on how they were compiled (for example the
`ffmpeg-static` package is GPL-licensed), so using a system/package-manager
ffmpeg keeps license selection and security updates explicit. Playwright's
browser binaries are downloaded into the user cache rather than committed;
Chromium/Chrome for Testing remains governed by its upstream browser licenses.

## Usage

```sh
# Render a file to mp4 in the current working directory
node apps/cli/dist/cli.js render video.md --output video.mp4

# The same binary when installed as a package
markdown-video render video.md -o video.mp4

# Inline markdown
node apps/cli/dist/cli.js --markdown "# Hello" --output hello.mp4

# Read markdown from stdin
cat video.md | node apps/cli/dist/cli.js render - --output video.mp4

# Vertical social output; reels/shorts force 9:16 like the editor exporter
node apps/cli/dist/cli.js render video.md -o reel.mp4 --format reels --resolution 1080p

# Match common browser-export settings explicitly
node apps/cli/dist/cli.js render video.md -o video.mp4 \
  --resolution 720p --quality high --speed balanced --fps 30 \
  --aspect-ratio 16:9 --locale en

# GIF output uses a generated palette and .gif extension
node apps/cli/dist/cli.js render video.md -o preview.gif --format gif --fps 12

# Replace an existing output or explicitly allow a path outside cwd
node apps/cli/dist/cli.js render video.md -o video.mp4 --overwrite
node apps/cli/dist/cli.js render video.md -o ../video.mp4 --allow-outside-cwd

# Block remote image/network requests while rendering untrusted markdown
node apps/cli/dist/cli.js render video.md -o video.mp4 --deny-remote-network
```

Run `node apps/cli/dist/cli.js --help` for the complete option list.

By default output must stay inside the current working directory and must not
already exist. This protects against accidental path traversal and overwriting;
both behaviors have explicit opt-in flags. Input and output paths must be
different files.

The CLI preserves document-rendering semantics by default, so image scenes may
fetch remote `http(s)` URLs. When rendering untrusted markdown in automation,
`--deny-remote-network` installs the same loopback-only browser network policy
used by the render worker: `data:` and `blob:` images still work, but remote
URLs render as blocked/broken images instead of giving the document network
egress.

## Encoding semantics

For mp4-like formats (`mp4`, `reels`, `shorts`, and `slides`) the CLI uses the
shared core render plan and `getVideoEncodingSettings(quality, speed)` matrix,
then invokes native ffmpeg with array arguments (never a shell):

```text
ffmpeg -v error -y|-n \
  -f image2pipe -framerate <fps> -i pipe:0 \
  -vf scale=<width>:<height>:flags=lanczos:out_range=limited,setsar=1 \
  -c:v libx264 -preset <preset> -crf <crf> \
  -pix_fmt yuv420p -t <duration> <output>
```

The scale is normally a no-op because Playwright captures directly at the
planned raster dimensions using `deviceScaleFactor`. `out_range=limited` is
intentional: Chromium screenshots are full-range JPEGs, and merely writing
`-pix_fmt yuv420p` can otherwise leave current native ffmpeg output tagged as
`yuvj420p`. The conversion makes the file a conventional limited-range
yuv420p mp4 while the preset/CRF contract remains identical to browser export.

GIF output caps the GIF frame rate at 10fps (matching the browser exporter's
size-oriented behavior), creates a 64-color palette, uses Bayer dithering, and
loops forever.

## Programmatic API

```ts
import { renderVideo } from "markdown-video"

const result = await renderVideo({
  markdown: "!scene\n!duration 2\n!text\nHello\n",
  outputPath: "hello.mp4",
  resolution: "720p",
  quality: "high",
  speed: "balanced",
  fps: 30,
  overwrite: false,
  onProgress: ({ frame, totalFrames, percent }) => {
    console.error(frame, totalFrames, percent)
  },
})
```

The package also exports `renderVideoToBuffer` for in-memory MP4 bytes and
`renderFrames` for deterministic PNG frame buffers. `renderVideo` accepts an optional `AbortSignal`. Cancellation, render errors,
and normal completion all close the browser, stop ffmpeg when needed, and close
the loopback asset server. The CLI maps usage/input errors to exit code 2 and
rendering failures to exit code 1.

## Tests and golden frames

Unit tests do not launch Chromium or require ffmpeg:

```sh
pnpm --filter markdown-video test
```

Integration tests do require the built render page, Playwright Chromium,
ffmpeg, and ffprobe:

```sh
pnpm --filter @markdown-video/render-page build
pnpm --filter markdown-video build
pnpm --filter markdown-video test:integration
```

Set `MV_SKIP_INTEGRATION=1` to skip these tests in an environment that cannot
provide the external binaries. The integration suite validates codec, width,
height, fps, frame count, duration, pixel format/color range, font loading, and
perceptual golden-frame similarity. Goldens are compared with `pixelmatch`
rather than byte equality because anti-aliasing and compression details may
vary slightly across platforms.

Regenerate the two small committed 854×480 golden PNGs after an intentional
scene-rendering change:

```sh
pnpm --filter markdown-video goldens:update
```

Then inspect the visual diff carefully before committing it.
