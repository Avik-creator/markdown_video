#!/usr/bin/env bash
set -euo pipefail

renderer_root="${1:?renderer root required}"
expected_source_sha256="${2:?source sha256 required}"
marker="$renderer_root/apps/cli/dist/.markdown-video-action-build"

build_is_current() {
  [[ -f "$marker" ]] || return 1
  [[ "$(cat "$marker")" == "$expected_source_sha256" ]] || return 1
  [[ -f "$renderer_root/packages/core/dist/index.js" ]] || return 1
  [[ -f "$renderer_root/packages/scenes/dist/index.js" ]] || return 1
  [[ -f "$renderer_root/apps/render/dist/index.html" ]] || return 1
  [[ -f "$renderer_root/apps/cli/dist/cli.js" ]] || return 1
}

if build_is_current; then
  echo "Renderer build cache is current; skipping TypeScript/Vite builds."
  exit 0
fi

cd "$renderer_root"
pnpm --filter @markdown-video/core build
pnpm --filter @markdown-video/scenes build
pnpm --filter @markdown-video/render-page build
pnpm --filter markdown-video build

printf '%s\n' "$expected_source_sha256" > "$marker"
echo "Renderer build completed."
