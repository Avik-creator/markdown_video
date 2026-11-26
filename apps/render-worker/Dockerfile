# syntax=docker/dockerfile:1

# The digest is the multi-architecture index for node:22.21.1-bookworm-slim.
# Pinning it keeps the Node/OS base immutable while still selecting the host
# architecture at pull time.
FROM node:22.21.1-bookworm-slim@sha256:25b3eb23a00590b7499f2a2ce939322727fcce1b15fdd69754fcd09536a3ae2c AS build

ENV PNPM_HOME=/pnpm \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate
WORKDIR /repo

# Copy manifests first so dependency installation remains cacheable. The full
# workspace install is intentional: the render page and CLI are workspace
# packages built from source before pnpm deploy creates the small production payload.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/scenes/package.json packages/scenes/package.json
COPY apps/render/package.json apps/render/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY apps/render-worker/package.json apps/render-worker/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY packages/core packages/core
COPY packages/scenes packages/scenes
COPY apps/render apps/render
COPY apps/cli apps/cli
COPY apps/render-worker apps/render-worker

RUN pnpm --filter @markdown-video/core build \
    && pnpm --filter @markdown-video/scenes build \
    && pnpm --filter @markdown-video/render-page build \
    && pnpm --filter markdown-video build \
    && pnpm --filter @markdown-video/render-worker build \
    && pnpm --filter markdown-video exec playwright install chromium \
    && pnpm --filter @markdown-video/render-worker deploy --prod --legacy /prod/render-worker

FROM node:22.21.1-bookworm-slim@sha256:25b3eb23a00590b7499f2a2ce939322727fcce1b15fdd69754fcd09536a3ae2c AS runtime

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    HOST=0.0.0.0 \
    PORT=8080

# Playwright's own installer owns the Chromium system-library contract for the
# exact browser revision. ffmpeg is deliberately the distribution package so
# security updates come from the base OS rather than a bundled binary.
# install-deps also adds Debian's bitmap color emoji as a general browser
# fallback. Remove that package after satisfying Chromium's library contract:
# the render page bundles its own COLRv1 emoji webfont, and keeping a system
# color font would make glyph selection depend on the container OS again.
RUN apt-get update \
    && npx --yes playwright@1.65.1 install-deps chromium \
    && apt-get install -y --no-install-recommends ffmpeg \
    && apt-get purge -y fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/* /root/.npm

COPY --from=build /ms-playwright /ms-playwright
COPY --from=build /prod/render-worker /app
RUN chmod -R a+rX /ms-playwright /app

WORKDIR /app
USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
