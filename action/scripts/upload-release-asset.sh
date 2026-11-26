#!/usr/bin/env bash
set -euo pipefail

boolean_value() {
  local name="$1"
  local value="${!name:-false}"
  case "$value" in
    true|false) printf '%s\n' "$value" ;;
    *)
      echo "$name must be exactly 'true' or 'false' (got '$value')." >&2
      exit 1
      ;;
  esac
}

upload_enabled="$(boolean_value MV_UPLOAD_RELEASE_ASSET)"
if [[ "$upload_enabled" != "true" ]]; then
  echo "asset-url=" >> "$GITHUB_OUTPUT"
  echo "Release asset upload disabled."
  exit 0
fi

if [[ -z "${MV_OUTPUT_PATH:-}" ]]; then
  echo "MV_OUTPUT_PATH is required when release asset upload is enabled." >&2
  exit 1
fi
if [[ ! -s "$MV_OUTPUT_PATH" ]]; then
  echo "Release asset output does not exist or is empty: $MV_OUTPUT_PATH" >&2
  exit 1
fi
if [[ -z "${MV_GITHUB_TOKEN:-}" ]]; then
  echo "github-token input is empty; cannot upload a release asset." >&2
  exit 1
fi
if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
  echo "GITHUB_REPOSITORY is required for release asset upload." >&2
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "The GitHub CLI (gh) is required for release asset upload. GitHub-hosted Ubuntu runners include it." >&2
  exit 1
fi

release_tag="${MV_RELEASE_TAG:-}"
if [[ -z "$release_tag" && -n "${GITHUB_EVENT_PATH:-}" && -f "$GITHUB_EVENT_PATH" ]]; then
  release_tag="$(
    node -e '
      const fs = require("node:fs")
      const event = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
      process.stdout.write(event.release?.tag_name ?? "")
    ' "$GITHUB_EVENT_PATH"
  )"
fi

if [[ -z "$release_tag" ]]; then
  echo "release-tag was not provided and the workflow event does not contain release.tag_name." >&2
  exit 1
fi

# The token is placed only on the gh child process environment. It is never
# exported into the renderer/Chromium environment by this action.
upload_output="$(
  GH_TOKEN="$MV_GITHUB_TOKEN" gh release upload "$release_tag" "$MV_OUTPUT_PATH" \
    --clobber \
    --repo "$GITHUB_REPOSITORY"
)"
asset_url="$(printf '%s\n' "$upload_output" | tail -n 1 | tr -d '\r')"

if [[ "$asset_url" != http* ]]; then
  echo "gh release upload did not return an asset URL." >&2
  exit 1
fi

echo "asset-url=$asset_url" >> "$GITHUB_OUTPUT"
echo "Uploaded release asset: $asset_url"
