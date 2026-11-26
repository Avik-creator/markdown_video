<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

In this workspace, the Next.js package and its bundled docs are installed under `apps/web/node_modules/next/` rather than directly under the repository-root `node_modules/`.

## Verification

Run the CI sequence from the repository root after code changes. The root scripts delegate to workspace packages through Turborepo:

```sh
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level=critical
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The same `lint`, `typecheck`, `test`, `build`, and `dev` scripts also work standalone inside `apps/web`. `pnpm lint` may report non-blocking warnings, but must have zero errors. The full test suite is Vitest and currently includes jsdom/React integration tests as well as pure parser/store/export tests.
