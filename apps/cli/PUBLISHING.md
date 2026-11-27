# Publishing markdown-video to npm

This document is for the package owner/maintainer. Normal contributors never need npm credentials.

## Artifact model

`markdown-video` is published as one self-contained artifact:

- tsup bundles `@markdown-video/core` into the executable/library JavaScript and generates self-contained declarations;
- `scripts/embed-render-page.mjs` copies the Vite render host, all 80 SHA-256-verified WOFF2 fonts, font provenance, and the OFL license into `dist/render-page`;
- `scripts/prepare-publish.mjs` creates `apps/cli/.npm-publish` with a sanitized manifest containing no workspace protocols, no devDependencies, and only the `playwright-core` runtime dependency;
- ffmpeg is an external system dependency by design. Chromium is downloaded into the user's Playwright cache by `markdown-video install-browser`, not packed into npm.

## One-time first publish

npm trusted-publisher settings live on the package settings page, so the package must exist once before OIDC can be configured. Perform the first publish manually with the owner's interactive npm login/2FA (the expired long-lived token is not needed):

```sh
pnpm install --frozen-lockfile
pnpm --filter 'markdown-video...' build
pnpm --filter markdown-video test
pnpm --filter markdown-video publish:prepare
cd apps/cli/.npm-publish
npm pack --dry-run
npm publish --access public
```

Do not run that manual publish until the release version in `apps/cli/package.json` is intended to become immutable on npm.

## One-time trusted publishing setup

After the package exists:

1. Open <https://www.npmjs.com/package/markdown-video> → **Settings** → **Trusted Publisher**.
2. Choose **GitHub Actions** and enter:
   - **Organization or user:** `Avik-creator`
   - **Repository:** `markdown_video`
   - **Workflow filename:** `publish-cli.yml` (filename only, not `.github/workflows/publish-cli.yml`)
   - **Environment name:** leave blank; the workflow does not use a GitHub environment
   - **Allowed actions:** permit direct `npm publish` (staged publishing may also be allowed if desired, but this workflow uses direct publish)
3. Save the configuration.
4. Recommended hardening: in npm package settings, disallow long-lived publish tokens once OIDC publishing has succeeded.

The release workflow uses Node 24 and npm 11.21.3, satisfying npm's trusted-publishing minimums (Node 22.14+/npm 11.5.1+). It grants only `id-token: write` and `contents: read`; there is no `NODE_AUTH_TOKEN` secret.

## Normal release process

1. Update `apps/cli/package.json` to the next semver version and commit it. npm versions are immutable.
2. Ensure the CLI readme/changelog-worthy behavior is current.
3. Create the GitHub Release whose tag/commit contains that exact version. Publishing the release triggers `.github/workflows/publish-cli.yml`.
4. The workflow installs, audits production dependencies, builds the dependency closure, runs CLI unit tests, stages the artifact, prints `npm pack --dry-run`, then runs `npm publish --provenance`.
5. Verify the result:

   ```sh
   npm view markdown-video version dist-tags provenance --json
   npm install -g markdown-video@<version>
   markdown-video doctor
   ```

## Emergency fallback

If trusted publishing is misconfigured but a release must be made, the same staged directory can be published manually with an interactive npm login:

```sh
cd apps/cli/.npm-publish
npm publish --access public
```

Fix the trusted-publisher configuration afterwards rather than creating another long-lived token.
