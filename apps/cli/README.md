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

# Capture exact-timeline lossless preview frames as JSON/base64
markdown-video preview hello.md --times 0,1.5,3 --json

# Or write the same direct PNG captures to files
markdown-video preview hello.md --times 0,1.5,3 --output-dir preview-frames

# Compare what an edit actually changed in the render
markdown-video diff old.md new.md --resolution 480p --out-dir diff-frames
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

### `markdown-video preview`

```text
markdown-video preview <input.md> --times 0,1.5,3 --json
markdown-video preview <input.md> --times 0,1.5,3 --output-dir frames
markdown-video preview - --times 0,1 --json                  # read stdin
markdown-video preview --markdown "<markdown>" --json
```

`preview` captures lossless PNG screenshots by seeking the real browser renderer to exact timeline times. It does not render an mp4 first and does not extract lossy encoded video frames. This is useful both for visual inspection and for agent/API integrations that need compact machine-readable frame data.

Input uses the same three forms as `render`: one file path, `-` for stdin, or `--markdown`/`-m` text. `--times` is a comma-separated list of finite non-negative seconds (maximum 16 frames). Every requested time is validated against the parsed video duration before Chromium starts; values beyond the duration are usage errors. When `--times` is omitted, five times are spread inclusively across the duration, including the first and final states.

Choose exactly one output mode:

| Option | Meaning |
| --- | --- |
| `--json` | Print exactly one JSON object to stdout: `{duration,width,height,frames:[{time,pngBase64}]}`. No extra stdout text is emitted; diagnostics use stderr. |
| `--output-dir <dir>` | Write numbered files such as `frame-001-t0.000s.png`. Existing files are protected unless `--overwrite` is passed. |

Relevant render flags are supported: `--resolution` (`480p` through `4k`; default `1080p`), `--aspect-ratio` (`16:9`, `9:16`, `1:1`, `4:3`), `--locale`, `--deny-remote-network`, and `--chromium`. Encoding-specific flags such as `--quality`, `--speed`, `--fps`, `--format`, and `--burn-captions` do not apply because direct PNG capture invokes no video encoder. `--output-dir` is confined to the current working directory unless `--allow-outside-cwd` is explicit.

### `markdown-video diff`

```text
markdown-video diff <old.md> <new.md> [options]
```

`diff` answers a narrower question than a text diff: after editing the document, what changed in the actual rendered frames? It parses both files with the same parser used for rendering, aligns scenes by content, captures representative lossless PNG frames with the preview machinery, and compares aligned frame pairs with pixelmatch. It does **not** render an mp4/GIF and does not invoke ffmpeg.

Both inputs must be markdown files. Comparing a file with itself is valid and useful as a determinism control.

| Option | Meaning |
| --- | --- |
| `--json` | Print exactly one machine-readable report object to stdout. Diagnostics use stderr. |
| `--out-dir <dir>` | Write one `old | new | diff-highlight` composite PNG per compared sample. Existing files are protected unless `--overwrite` is passed. |
| `--threshold <percent>` | Failure threshold for scenes whose content is unchanged or only retimed. Default `0.1`; `0` means any non-zero pixel difference. |
| `--outlier-threshold <percent>` | Pixel magnitude at which a very small modified-scene edit is treated as an outlier. Default `25`. |
| `--samples-per-scene <n>` | `1`, `2` (default), or `3` interior fractional positions per aligned scene pair. |
| `--resolution <preset>` | `480p`, `720p`, `1080p` (default), `1440p`, or `4k`. Lower resolutions are recommended for CI because percentages are scale-invariant for normal scene content. |
| `--aspect-ratio <ratio>` | Project aspect ratio: `16:9` (default), `9:16`, `1:1`, or `4:3`. |
| `--locale <code>` | Locale override such as `en`, `es`, or `pt-BR`. |
| `--overwrite` | Replace existing comparison PNGs in `--out-dir`. |
| `--allow-outside-cwd` | Permit `--out-dir` outside the current working directory. By default it must remain inside cwd. |
| `--deny-remote-network` | Block non-loopback browser requests. Use for untrusted markdown. |
| `--chromium <path>` | Chrome/Chromium executable. Default: Playwright-managed Chromium. |
| `-h, --help` | Print help. |

#### Alignment algorithm and limits

Each scene is fingerprinted with a SHA-256 hash of canonical parsed content. The hash excludes random parser ids, source-map bookkeeping, and the top-level duration so duration-only edits can be recognized as retiming. It also excludes an *implicit* parser-assigned background because that color is a function of scene position; an explicit `!background` remains part of the content hash. This means a reordered scene with an implicit background can be aligned correctly while the pixel comparison still reports its real positional color change.

Alignment is a deliberately simple two-phase heuristic:

1. Exact content hashes are matched one-to-one independent of sequence position. Duplicate hash occurrences are zipped in document order. This handles insertions, deletions, and reorders of stable scenes. A longest non-crossing subset of those exact matches becomes a set of edit-gap anchors; reordered exact matches stay aligned without discarding the surrounding sequence information.
2. Remaining same-type scenes in the same anchor gap receive a recursive content-similarity score (weighted toward primary text/code/terminal/media content) plus a small positional prior. The best scoring unused pairs are consumed greedily. Scenes that remain unmatched are `added` or `removed`; a scene type replacement is therefore normally remove+add rather than modify.

Rows are classified as:

| Status | Meaning |
| --- | --- |
| `unchanged-content` | Same content hash, start time, and duration. |
| `retimed` | Same content hash but a different start time and/or duration. Reordered scenes normally appear here because their start time changed. |
| `modified` | Different content hash, but similar enough to align as the same logical scene. Modified takes precedence over retimed when both changed. |
| `added` | Present only in the new document; not frame-compared. |
| `removed` | Present only in the old document; not frame-compared. |

This is not a proof of author intent. Duplicate scenes are inherently ambiguous; a modified scene moved across a stable anchor can fall back to remove+add; and large rewrites of the same type may cross in either direction between `modified` and remove+add depending on similarity. The important guarantee is that alignment is content-aware rather than index-only, so one insertion does not cascade into false edits for every downstream scene, and stable anchors keep an independent delete+insert pair from being force-aligned merely because both scenes have the same type.

#### Sampling, comparison, and performance

For each aligned pair, samples are taken at the same fractions within each version's scene, not at the same global timestamps. Fractions are interior/mid-late positions to avoid hard boundaries and most entrance transitions:

| Samples/scene | Fractions |
| --- | --- |
| `1` | `0.5` |
| `2` | `0.5, 0.8` |
| `3` | `0.4, 0.65, 0.85` |

Very short scenes can still overlap their entrance transition; increase sample count only when that extra sensitivity is useful. Added and removed scenes cost no captures. At the default of 2, a 10-scene document with all scenes aligned costs 20 compared frame pairs (40 total captures), not two full video renders. All captures for one version reuse one Chromium instance and one render-page server; the old and new versions are captured sequentially to bound memory use in CI.

Frame pairs are lossless PNGs from the same Chromium/render-page environment and are compared with pixelmatch 8 using an OKLab color-distance threshold of `0.1` and anti-alias detection enabled (`includeAA: false`). Because there is no video codec round trip, exact repeated renders measured `0.000%`; codec noise does not need to be hidden. In 480p control documents, inserting one word into a short text scene measured about `0.308%`; varying pixelmatch's color threshold from `0.03` to `0.25` changed that result only to about `0.288-0.318%`, while counting anti-aliased pixels as differences inflated it to about `0.534%`. A duration-only camera-shake control measured up to `0.812%`; a 3x camera zoom measured `7.0%`; a dark-to-light full-background inversion measured `99.5%`. These measurements motivate the magnitude labels:

| Mean scene change | Class |
| --- | --- |
| `<0.1%` | `identical` |
| `0.1%` to `<5%` | `minor` |
| `5%` to `<25%` | `moderate` |
| `>=25%` | `heavy` |

The mean across a scene's samples is used for the displayed magnitude/class. The maximum sample is used for CI failure decisions so a localized transient change is not diluted by averaging.

#### Exit semantics for CI

| Exit | Meaning |
| --- | --- |
| `0` | No unexpected visual changes. |
| `3` | Unexpected visual changes were found. |
| `2` | Usage/input error. |
| `1` | Renderer/dependency failure. |

"Unexpected" is deliberately not "anything changed":

- `added` and `removed` scenes are explicit structural edits and never fail by themselves.
- `modified` scenes are expected to render differently. They fail only as magnitude outliers: content similarity at least `0.9` **and** a maximum sample change at least `--outlier-threshold` (default `25%`). This catches cases such as a tiny textual edit unexpectedly rewriting most of the frame. It is a heuristic; intentional scene-wide visual property edits can also be extreme, so inspect the report before treating every outlier as a defect.
- `unchanged-content` and `retimed` scenes have no source-content explanation for changed pixels. They fail when their maximum non-zero sample change is at least `--threshold` (default `0.1%`). Raise `--threshold` to tolerate known animation/retiming drift; set it to `0` to require bit-identical pixels for these scenes.

Example pass output:

```text
STATUS             OLD  NEW  TYPE  CHANGE  CLASS      DETAIL
-----------------  ---  ---  ----  ------  ---------  ------------------------
modified           #1   #1   text  0.308%  minor      content similarity 0.939
unchanged-content  #2   #2   text  0.000%  identical  same source content

Verdict: PASS — no unexpected visual changes
```

A pull-request workflow can compare the base version of a changed document with the PR version and rely on exit code 3 as a review signal:

```sh
git show "origin/main:examples/launch.video.md" > baseline.launch.video.md
markdown-video diff baseline.launch.video.md examples/launch.video.md \
  --resolution 480p \
  --json \
  --out-dir diff-frames
```

Upload `diff-frames` as a CI artifact when it exists. Because intentional content edits are expected, the most actionable failures are unchanged/retimed scenes and small-edit magnitude outliers; the JSON report contains the exact reasons.

#### JSON report schema

`--json` emits one object (version `1`) with these top-level keys:

- `version`: currently `1`.
- `verdict`: `"pass"` or `"fail"`.
- `inputs`: `old`/`new`, each `{path,sceneCount,duration}`; durations are seconds.
- `settings`: `{resolution,aspectRatio,locale,samplesPerScene,pixelmatchThreshold,unchangedThresholdPercent,modifiedOutlierPercent,modifiedOutlierMinContentSimilarity}`.
- `dimensions`: `{width,height}` of compared frames, or `null` when no aligned scenes required capture.
- `summary`: `{alignedPairs,unchangedContent,modified,added,removed,retimed,comparedScenes,comparedFramePairs,capturedFrames,comparisonImagesWritten,unexpectedScenes,maxMeanChangePercent,elapsedSeconds,oldRenderElapsedSeconds,newRenderElapsedSeconds}`.
- `scenes`: one row per alignment result.

Each scene row is:

```ts
{
  status: "unchanged-content" | "modified" | "added" | "removed" | "retimed"
  old: null | {
    index: number         // zero-based in old document
    type: string
    startTime: number     // seconds
    duration: number      // seconds
    contentHash: string   // lowercase SHA-256 hex
  }
  new: null | /* same descriptor shape as old */
  contentSimilarity: number | null  // [0,1]; null for added/removed
  timing: {
    positionDeltaSeconds: number | null  // new start - old start
    durationDeltaSeconds: number | null  // new duration - old duration
  }
  comparison: null | {
    classification: "identical" | "minor" | "moderate" | "heavy"
    meanChangePercent: number
    maxFrameChangePercent: number
    samples: Array<{
      sampleIndex: number
      fraction: number
      oldTime: number
      newTime: number
      width: number
      height: number
      totalPixels: number
      mismatchedPixels: number
      changePercent: number
      comparisonImagePath: string | null
    }>
  }
  unexpected: boolean
  unexpectedReasons: string[]
}
```

Composite artifacts are horizontally concatenated panels: old frame, new frame, then pixelmatch's highlighted diff, separated by two neutral gray columns at each boundary. Names are deterministic, for example `scene-o001-n003-sample-01.png` uses one-based scene/sample numbers.

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
