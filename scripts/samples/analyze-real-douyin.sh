#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/samples/analyze-real-douyin.sh <douyin-url> <sample-slug> [category]

Environment:
  OPENVIDEO_AUTH=1                     Force QR-code login before downloading.
  OPENVIDEO_COOKIES=path               Cookie export path. Defaults to .openvideo/samples/<slug>/douyin-cookies.txt
  OPENVIDEO_STORAGE=path               Playwright storage-state path. Defaults to .openvideo/samples/<slug>/douyin-storage.json
  OPENVIDEO_SAMPLE_DIR=path            Output root. Defaults to .openvideo/samples/<slug>
  OPENVIDEO_SAMPLE_MIN_DURATION_SEC=N  Fail if the captured video is shorter than this. Defaults to 20.
  OPENVIDEO_TRANSCRIBE_MODEL=small     HyperFrames ASR model.
  OPENVIDEO_TRANSCRIBE_LANGUAGE=zh     ASR language.
  OPENVIDEO_TRANSCRIBE_TIMEOUT_MS=600000

Example:
  OPENVIDEO_SAMPLE_MIN_DURATION_SEC=300 \
    scripts/samples/analyze-real-douyin.sh "https://v.douyin.com/..." longge-japan-visa-fee knowledge
USAGE
}

if [[ $# -lt 2 ]]; then
  usage
  exit 2
fi

url="$1"
slug="$2"
category="${3:-knowledge}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
cd "$repo_root"

sample_dir="${OPENVIDEO_SAMPLE_DIR:-.openvideo/samples/$slug}"
cookies_path="${OPENVIDEO_COOKIES:-$sample_dir/douyin-cookies.txt}"
storage_path="${OPENVIDEO_STORAGE:-$sample_dir/douyin-storage.json}"
min_duration_sec="${OPENVIDEO_SAMPLE_MIN_DURATION_SEC:-20}"
auth_timeout_sec="${OPENVIDEO_AUTH_TIMEOUT_SEC:-300}"

mkdir -p "$sample_dir"

echo "==> Building OpenVideo CLI"
npm run build

if [[ "${OPENVIDEO_AUTH:-0}" == "1" || ! -f "$cookies_path" || ! -f "$storage_path" ]]; then
  echo "==> Opening Douyin QR login"
  node dist/src/cli/index.js auth douyin \
    --out "$cookies_path" \
    --storage "$storage_path" \
    --url "$url" \
    --timeout "$auth_timeout_sec"
fi

export OPENVIDEO_TRANSCRIBE_MODEL="${OPENVIDEO_TRANSCRIBE_MODEL:-small}"
export OPENVIDEO_TRANSCRIBE_LANGUAGE="${OPENVIDEO_TRANSCRIBE_LANGUAGE:-zh}"
export OPENVIDEO_TRANSCRIBE_TIMEOUT_MS="${OPENVIDEO_TRANSCRIBE_TIMEOUT_MS:-600000}"

download_log="$sample_dir/download.log"
download_dir="$sample_dir/downloads"

echo "==> Downloading real browser media"
node dist/src/cli/index.js download "$url" \
  --downloader browser \
  --cookies "$cookies_path" \
  --storage "$storage_path" \
  --out "$download_dir" | tee "$download_log"

video_path="$(awk -F'Video: ' '/^Video: / { print $2 }' "$download_log" | tail -n 1)"
if [[ -z "$video_path" || ! -f "$video_path" ]]; then
  echo "Could not locate downloaded video path in $download_log" >&2
  exit 1
fi

duration_sec="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$video_path")"
if ! awk -v actual="$duration_sec" -v minimum="$min_duration_sec" 'BEGIN { exit !(actual + 0 >= minimum + 0) }'; then
  echo "Downloaded media is only ${duration_sec}s; expected at least ${min_duration_sec}s." >&2
  echo "This usually means the browser captured a preview/placeholder instead of the full Douyin video." >&2
  exit 1
fi

echo "==> Analyzing $video_path (${duration_sec}s)"
node dist/src/cli/index.js analyze "$video_path" \
  --out "$sample_dir/runs" \
  --full \
  --category "$category"

echo "==> Done. Outputs are under $sample_dir"
