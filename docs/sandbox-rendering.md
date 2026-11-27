# Vercel Sandbox server-side rendering

This deployment can render MCP `render_preview` and `render_video` requests in two ways:

1. **Dedicated render worker** — selected when `RENDER_WORKER_URL` and `RENDER_WORKER_SHARED_SECRET` are set. This remains the preferred production backend.
2. **Vercel Sandbox** — selected when no worker is configured and sandbox credentials are available. Each render forks the persistent `mdv-render-template` sandbox, uploads the current self-contained CLI bundle and the markdown document, runs the CLI with remote networking disabled, reads the PNG/MP4 result, and stops/deletes the fork.

The public tool contract is intentionally the same for both backends: 30 seconds maximum duration, preview at 720p, video defaults of 720p/medium/fast/24fps, maximum 1080p and 30fps, and a 6 MiB MP4 cap. Preview execution is hard-capped at 20 seconds and video execution at 45 seconds, including fork startup. Very complex documents can therefore hit the execution timeout before the nominal 30-second duration cap.

## One-time template provisioning

The runtime forks a persistent template named `mdv-render-template`. Provision it from a checkout of this repository after building the workspace:

```sh
pnpm install --frozen-lockfile
pnpm build
node scripts/provision-render-sandbox.mts
```

The provisioning script is idempotent. It:

- uses the `vercel/sandbox/universal:latest` image;
- stages and uploads the current CLI bundle;
- installs ffmpeg with `apt-get`;
- installs the exact Playwright-managed Chromium revision required by the bundled `playwright-core`;
- installs Chromium system dependencies;
- sets `PLAYWRIGHT_BROWSERS_PATH=/vercel/sandbox/ms-playwright` so the browser is restored from the template snapshot;
- runs `markdown-video doctor` as an acceptance gate;
- performs a three-frame exact-time preview smoke test and a small MP4 render smoke test;
- stops the persistent sandbox so Vercel creates the snapshot used by later forks; and
- keeps only the latest non-expiring snapshot.

Re-run provisioning after upgrading `playwright-core`, changing browser/system dependency requirements, or intentionally moving to a new sandbox image. The CLI code itself is transported on every render, so ordinary markdown-video CLI changes only require redeploying `apps/web`; reprovisioning in that case is still useful because the script's smoke tests validate the exact current bundle.

Use `MDV_RENDER_SANDBOX_TEMPLATE` to provision or target a non-default template name while testing:

```sh
MDV_RENDER_SANDBOX_TEMPLATE=mdv-render-template-staging node scripts/provision-render-sandbox.mts
```

The same variable is read by the web backend, so a preview deployment can use a staging template without affecting the production template.

## Credentials

The script and backend never start an interactive login flow inside the web process. They use either:

- `VERCEL_OIDC_TOKEN` (recommended for Vercel deployments and for local development after `vercel link` + `vercel env pull`), or
- `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` (an explicit access-token triple).

The access-token triple is passed only to the Vercel API client in the web/operator process. It is **not** written into the sandbox environment.

For local provisioning, the Vercel project must be linked in a scratch copy or local checkout as appropriate. Do not commit `.vercel`; it is already ignored. Typical setup is:

```sh
vercel link
vercel env pull .env.local
# Load the pulled variables in the shell or export the token triple manually.
node scripts/provision-render-sandbox.mts
```

Production `apps/web` needs the same sandbox credentials available to the serverless function. If the worker variables are also present, the worker takes precedence and the sandbox backend remains dormant.

## Build-time CLI bundle

`apps/web/scripts/stage-render-sandbox-cli.mjs` runs in `predev` and `prebuild`. It copies the built `markdown-video` CLI, embedded render-page/font assets, and the runtime-required subset of `playwright-core` into:

```text
apps/web/lib/render-sandbox/cli-bundle/
```

That directory is generated, ignored by git, and excluded from lint. `next.config.mjs` includes it in the MCP route's output file tracing so it is present in the deployed serverless function. If the bundle is missing or incomplete, rendering fails closed with a configuration error instead of partially writing a broken sandbox job.

The bundle is uploaded into `/vercel/sandbox/job` for each render. This makes the renderer version match the web deployment even when the persistent template was provisioned earlier.

## Isolation and failure behavior

- Forks are non-persistent and are stopped and deleted in `finally` cleanup.
- Fork network policy is `deny-all`; the CLI additionally passes `--deny-remote-network`, so browser image/media requests cannot leave the loopback render-page origin. Inline `data:` media remains supported.
- Command arguments are passed as argv arrays, not interpolated through a shell.
- Markdown is data in `input.md`; it is never concatenated into a command line.
- CLI stderr included in errors is control-sanitized and capped at 1,000 characters.
- Output JSON and PNG/MP4 magic bytes are validated before results are accepted.
- Missing backend credentials fail closed. A malformed worker URL is treated as a worker configuration error rather than silently falling back to another backend.

## Operational limitations

- Sandbox rendering is bounded by the same worker-style 20s/45s execution budgets. These budgets include fork startup and browser launch, not just frame capture.
- Vercel Sandbox use incurs sandbox CPU/memory, storage/snapshot, and network costs in addition to serverless function time.
- Template provisioning needs outbound network access for apt and the initial Chromium download. Runtime render forks do not need outbound network access.
- The MCP route is capped at 90 seconds. That leaves room for the 45-second render cap plus artifact storage and cleanup while staying well below the Hobby-plan maximum.
