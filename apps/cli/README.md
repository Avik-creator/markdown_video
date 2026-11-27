# markdown-video

Render markdown video documents to MP4 or animated GIF from the command line.

`markdown-video` uses the same scene parser and renderer as the markdown-video web editor. It serves a bundled, font-complete render page on a local loopback port, captures precisely timed frames with headless Chromium, and encodes them with native ffmpeg. The npm package is self-contained: the render page, React scene bundle, CSS, all 80 bundled WOFF2 fonts, font license, and SHA-256 font provenance metadata are included in the tarball.

## Requirements

- **Node.js 20 or newer**
- **ffmpeg** with the `libx264` and AAC encoders
- **Chromium**, normally installed by `markdown-video install-browser`

Runtime rendering does **not** require `ffprobe` (it is only used by this repository's integration tests and by humans inspecting output).

### Install ffmpeg

```sh
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y ffmpeg

# Windows
winget install Gyan.FFmpeg
```

The package deliberately does not download `ffmpeg-static` or another bundled ffmpeg binary. Current `ffmpeg-static` releases are license-tagged GPL-3.0-or-later, download a large ffmpeg 6.x binary in a postinstall step from platform-specific third-party sources, and do not participate in the operating system's normal security-update mechanism. The CLI only executes ffmpeg as a separate process, so a system/package-manager ffmpeg is the clearer licensing, reliability, and patching contract. Pass `--ffmpeg` or set `FFMPEG_BIN` to use a non-PATH binary.

## Install

```sh
npm install -g markdown-video
```

Then install Chromium and verify the machine:

```sh
markdown-video install-browser
markdown-video doctor
```

On Linux, if Chromium reports missing shared libraries:

```sh
markdown-video install-browser --with-deps
markdown-video doctor
```

`install-browser` uses the exact `playwright-core` revision required by the package and stores Chromium in Playwright's user cache. To use a custom cache location, set `PLAYWRIGHT_BROWSERS_PATH` both when installing and when rendering. To use system Chrome/Chromium instead, pass `--chromium /path/to/browser` to `render` or `doctor`.

`npx` also works; the browser cache persists outside the npx package cache:

```sh
npx markdown-video@latest install-browser
npx markdown-video@latest render video.md -o video.mp4
```

## Quickstart

Create `hello.md`:

```markdown
!scene
!duration 3
!text
Hello, video
size: xl
animation: fadeIn
fontFamily: sans
```

Render it:

```sh
markdown-video render hello.md -o hello.mp4
```

Useful variations:

```sh
# 720p vertical social output (reels/shorts inherently use 9:16)
markdown-video render hello.md -o reel.mp4 --format reels --resolution 720p

# GIF output; the output name must end in .gif
markdown-video render hello.md -o hello.gif --format gif --fps 12

# Inline markdown
markdown-video --markdown $'!scene\n!duration 1\n!text\nHi\n' -o hi.mp4

# Markdown from stdin
cat hello.md | markdown-video render - -o hello.mp4

# Burn generated text-scene captions into the captured frames
markdown-video render hello.md -o hello-captioned.mp4 --burn-captions
```

Progress is written to stderr. The final line reports dimensions, format, frame count, fps, elapsed time, and output path.

## Commands

### `markdown-video render`

```text
markdown-video render <input.md> --output <output.mp4> [options]
markdown-video <input.md> --output <output.mp4> [options]   # render may be omitted
markdown-video render - --output <output.mp4>               # read stdin
markdown-video --markdown "<markdown>" --output <output.mp4>
```

`--output`/`-o` is required. Input can be one file path, `-` for stdin, or `--markdown`/`-m` text. File input and `--markdown` cannot be combined.

| Option | Meaning |
| --- | --- |
| `-o, --output <path>` | Output `.mp4` for mp4-like formats or `.gif` for `--format gif`. Required. |
| `-m, --markdown <text>` | Markdown source instead of an input file. |
| `--resolution <preset>` | `480p`, `720p`, `1080p` (default), `1440p`, or `4k`. Presets scale the short side and preserve aspect ratio. |
| `--quality <preset>` | `low`, `medium`, `high` (default), or `ultra`; selects JPEG frame quality and the x264 CRF target. |
| `--speed <preset>` | `fastest`, `fast`, `balanced` (default), `slow`, or `slowest`; selects how much x264 encoder time to spend. |
| `--format <format>` | `mp4` (default), `reels`, `shorts`, `slides`, or `gif`. `reels`/`shorts` always output 9:16; GIF ignores audio. |
| `--aspect-ratio <ratio>` | Project aspect ratio: `16:9` (default), `9:16`, `1:1`, or `4:3`. Ignored by `reels`/`shorts`, which force 9:16. |
| `--locale <code>` | Locale override such as `en`, `es`, or `pt-BR` for localized scene strings and captions. |
| `--fps <number>` | Output frames per second. Rounded and clamped to 1-60; default 30. GIF output is additionally capped at 10fps. |
| `--overwrite` | Replace an existing output and caption sidecars. Without it, existing files are protected. |
| `--allow-outside-cwd` | Permit output outside the current working directory. By default output must remain inside cwd. |
| `--deny-remote-network` | Block non-loopback browser requests. Use for untrusted markdown; `data:`/`blob:` images still work. |
| `--burn-captions` | Composite generated captions into the DOM before capture, so no ffmpeg subtitles filter or libass build is needed. |
| `--ffmpeg <path>` | ffmpeg executable. Default: `FFMPEG_BIN`, then `ffmpeg` on PATH. |
| `--chromium <path>` | Chrome/Chromium executable. Default: Playwright-managed Chromium. |
| `-v, --version` | Print the package version. |
| `-h, --help` | Print help. |

Input and output paths must be different files. MP4 output is H.264/yuv420p in an `.mp4` container. If present, music is encoded as AAC at 128 kbps. GIF output uses palette generation and Bayer dithering and loops forever.

### `markdown-video doctor`

```sh
markdown-video doctor [--ffmpeg /path/to/ffmpeg] [--chromium /path/to/browser]
```

Checks and reports fix-it instructions for:

- Node.js version;
- embedded render assets, including all CSS-referenced font files and their SHA-256 provenance;
- ffmpeg availability and the exact encoder/filter capabilities used by MP4, GIF, and music rendering;
- a real headless Chromium launch.

Exit status is `0` when everything passes and `1` when anything needs attention.

### `markdown-video install-browser`

```sh
markdown-video install-browser [--with-deps]
```

Installs the Playwright-managed Chromium revision used by this package. `--with-deps` is for Linux system libraries and may use sudo. Chromium/Chrome for Testing remains governed by its upstream browser licenses; it is downloaded to the user cache rather than included in the npm tarball.

## Music

A document can declare one document-level music track before the first scene:

```markdown
!music ./audio/theme.mp3 volume:0.32 fade:0.7s loop:true

!scene
!duration 4
!text
Music is mixed during export.
size: xl
```

- `volume` is linear gain from 0 to 1.
- `fade` is fade-in/fade-out seconds, capped at 30s and clamped so start/end fades do not overlap.
- `loop` defaults to true; the track is always truncated at the video end and never extends the video.
- Relative paths resolve against the markdown file's directory (or cwd for stdin/`--markdown`).
- Remote music must be HTTPS. The CLI downloads it itself with redirect, credential, address, and size validation; Chromium never fetches it.
- GIF output ignores music because GIF cannot carry audio.

## Captions

Top-level `!text` scenes automatically produce `<output-stem>.srt` and `<output-stem>.vtt` beside the video. Cue timing uses the same scene timeline math as rendering, including staggered line reveal times. Existing sidecars are protected unless `--overwrite` is passed.

`--burn-captions` additionally renders captions in the browser inside the captured scene. Burn-in therefore uses the bundled web fonts, matches sidecar timing exactly, handles non-Latin text with the same font coverage as scenes, and does not require libass, fontconfig provisioning, or ffmpeg's `subtitles` filter.

## Network and path safety

The renderer preserves document semantics by default, so image scenes may reference remote HTTP(S) URLs. Use `--deny-remote-network` for untrusted markdown: Chromium can then reach only the loopback render-page origin, while `data:` and `blob:` images remain available.

Output is confined to the current working directory by default and must not already exist. These are deliberate protections against accidental traversal and overwriting; use `--allow-outside-cwd` and `--overwrite` only when intended.

## Programmatic API

The package also exports a Node.js API:

```ts
import { renderVideo, renderVideoToBuffer, renderFrames } from "markdown-video"

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

`renderVideoToBuffer` returns MP4 bytes without exposing a caller-chosen output path, and `renderFrames` captures lossless PNG buffers at exact timeline times. Render functions accept an optional `AbortSignal`; cancellation, errors, and completion all close Chromium, stop ffmpeg when needed, and close the loopback asset server.

Usage/input errors exit with code 2 in the CLI; rendering/dependency failures exit with code 1.

## Troubleshooting

Start with:

```sh
markdown-video doctor
```

- **Playwright Chromium is not ready** — run `markdown-video install-browser`; on Linux use `--with-deps` if shared libraries are missing.
- **ffmpeg is not ready** — install a full system ffmpeg or pass `--ffmpeg`. The check reports exactly which encoder/filter capability is missing.
- **Render assets/font provenance failed** — reinstall the package. The tarball is expected to contain the complete immutable render-page payload.
- **Linux/root browser sandbox problems** — prefer a normal user where possible. Chromium may need additional container sandbox flags outside the scope of the CLI; system Chrome can be supplied with `--chromium`.

## License

MIT for the CLI and scene/render integration code. Bundled font binaries are unmodified upstream files under the SIL Open Font License 1.1; their license and provenance are included in `dist/render-page/`. ffmpeg and Chromium are separate external programs with their own licenses.
