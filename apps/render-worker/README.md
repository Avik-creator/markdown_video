# markdown-video render worker

Small authenticated Node.js HTTP service that renders markdown-video documents
with the same deterministic render page and Playwright/ffmpeg machinery as the
CLI. It exists because Vercel/serverless functions cannot run Chromium+ffmpeg
for synchronous multi-second renders.

## API

All render endpoints require `Authorization: Bearer $RENDER_WORKER_SHARED_SECRET`.
`GET /health` is intentionally unauthenticated and exposes only process/queue
state, never the secret or document content.

### `POST /v1/preview`

```json
{
  "markdown": "!scene\n!duration 2\n!text\nHello",
  "times": [0, 1, 2],
  "aspectRatio": "16:9",
  "locale": "en"
}
```

- `times` is optional. When present it must contain 3–6 finite times in
  seconds. When omitted the worker chooses 5 times spread inclusively across
  the video duration.
- Frames are direct PNG screenshots at the requested timeline times, not
  lossy frames extracted from an mp4.
- Preview raster size is fixed at the `720p` render-plan size (1280×720 for
  16:9) to keep MCP responses bounded while remaining legible.
- Response JSON: `{ duration, width, height, frames: [{ time, pngBase64 }] }`.

### `POST /v1/video`

```json
{
  "markdown": "!scene\n!duration 2\n!text\nHello",
  "options": {
    "resolution": "720p",
    "quality": "medium",
    "speed": "fast",
    "fps": 24,
    "aspectRatio": "16:9",
    "locale": "en"
  }
}
```

- Response body is binary `video/mp4`. Metadata is in `x-mv-duration`,
  `x-mv-width`, `x-mv-height`, `x-mv-fps`, `x-mv-frames`, and
  `x-mv-elapsed-seconds` headers.
- Defaults: `720p`, `medium` quality, `fast` encoder speed, 24 fps, project
  aspect ratio 16:9.
- Allowed resolution: `480p`, `720p`, `1080p`. Allowed quality: `low`,
  `medium`, `high` (`ultra` is deliberately not exposed). Allowed speed:
  `fastest`, `fast`, `balanced` (slower encoder presets are deliberately not
  exposed).

## Caps and timeouts

The synchronous request/response design is intentionally conservative:

| Limit | Value |
| --- | ---: |
| Markdown input | 100,000 characters / 400,000 UTF-8 bytes |
| JSON request body | 512 KiB |
| Duration | 30 seconds |
| fps | 1–30 (24 default) |
| Resolution | up to 1080p |
| mp4 output | 6 MiB |
| Preview timeout | 20 seconds including queue wait |
| Video timeout | 45 seconds including queue wait |
| Concurrency | 1 render by default, maximum 4 |
| Waiting queue | 8 requests by default, maximum 64 |

A 30 fps/30 s upper-bound job is 900 browser screenshots plus x264 encoding.
Even though small renders are much faster, the upper bound can be tens of
seconds of CPU. Raising the duration cap should be paired with an asynchronous
job protocol rather than longer synchronous MCP calls.

## Environment variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `RENDER_WORKER_SHARED_SECRET` | **yes** | — | Bearer token shared with the web app. Minimum 32 characters; use `openssl rand -hex 32`. The process refuses to start without it. |
| `PORT` | no | `8080` | TCP port. Container platforms often inject this. |
| `HOST` | no | `0.0.0.0` | Listen host. |
| `RENDER_WORKER_CONCURRENCY` | no | `1` | Concurrent Chromium renders, capped at 4. Keep low; each browser is memory-hungry. |
| `RENDER_WORKER_QUEUE_LIMIT` | no | `8` | Maximum waiting requests, capped at 64. Excess requests get 429. |
| `PLAYWRIGHT_BROWSERS_PATH` | no | Playwright default | Set to `/ms-playwright` in the supplied image. |
| `FFMPEG_BIN` | no | `ffmpeg` | Optional ffmpeg executable path used by the CLI library. |

## Security model

- Bearer auth is mandatory and compared through fixed-length SHA-256 digests.
- Input is strict zod-validated JSON with body, markdown, duration, frame-count,
  resolution, fps, and output-size caps.
- ffmpeg is spawned with argument arrays, never through a shell.
- mp4 output is written only inside a per-render temporary directory that is
  removed afterward.
- Remote browser egress is denied: page requests may only reach the ephemeral
  loopback origin serving the built render assets. `data:`/`blob:` image URLs
  still work. This matters because `!image src:...` can otherwise be an
  SSRF-like egress primitive against services reachable from the worker.
  Remote `http(s)` image URLs therefore render as broken images in this
  worker; that is an intentional security trade-off, not a parser error.
- Chromium still executes a real browser rendering untrusted markdown. Run the
  worker in an isolated container/network namespace, give it no cloud metadata
  or internal-network access it does not need, and keep egress restricted at
  the platform firewall as defense in depth.

## Local development

Build the render page and CLI library first, then the worker:

```sh
pnpm --filter @markdown-video/render-page build
pnpm --filter markdown-video build
pnpm --filter @markdown-video/render-worker build
```

Run it:

```sh
export RENDER_WORKER_SHARED_SECRET="$(openssl rand -hex 32)"
PORT=8080 pnpm --filter @markdown-video/render-worker start
```

Unit tests do not launch Chromium:

```sh
pnpm --filter @markdown-video/render-worker test
```

The end-to-end integration test does launch Chromium and requires ffmpeg and
the built render page:

```sh
pnpm --filter @markdown-video/render-worker test:integration
```

Set `MV_SKIP_INTEGRATION=1` in environments that cannot provide those binaries.

## Docker image

Build from the **repository root** (the build context must contain the
workspace packages):

```sh
docker build -f apps/render-worker/Dockerfile -t markdown-video-render-worker .
```

Run:

```sh
docker run --rm \
  -p 8080:8080 \
  -e RENDER_WORKER_SHARED_SECRET="$(openssl rand -hex 32)" \
  markdown-video-render-worker
```

Then verify:

```sh
curl http://127.0.0.1:8080/health
```

The Dockerfile uses a digest-pinned `node:22.21.1-bookworm-slim` base,
installs Debian ffmpeg and Playwright's Chromium system dependencies, downloads
the matching Chromium browser in the build stage, deploys only production
workspace dependencies with `pnpm deploy`, and runs as the pre-existing
non-root `node` user.

Verified locally:

- The `pnpm deploy --prod --legacy` packaging mechanism was verified on the
  host, and the resulting deployed directory successfully started and rendered
  a preview locally.
- The end-to-end worker integration tests passed on the host with Chromium and
  ffmpeg.
- `docker build -t markdown-video-render-worker:dev -f apps/render-worker/Dockerfile .`
  completed successfully with the repository root as build context.
- The built container was run locally; `/health` returned 200, an
  unauthenticated preview returned 401, an authenticated `/v1/preview` returned
  five 1280×720 PNG frames, and an authenticated low-cost `/v1/video` request
  returned a valid ISO mp4 with the expected metadata headers.

The exact container verification was performed on an arm64 Apple Silicon host.
Multi-architecture publishing and deployment-platform health checks remain
operations concerns rather than guarantees of this local smoke test.

## Deployment

Any always-on or scale-to-zero container host that permits Chromium can run
the image: Fly.io Machines, Render/Railway services, Google Cloud Run, AWS
ECS/Fargate, Kubernetes, or a small VM. Vercel serverless functions are not a
valid host for this worker.

Practical deployment notes:

1. Use at least 1 GB memory for one concurrent render; 2 GB is a safer start
   for 1080p or concurrency 2.
2. Keep the service private if possible. If it must be internet-facing, put it
   behind the platform's TLS/proxy and treat the shared secret as the only
   application credential.
3. Restrict outbound egress. The application already blocks browser requests
   to non-loopback origins, but platform-level egress rules are stronger.
4. Configure the web app with:
   - `RENDER_WORKER_URL=https://your-worker.example.com`
   - `RENDER_WORKER_SHARED_SECRET=<same secret>`
5. Cold starts are significant because Chromium and ffmpeg live in the image,
   even though the browser binary is not downloaded at runtime. A warm minimum
   instance is recommended for interactive MCP use.
6. The in-process queue does not coordinate across multiple replicas. One
   replica with concurrency 1 is the safe initial deployment; horizontal scale
   requires either a load balancer with low replica affinity awareness or a
   real distributed queue/job protocol.
