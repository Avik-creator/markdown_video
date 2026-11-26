#!/usr/bin/env bash
set -euo pipefail

renderer_root="${1:?renderer root required}"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "$name is required." >&2
    exit 1
  fi
}

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

require_env MV_MARKDOWN_PATH
require_env MV_OUTPUT_NAME
require_env MV_FORMAT
require_env MV_RESOLUTION
require_env MV_QUALITY
require_env MV_SPEED
require_env MV_ASPECT_RATIO
require_env MV_FPS

overwrite="$(boolean_value MV_OVERWRITE)"
allow_remote_network="$(boolean_value MV_ALLOW_REMOTE_NETWORK)"
workspace_input="${GITHUB_WORKSPACE:-$PWD}"
workspace="$(cd "$workspace_input" && pwd -P)"

resolve_inside_workspace() {
  local label="$1"
  local value="$2"
  local candidate

  if [[ -z "$value" || "$value" =~ ^[[:space:]] || "$value" =~ [[:space:]]$ ]]; then
    echo "Invalid $label path." >&2
    exit 1
  fi

  if [[ "$value" = /* ]]; then
    candidate="$value"
  else
    candidate="$workspace/$value"
  fi

  local resolved
  resolved="$(realpath -m "$candidate")"
  if [[ "$resolved" != "$workspace"/* ]]; then
    echo "$label path must stay inside the GitHub workspace: $value" >&2
    exit 1
  fi
  printf '%s\n' "$resolved"
}

input_path="$(resolve_inside_workspace markdown "$MV_MARKDOWN_PATH")"
output_path="$(resolve_inside_workspace output "$MV_OUTPUT_NAME")"

if [[ ! -f "$input_path" ]]; then
  echo "Markdown input does not exist: $MV_MARKDOWN_PATH" >&2
  exit 1
fi

if [[ "$input_path" == "$output_path" ]]; then
  echo "Input and output paths must be different files." >&2
  exit 1
fi

mkdir -p "$(dirname "$output_path")"

cli_entrypoint="$renderer_root/apps/cli/dist/cli.js"
if [[ ! -f "$cli_entrypoint" ]]; then
  echo "CLI build output is missing: $cli_entrypoint" >&2
  exit 1
fi

command=(
  node "$cli_entrypoint"
  render "$input_path"
  --output "$output_path"
  --format "$MV_FORMAT"
  --resolution "$MV_RESOLUTION"
  --quality "$MV_QUALITY"
  --speed "$MV_SPEED"
  --aspect-ratio "$MV_ASPECT_RATIO"
  --fps "$MV_FPS"
)

if [[ -n "${MV_LOCALE:-}" ]]; then
  command+=(--locale "$MV_LOCALE")
fi
if [[ "$overwrite" == "true" ]]; then
  command+=(--overwrite)
fi
if [[ "$allow_remote_network" == "false" ]]; then
  command+=(--deny-remote-network)
fi

# The workspace remains the CLI cwd, so the canonical CLI path safety checks
# still apply. All paths above are absolute but deliberately confined to that
# same cwd before the CLI is invoked. The browser path is fixed to the same
# location restored by the action cache.
export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright"
cd "$workspace"
"${command[@]}"

if [[ ! -s "$output_path" ]]; then
  echo "Renderer completed but did not create a non-empty output: $output_path" >&2
  exit 1
fi

{
  echo "output-path=$output_path"
  if [[ "$MV_FORMAT" == "gif" ]]; then
    echo "mp4-path="
  else
    echo "mp4-path=$output_path"
  fi
} >> "$GITHUB_OUTPUT"

size_bytes="$(stat -c '%s' "$output_path")"
sha256="$(sha256sum "$output_path" | awk '{print $1}')"
echo "Rendered output: $output_path"
echo "Size: $size_bytes bytes"
echo "SHA-256: $sha256"
