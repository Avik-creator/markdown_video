#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "markdown-video render action currently supports Linux runners only." >&2
  exit 1
fi

if [[ -z "${GITHUB_ACTION_PATH:-}" ]]; then
  echo "GITHUB_ACTION_PATH is required to locate the renderer sources." >&2
  exit 1
fi

find_renderer_root() {
  local candidate
  candidate="$(cd "$GITHUB_ACTION_PATH" && pwd -P)"

  # In this monorepo the action lives at <root>/action. When GitHub resolves an
  # external subdirectory action it downloads the whole action repository, so
  # the same parent lookup works there too. If the action is later extracted to
  # a standalone repository whose root is the action directory, the first
  # iteration also handles that layout.
  local depth
  for depth in 0 1 2 3 4 5; do
    if [[ -f "$candidate/package.json" &&
          -f "$candidate/pnpm-lock.yaml" &&
          -f "$candidate/pnpm-workspace.yaml" &&
          -f "$candidate/apps/cli/package.json" &&
          -f "$candidate/apps/render/package.json" &&
          -f "$candidate/packages/core/package.json" &&
          -f "$candidate/packages/scenes/package.json" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi

    local parent
    parent="$(dirname "$candidate")"
    if [[ "$parent" == "$candidate" ]]; then
      break
    fi
    candidate="$parent"
  done

  return 1
}

if ! renderer_root="$(find_renderer_root)"; then
  echo "Could not find the markdown-video workspace above $GITHUB_ACTION_PATH." >&2
  echo "The in-repo action expects the action repository to contain apps/cli, apps/render, and packages/." >&2
  exit 1
fi

cd "$renderer_root"

lockfile_sha256="$(sha256sum pnpm-lock.yaml | awk '{print $1}')"
playwright_version="$(sed -n 's/^[[:space:]]*"playwright":[[:space:]]*"\([^"]*\)".*/\1/p' apps/cli/package.json | head -n 1)"
if [[ -z "$playwright_version" ]]; then
  echo "Could not read the Playwright version from apps/cli/package.json." >&2
  exit 1
fi

# Hash every source-controlled file that can affect the compiled renderer. The
# action repository itself is immutable for a ref, but this content key keeps
# the build cache correct when consumers move between refs and when the action
# is used from a mutable branch during development.
source_sha256="$(
  {
    printf '%s\0' package.json pnpm-lock.yaml pnpm-workspace.yaml
    find packages/core packages/scenes apps/render apps/cli \
      -type f \
      ! -path '*/node_modules/*' \
      ! -path '*/dist/*' \
      ! -path '*/.turbo/*' \
      -print0
  } | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
)"

{
  echo "renderer-root=$renderer_root"
  echo "lockfile-sha256=$lockfile_sha256"
  echo "playwright-version=$playwright_version"
  echo "source-sha256=$source_sha256"
} >> "$GITHUB_OUTPUT"

echo "Renderer source root: $renderer_root"
echo "Renderer source hash: $source_sha256"
echo "Playwright version: $playwright_version"
