# Monorepo notes

This repository is a pnpm workspace orchestrated by Turborepo.

```text
apps/
  web/       # Next.js editor, landing page, API routes, and MCP route
packages/
  core/      # Parser, directive schema, validation/docs, share codec, types, and render geometry
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

The root scripts delegate to workspace package scripts with `turbo run ...`. The same `dev`, `lint`, `typecheck`, `test`, `build`, and `start` scripts also work directly inside `apps/web`; because there is no nested task orchestration when they are invoked that way, they assume `packages/core/dist` already exists (the root Turbo tasks create it automatically, including on a clean checkout). `packages/core` supports `lint`, `typecheck`, `test`, and `build` directly; it is a library and has no `dev`/`start` server script.

## `packages/core` boundaries

`@markdown-video/core` contains only framework-independent TypeScript:

- the markdown parser, parser constants/utilities, timeline math, and localization resolvers;
- the authoritative directive schema and schema-generated documentation;
- pure markdown syntax validation (the MCP transport/API route remains in `apps/web`);
- scene/project/export/template domain types;
- the isomorphic share-link codec;
- logical render dimensions, output render plans, fps normalization, and frame-count/validation math.

The store split is deliberate: `apps/web/lib/types.ts` owns the zustand `VideoStore` interface plus editor-only zoom, theme, marker, and history types. It imports scene/export/domain types from core. Browser export capture machinery also stays in the app: DOM clone mutation, html2canvas/ffmpeg.wasm buffer handling, MEMFS artifact naming, warm worker ownership, and render cancellation tracking are not core concerns.

Core is currently private to the workspace and has a single root import surface, `@markdown-video/core`. Do not import files inside the package through relative paths.

## Core build and Next.js interop

Core builds with plain `tsc` as an ESM-only NodeNext package. `tsup` would mainly provide bundling and dual-format output, but this package has no runtime dependencies and modern Next.js/Vite/Node consumers support ESM; preserving the unbundled module graph is simpler, keeps declarations aligned with sources, and avoids duplicate module identity across subpaths. Internal relative imports therefore use explicit `.js` specifiers, as required by Node ESM in the emitted output.

`transpilePackages` is still intentionally not configured in `apps/web/next.config.mjs`. Core is consumed as compiled plain JavaScript, and the Next.js 16 documentation also states that Turbopack automatically transpiles workspace packages under both routers. The dev server, production build, typecheck, and Vitest integration for this extraction all pass without the option.

Turbo builds core before tasks that consume its generated declarations or JavaScript: `build`, `typecheck`, and `test` already use `^build`, and `dev` also depends on `^build` so a clean checkout can start the app. Core's `dist/**` output is part of Turbo's build outputs. Changing core source during a long-lived web dev session requires rerunning the core build (or restarting `pnpm dev`); watch-oriented package development can be added later if it becomes painful.

## Workspace decisions

- `apps/web` is named `@markdown-video/web` so the unscoped `markdown-video` package name remains available for the planned CLI.
- The root manifest is private and carries only orchestration tooling (`turbo`); application dependencies stay in `apps/web/package.json`.
- `pnpm-workspace.yaml` declares `apps/*` and `packages/*` and also holds `peerDependencyRules`. pnpm 10 workspace settings belong there rather than in a package manifest's `pnpm` field.
- No hoisting override or custom `.npmrc` is used. The standard pnpm isolated linker works with Next.js 16 in this workspace.
- `apps/web/next.config.mjs` sets both `turbopack.root` and `outputFileTracingRoot` to the repository root. This lets Turbopack resolve future workspace packages and ensures output-file tracing can include pnpm-linked dependency targets outside `apps/web`.
- `transpilePackages` is intentionally not configured. `@markdown-video/core` ships compiled JavaScript, Next.js 16 automatically transpiles workspace packages for the App Router/Turbopack, and this extraction passed dev/build/typecheck/test verification without the option. Reassess only if a future workspace package ships raw TypeScript or JSX.
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
