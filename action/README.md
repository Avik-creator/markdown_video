# markdown-video render action

Composite GitHub Action that renders a markdown-video document with the
canonical `markdown-video` CLI. The action deliberately does not reimplement
rendering: it prepares Node.js, pnpm, Playwright Chromium, and ffmpeg, builds
the workspace renderer, and invokes `apps/cli/dist/cli.js`.

## Status and action location

The CLI is still private to this monorepo, so this is currently a source-build
action hosted at `action/` in this repository. GitHub supports actions in
subdirectories with this syntax:

```yaml
- uses: Avik-creator/markdown_video/action@<commit-sha-or-tag>
```

Cross-repository use requires this repository to be public, or private action
access to be enabled explicitly in the repository's Actions settings. Pin a
full commit SHA for the strongest supply-chain guarantee.

Inside this repository the workflows use `./action` after checkout because the
checkout already contains the exact renderer sources being tested. On
github.com, the newer self-repository form `$/action` is also valid and avoids
depending on the checked-out workspace; it requires runner v2.336.0 or newer.

## Example: release asset

```yaml
name: Render release video

on:
  release:
    types: [published]

permissions:
  contents: write

jobs:
  render:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - id: video
        uses: Avik-creator/markdown_video/action@<pin-me>
        with:
          markdown-path: release.md
          output-name: release-demo.mp4
          format: mp4
          resolution: 1080p
          quality: high
          speed: balanced
          aspect-ratio: 16:9
          fps: "30"
          overwrite: "true"
          allow-remote-network: "true"
          upload-release-asset: "true"
      - run: echo "${{ steps.video.outputs.asset-url }}"
```

For a manual run in a repository that does not want to mutate a release, omit
`upload-release-asset` or set it to `"false"` and upload
`steps.video.outputs.mp4-path` as a workflow artifact instead.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `markdown-path` | `release.md` | Markdown input path. Relative paths resolve in the caller workspace; absolute paths are accepted only inside that workspace. |
| `output-name` | `markdown-video.mp4` | Output path/name in the caller workspace. Must end in `.mp4` for mp4-like formats or `.gif` for `gif`. |
| `format` | `mp4` | CLI format: `mp4`, `reels`, `shorts`, `slides`, or `gif`. |
| `resolution` | `1080p` | CLI resolution: `480p`, `720p`, `1080p`, `1440p`, or `4k`. |
| `quality` | `high` | CLI encoding quality: `low`, `medium`, `high`, or `ultra`. |
| `speed` | `balanced` | CLI encoder speed: `fastest`, `fast`, `balanced`, `slow`, or `slowest`. |
| `aspect-ratio` | `16:9` | CLI project aspect ratio: `16:9`, `9:16`, `1:1`, or `4:3`. Reels/shorts still force 9:16 in the CLI. |
| `fps` | `30` | CLI output fps; the CLI normalizes it to 1-60. GIF output remains capped at 10fps by the CLI. |
| `locale` | empty | Optional CLI locale override such as `en`, `es`, or `pt-BR`. |
| `overwrite` | `false` | Pass the CLI `--overwrite` flag. Accepted values are exactly `true` or `false`. |
| `allow-remote-network` | `true` | Preserve the CLI's default image-scene semantics. Set to `false` for untrusted markdown to pass `--deny-remote-network` and permit only loopback/data/blob browser requests. |
| `upload-release-asset` | `false` | Upload the rendered file with `gh release upload --clobber`. Accepted values are exactly `true` or `false`. |
| `release-tag` | release event tag | Tag passed to `gh release upload`. Required for manual/upload runs outside a release event. |
| `github-token` | `${{ github.token }}` | Token interpolated only into the final upload step's `gh` child process. It is not exported during dependency installation, Chromium rendering, or ffmpeg work. |

## Outputs

| Output | Description |
| --- | --- |
| `output-path` | Absolute path of the rendered file (mp4 or gif). |
| `mp4-path` | Absolute path of the rendered mp4; empty for `format: gif`. |
| `asset-url` | Browser download URL returned by `gh release upload`; empty when upload is disabled. |

## Runtime environment and caching

Supported runner: Linux (`ubuntu-latest` recommended). The action:

1. locates the markdown-video workspace in the action repository;
2. sets up Node.js 22 and the pnpm version from the workspace `packageManager` field;
3. caches the pnpm store by OS/architecture/lockfile hash;
4. caches Playwright Chromium by OS/architecture/Playwright version;
5. caches compiled `dist/` output by a hash of the renderer source;
6. installs only the `markdown-video...` filtered workspace dependency closure (core, scenes, render page, and CLI), not the web app or worker;
7. verifies that Chromium actually launches, falling back to `playwright-core install-deps chromium` only when necessary;
8. uses system ffmpeg/ffprobe, installing Debian/Ubuntu `ffmpeg` with apt only when either binary is missing.

The CLI intentionally does not vendor ffmpeg. `ffmpeg-static` can be GPL build
depending on compilation, so this action follows the CLI README and uses the
operating-system ffmpeg instead. At the time this action was written, the
`actions/runner-images` Ubuntu software readme did **not** list ffmpeg as a
preinstalled tool, so the apt fallback is important rather than assuming it is
present. GitHub-hosted Ubuntu runners do include the `gh` CLI used for release
uploads.

## Why composite instead of Docker?

A Docker action whose `image` is a local `Dockerfile` is built on almost every
fresh GitHub-hosted runner. That means repeating Chromium, ffmpeg, pnpm install,
and TypeScript/Vite build work with no reliable cross-run Docker layer cache.
The existing render-worker image is also an operations artifact rather than a
CLI action image; on the arm64 development host it is about **2.14 GB**,
including about 732 MB of browser files and 485 MB of apt/runtime layers.
Pulling or rebuilding that for every render is worse than restoring targeted
caches.

A source-build composite action was therefore chosen. In a clean
`node:22-bookworm-slim` arm64 container, a no-cache approximation of the setup
measured:

| Phase | Measured |
| --- | ---: |
| corepack/pnpm activation | 1.7s |
| filtered `pnpm install` | 16.9s |
| core/scenes/render-page/CLI build | 6.4s |
| Chromium download | 134.4s |
| ffmpeg apt install | 48.1s |
| Chromium system packages | 17.7s |
| **setup subtotal before rendering** | **225.2s** |

These are local arm64/container numbers, not a GitHub runner guarantee. The
browser download dominates cold cost, so the Playwright cache is the most
important warm-path optimization. GitHub-hosted Ubuntu images already contain
most Chromium system libraries; the dependency-install fallback should normally
be skipped.

A warm-cache approximation using persistent Docker volumes for the pnpm store,
Chromium, and exact build output (plus ffmpeg already present) measured 1.3s
pnpm activation, 1.6s filtered install, effectively 0s build because the cache
was current, 1.9s Chromium verification, and 0.6s ffmpeg verification — about
**5.5s of setup before rendering**. Rendering the 6s fixture at 480p/12fps took
another 6.7s. If the runner image lacks ffmpeg, the measured apt install cost
above is incurred on every fresh hosted runner because system apt state is not
covered by the action caches. Exact GitHub-hosted timings still need a first
real workflow run.

## Dogfooding workflows in this repository

`.github/workflows/render-release.yml` runs on `release: published`, checks out
the release tag, renders root `release.md` when it exists, uploads the MP4 as a
release asset, and also stores a short-lived workflow artifact. It skips
cleanly with a notice when the selected markdown path is absent. The workflow
also has `workflow_dispatch` inputs for the markdown path, output name, release
tag, and upload toggle. Manual runs default to no release upload because local
development cannot create real GitHub releases for verification; the asset
upload path therefore still needs its first real release (or a deliberate
manual run against an existing release tag) before it can be considered
end-to-end verified.

`.github/workflows/render-preview.yml` renders GIFs for up to three changed
`*.video.md` files in same-repository PRs and upserts one marked PR comment.
The comment links to a short-lived workflow artifact zip; it is not an inline
image because GitHub's REST API has no supported binary attachment endpoint for
issue/PR comments.

## Security notes

- Rendering markdown means running real Chromium. Use `allow-remote-network:
  "false"` for untrusted input. The CLI then blocks non-loopback browser
  requests, including remote image URLs.
- Keep the workflow token minimal. Release upload needs `contents: write`; a
  render-only workflow needs no write permission.
- The token is not exported while Chromium or ffmpeg runs. It is assigned only
  to the `gh release upload` child process in the separate upload step.
- Markdown/output paths are confined to the caller workspace before invoking
  the CLI, and the CLI receives argv arrays rather than a shell-generated
  command string.
- Pin external action use to a commit SHA. A branch or major tag is convenient
  but mutable by the action publisher.
- The repository's PR preview workflow uses `pull_request`, not
  `pull_request_target`, and skips forked PRs. GitHub artifacts are used for
  GIF distribution because the REST API does not provide a first-class way to
  attach binary images to an existing PR comment; the comment links to the
  artifact rather than embedding an inline image.

## Future extraction and publishing path

The action scripts already treat the renderer workspace as a discovered
`renderer-root` instead of hard-coding this repository checkout, so extraction
is intended to be mechanical now that the CLI packaging work exists:

The CLI packaging prerequisite is now solved in this repository: the npm
artifact bundles the core runtime and the complete render-page/font payload,
and `.github/workflows/publish-cli.yml` is prepared for provenance-enabled npm
trusted publishing after the owner's first manual publish and one-time npmjs
setup (see `apps/cli/PUBLISHING.md`). Extraction can therefore proceed as:

1. Create `markdown-video/render-action`; copy this `action/` directory to the
   repository root as `action.yml`, `README.md`, and `scripts/`.
2. Replace the source-build prepare/install/build steps with a small npm CLI
   installation step (or keep a source-build fallback input while iterating).
   Keep `render.sh`, `upload-release-asset.sh`, the ffmpeg/Chromium checks, and
   the input/output contract unchanged.
3. Alternatively or additionally, publish a purpose-built CLI image to GHCR and
   change the extracted action to `runs.using: docker` with
   `image: docker://ghcr.io/<owner>/markdown-video-render:<immutable-tag>`. Do
   not reuse the 2.14 GB render-worker image for this; build a smaller CLI-only
   image. Public image availability is required for normal Docker actions.
4. Tag `v1` and document full-SHA pinning for consumers.

Until extraction happens, the in-repo composite action is the canonical
implementation and this repository's own release/preview workflows are the
dogfood harness.
