# Monorepo notes

This repository is a pnpm workspace orchestrated by Turborepo.

```text
apps/
  web/       # Next.js editor, landing page, API routes, and MCP route
packages/    # Future shared packages (none are extracted yet)
```

## Local commands

Run these from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The root scripts delegate to workspace package scripts with `turbo run ...`. The same `dev`, `lint`, `typecheck`, `test`, `build`, and `start` scripts also work directly inside `apps/web`.

## Workspace decisions

- `apps/web` is named `@markdown-video/web` so the unscoped `markdown-video` package name remains available for the planned CLI.
- The root manifest is private and carries only orchestration tooling (`turbo`); application dependencies stay in `apps/web/package.json`.
- `pnpm-workspace.yaml` declares `apps/*` and `packages/*` and also holds `peerDependencyRules`. pnpm 10 workspace settings belong there rather than in a package manifest's `pnpm` field.
- No hoisting override or custom `.npmrc` is used. The standard pnpm isolated linker works with Next.js 16 in this workspace.
- `apps/web/next.config.mjs` sets both `turbopack.root` and `outputFileTracingRoot` to the repository root. This lets Turbopack resolve future workspace packages and ensures output-file tracing can include pnpm-linked dependency targets outside `apps/web`.
- `transpilePackages` is intentionally not configured yet. Next.js 16 automatically transpiles workspace packages for the App Router/Turbopack; add package names later only if the extracted packages need it.
- Turbo's Next.js build outputs cache `.next/**` while excluding `.next/cache/**` and `.next/dev/**`. `.env*` files in `apps/web` are explicit build inputs, and `NEXT_PUBLIC_*` variables participate in build cache keys. Runtime Redis variables are also allowlisted for the uncached `dev` and `start` tasks.
- There is no root `vercel.json`: the project does not need custom Vercel routing or headers, and the monorepo deployment settings are project settings rather than repository configuration.

## Vercel dashboard settings

Set these values in the existing Vercel project before deploying this branch (or before the first deployment after merging it):

| Setting | Required value |
| --- | --- |
| Project Settings → Build and Deployment → Root Directory | `apps/web` |
| Root Directory → Include files outside the root directory in the Build Step | **Enabled** |
| Framework Preset | `Next.js` |
| Build Command | `turbo run build` |
| Output Directory | Framework default (`.next`; no override) |
| Install Command | Automatically detected by Vercel (no override) |
| Node.js Version | `22.x` |
| Ignored Build Step | Automatic "skip unaffected projects" enabled, or `npx turbo-ignore --fallback=HEAD^1` if a manual command is required |

Notes:

1. Click **Save** after changing the Root Directory. Vercel applies the new setting on the next deployment.
2. Including files outside the Root Directory is required once shared packages under `packages/` exist. Vercel projects created after August 27, 2020 normally have this enabled by default, but verify it.
3. Vercel detects the pnpm workspace and install command automatically. Do not override the install command unless a deployment log shows otherwise.
4. Existing environment variables do not move. Keep `NEXT_PUBLIC_SITE_URL` and either the `UPSTASH_REDIS_REST_*` or `KV_REST_API_*` variables configured for the appropriate environments.
5. If using the Vercel CLI instead of the dashboard, use version 20.1.0 or newer and link/manage the project from the repository root so the `apps/web` root-directory mapping is preserved.
