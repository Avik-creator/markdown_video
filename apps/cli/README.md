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

# Burn generated captions into the video frames (no ffmpeg build requirements)
node apps/cli/dist/cli.js render video.md -o video.mp4 --burn-captions

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

Markdown-relative image paths are not currently resolved to files beside the
input markdown: the render page is a host application, so `./image.png` is
interpreted as a host-relative URL rather than a document-relative filesystem
path. Use HTTPS/data images, host-static URLs, or render through a host that
explicitly provides document media resolution.

## Music and captions

A document can declare one document-level music track:

```markdown
!music ./audio/theme.mp3 volume:0.4 fade:1s loop:true
```

The track starts at 0s, loops by default when shorter than the video, is always
truncated at the video end, and never extends the output duration. `volume` is
linear gain in the inclusive 0-1 range. `fade` is limited to 30s and is also
clamped to half the video duration so fade-in and fade-out never overlap. GIF
output ignores music because the GIF container cannot carry audio. Editor preview
playback is intentionally silent for music in this step; music is mixed only
during export/rendering so preview cannot diverge from the deterministic ffmpeg
clock.

Relative music paths resolve against the markdown file's directory for file
input, and against the current working directory for stdin or `--markdown`.
Remote music must be HTTPS. The CLI downloads remote music itself before
encoding (Chromium never fetches it), rejects credentials and non-public IP
targets, validates redirects one at a time, pins the validated DNS answer for
the TLS connection, and enforces a 32MB download cap. Local files are limited
to 256MB. Programmatic renderers running with `allowRemoteNetwork: false` are
isolated: only self-contained `data:audio/*` music is accepted there, since
local paths could expose service files and URLs would create egress/SSRF risk.

When top-level `!text` scenes exist, the CLI writes `<output-stem>.srt` and
`<output-stem>.vtt` next to the video using the same core timeline math as
rendering. Existing sidecars are protected by the same overwrite semantics as
the video. `--burn-captions` additionally composites those captions into the
frames themselves. Burn-in is DOM-composited at capture time: the render page
generates cues from the same core caption data as the sidecars and renders
them inside the captured scene, so ffmpeg receives frames that already
contain the captions. That means burn-in works with any ffmpeg build (no
libass/`subtitles` filter requirement), cue timing exactly matches the
half-open sidecar semantics, and non-Latin captions render with the same web
font coverage as scene text rather than depending on fontconfig. Burn-in is
off by default.

## Encoding semantics

For mp4-like formats (`mp4`, `reels`, `shorts`, and `slides`) the CLI uses the
shared core render plan and `getVideoEncodingSettings(quality, speed)` matrix,
then invokes native ffmpeg with array arguments (never a shell):

```text
ffmpeg -v error -y|-n \
  -f image2pipe -c:v mjpeg -framerate <fps> -i pipe:0 \
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
When music is present, the mp4 command adds the prepared music file as a second
input (with `-stream_loop -1` only when `loop:true`), maps video/audio
explicitly, applies `volume`/`atrim`/`afade` in an output audio filtergraph,
and encodes AAC at 128kbps. `-t <duration>` remains the hard output boundary.

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
perceptual golden-frame similarity. The audio/caption integration test creates
its sine-wave WAV programmatically at test time (no binary audio fixture is
committed), then uses ffprobe to verify the AAC stream and exact video duration
and compares the generated SRT/VTT sidecars byte-for-byte. Goldens are compared with `pixelmatch`
rather than byte equality because anti-aliasing and compression details may
vary slightly across platforms.

The caption burn-in integration test (`render-captions-burnin.test.ts`) renders
a five-scene Unicode fixture twice — once with `burnCaptions`, once without as a
pixel-identical control — and asserts caption presence in the bottom band at cue
times, caption stability within a cue, and exact half-open boundary behavior
(the frame at t=1.0 already shows the next cue). Unicode glyph correctness is
verified with three layered mechanisms, because tofu boxes are themselves pixels
and a naive non-blank assertion cannot detect missing glyphs: a perceptual
golden comparison of the Cyrillic caption frame (the primary mechanism — any
tofu form diffs massively against the visually verified golden), a same-length
comparison against a plane-15 private-use caption that is guaranteed tofu (real
Cyrillic glyphs must differ from it; Chromium renders missing glyphs as repeated
identical `.notdef` boxes, so tofu Cyrillic would be pixel-identical to the tofu
baseline), and a saturated-yellow pixel count for the emoji caption (color emoji
render yellow faces; tofu or monochrome fallback never can). The asserted
scripts (Cyrillic, Greek, Vietnamese) are covered by the render page's bundled
Inter subsets, so they render deterministically in every environment; the emoji
assertion relies on a color emoji font, which is present on macOS, preinstalled
on GitHub's ubuntu runners, and installed in the render-worker image. CJK and
other system-font-dependent scripts are deliberately not asserted: they fall
back to system fonts exactly like scene text always has, and CI runners do not
ship CJK fonts.

Regenerate the small committed 854×480 golden PNGs after an intentional
scene-rendering change:

```sh
pnpm --filter markdown-video goldens:update
```

Then inspect the visual diff carefully before committing it.
