# Landing page provenance and asset regeneration

The landing page is intentionally dogfooded: its videos, posters, preview frames, caption sidecars, and OG image are generated artifacts rather than mockups. Canonical markdown sources live in `examples/*.video.md`; public runtime assets live in `apps/web/public/landing/`.

## Run the page

```sh
pnpm install --frozen-lockfile
pnpm --filter @markdown-video/web dev
```

Open `http://localhost:3000`. Theme switching uses the same `next-themes` setup as the editor.

## Re-render the artifacts

Build the workspace once so `apps/cli/dist/cli.js` exists:

```sh
pnpm build
```

Render the videos from the repository root:

```sh
node apps/cli/dist/cli.js render examples/landing-hero.video.md \
  -o hero-showcase.mp4 --resolution 720p --aspect-ratio 4:3 --fps 18 --overwrite

node apps/cli/dist/cli.js render examples/landing-agent-mcp.video.md \
  -o mcp-agent.mp4 --resolution 720p --aspect-ratio 4:3 --fps 15 --overwrite

node apps/cli/dist/cli.js render examples/landing-captions.video.md \
  -o captions-demo.mp4 --resolution 720p --aspect-ratio 4:3 --fps 18 --overwrite

node apps/cli/dist/cli.js render examples/landing-captions.video.md \
  -o captions-burned.mp4 --resolution 720p --aspect-ratio 4:3 --fps 18 \
  --burn-captions --overwrite

node apps/cli/dist/cli.js render examples/launch.video.md \
  -o launch-v2.mp4 --resolution 1080p --aspect-ratio 16:9 --fps 30 --overwrite
```

The render command writes `.srt` and `.vtt` sidecars beside each MP4 for top-level text scenes. Copy the needed MP4s and sidecars into `apps/web/public/landing/`.

Preview frames are direct exact-timeline browser captures, not frames extracted from encoded video:

```sh
node apps/cli/dist/cli.js preview examples/landing-hero.video.md \
  --times 0.9,3,5.9,7.2 --resolution 720p --aspect-ratio 4:3 \
  --output-dir hero-preview --overwrite

node apps/cli/dist/cli.js preview examples/landing-action.video.md \
  --times 1 --resolution 720p --aspect-ratio 4:3 \
  --output-dir action-preview --overwrite

node apps/cli/dist/cli.js preview examples/landing-i18n.video.md \
  --times 1 --resolution 720p --aspect-ratio 4:3 --locale en \
  --output-dir i18n-en-preview --overwrite

node apps/cli/dist/cli.js preview examples/landing-i18n.video.md \
  --times 1 --resolution 720p --aspect-ratio 4:3 --locale es \
  --output-dir i18n-es-preview --overwrite
```

Posters can be extracted from the real MP4s with ffmpeg, then compressed with `cwebp`:

```sh
ffmpeg -ss 0.9 -i hero-showcase.mp4 -frames:v 1 hero-poster.png
cwebp -q 84 hero-poster.png -o apps/web/public/landing/hero-showcase-poster.webp
```

The current OG image is a 1200×630 crop of the real launch-video title frame:

```sh
ffmpeg -i launch-poster.png \
  -vf "scale=1200:-1,crop=1200:630:0:(ih-630)/2" \
  -frames:v 1 apps/web/public/og-image.png
```

## Current fixture map

| Source | Public artifact |
| --- | --- |
| `examples/launch.video.md` + `examples/assets/launch-theme.mp3` | `launch-v2.mp4`, `launch-v2.srt`, `launch-v2.vtt`, `launch-v2-poster.webp`, `og-image.png` |
| `examples/landing-hero.video.md` | `hero-showcase.mp4`, `hero-showcase.srt`, `hero-showcase.vtt`, `hero-showcase-poster.webp`, `pipeline-frame-1..4.webp` |
| `examples/landing-captions.video.md` + `examples/assets/landing-theme.mp3` | `captions-demo.mp4`, `captions-demo.srt`, `captions-demo.vtt`, `captions-burned-frame.webp` |
| `examples/landing-agent-mcp.video.md` | `mcp-agent.mp4`, `mcp-agent-poster.webp` |
| `examples/landing-i18n.video.md` | `i18n-en.webp`, `i18n-es.webp` |
| `examples/landing-action.video.md` | `action-workflow.webp` |

## Customize safely

- Edit the markdown source first, then regenerate the matching artifact. Do not hand-edit generated MP4s, sidecars, posters, or preview frames.
- Keep source snippets shown in landing components synchronized with the files in `examples/`.
- `hero-transformation.tsx` contains hard-coded scene timings and line ranges for `landing-hero.video.md`; update them if that source's scene order or duration changes.
- Video UI must keep posters, `preload="none"` or `metadata`, controls, caption tracks where sidecars exist, and reduced-motion behavior. Only the hero attempts muted autoplay because the motion explains the source-to-video transformation.
- Re-run the verification loop after changes: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, then Playwright screenshots at 320/768/1024/1440 in both themes.
