#!/usr/bin/env bash
set -euo pipefail

renderer_root="${1:?renderer root required}"
cd "$renderer_root"

pnpm --filter markdown-video exec playwright install chromium

chromium_launches() {
  (
    cd "$renderer_root/apps/cli"
    node --input-type=module -e '
      import { chromium } from "playwright"
      const browser = await chromium.launch({ headless: true })
      await browser.close()
    '
  ) >/dev/null 2>&1
}

if chromium_launches; then
  echo "Playwright Chromium is installed and launches successfully."
  exit 0
fi

echo "Chromium is installed but did not launch; installing missing system libraries with Playwright." >&2

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  env PATH="$PATH" pnpm --filter markdown-video exec playwright install-deps chromium
elif command -v sudo >/dev/null 2>&1; then
  sudo env PATH="$PATH" pnpm --filter markdown-video exec playwright install-deps chromium
else
  echo "Chromium system dependencies are missing and neither root nor sudo is available." >&2
  exit 1
fi

if ! chromium_launches; then
  echo "Chromium still does not launch after installing system dependencies." >&2
  exit 1
fi

echo "Playwright Chromium is installed and launches successfully."
