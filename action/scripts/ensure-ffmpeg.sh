#!/usr/bin/env bash
set -euo pipefail

if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  echo "ffmpeg and ffprobe are already available."
  ffmpeg -version | head -n 1
  exit 0
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "ffmpeg/ffprobe are missing and apt-get is unavailable. Install ffmpeg before using this action." >&2
  exit 1
fi

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  apt-get update
  apt-get install -y --no-install-recommends ffmpeg
elif command -v sudo >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends ffmpeg
else
  echo "ffmpeg/ffprobe are missing and neither root nor sudo is available for apt-get." >&2
  exit 1
fi

ffmpeg -version | head -n 1
ffprobe -version | head -n 1
