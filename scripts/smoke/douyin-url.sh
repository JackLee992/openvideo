#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SMOKE_URL="${OPENVIDEO_SMOKE_DOUYIN_URL:-}"
DOWNLOADER="${OPENVIDEO_SMOKE_DOWNLOADER:-auto}"
CATEGORY="${OPENVIDEO_SMOKE_CATEGORY:-knowledge}"
SMOKE_DIR="${OPENVIDEO_SMOKE_DIR:-"$ROOT_DIR/.openvideo/smoke/douyin"}"
COOKIES_FILE="${OPENVIDEO_SMOKE_COOKIES:-}"
COOKIES_FROM_BROWSER="${OPENVIDEO_SMOKE_COOKIES_FROM_BROWSER:-}"

if [[ -z "$SMOKE_URL" ]]; then
  echo "SKIP: set OPENVIDEO_SMOKE_DOUYIN_URL to run the real Douyin download/analyze smoke."
  echo "Example: OPENVIDEO_SMOKE_DOUYIN_URL='https://www.douyin.com/video/...' npm run smoke:douyin"
  exit 0
fi

mkdir -p "$SMOKE_DIR"

DOWNLOAD_LOG="$SMOKE_DIR/download.log"
ANALYZE_LOG="$SMOKE_DIR/analyze.log"
DOWNLOADS_DIR="$SMOKE_DIR/downloads"
RUNS_DIR="$SMOKE_DIR/runs"

echo "Running OpenVideo doctor..."
npm run doctor

echo "Downloading Douyin reference with downloader: $DOWNLOADER"
download_args=(download "$SMOKE_URL" --out "$DOWNLOADS_DIR" --downloader "$DOWNLOADER")
if [[ -n "$COOKIES_FILE" ]]; then
  download_args+=(--cookies "$COOKIES_FILE")
fi
if [[ -n "$COOKIES_FROM_BROWSER" ]]; then
  download_args+=(--cookies-from-browser "$COOKIES_FROM_BROWSER")
fi
npm run dev -- "${download_args[@]}" | tee "$DOWNLOAD_LOG"

VIDEO_PATH="$(awk -F 'Video: ' '/^Video: / { print $2 }' "$DOWNLOAD_LOG" | tail -1)"
if [[ -z "$VIDEO_PATH" || ! -s "$VIDEO_PATH" ]]; then
  echo "Could not find a downloaded video path in $DOWNLOAD_LOG" >&2
  exit 1
fi

echo "Analyzing downloaded video: $VIDEO_PATH"
npm run dev -- analyze "$VIDEO_PATH" --out "$RUNS_DIR" --category "$CATEGORY" | tee "$ANALYZE_LOG"

RUN_DIR="$(awk -F 'Created run: ' '/^Created run: / { print $2 }' "$ANALYZE_LOG" | tail -1)"
if [[ -z "$RUN_DIR" || ! -d "$RUN_DIR" ]]; then
  echo "Could not find the created run directory in $ANALYZE_LOG" >&2
  exit 1
fi

for required in \
  "$RUN_DIR/VIDEO_STYLE.md" \
  "$RUN_DIR/hyperframes-brief.md" \
  "$RUN_DIR/analysis/metadata.json" \
  "$RUN_DIR/analysis/shot-breakdown.json" \
  "$RUN_DIR/analysis/edit-rhythm.json" \
  "$RUN_DIR/analysis/captions.json" \
  "$RUN_DIR/analysis/transcript.json"
do
  if [[ ! -s "$required" ]]; then
    echo "Missing expected smoke artifact: $required" >&2
    exit 1
  fi
done

node - "$RUN_DIR" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const runDir = process.argv[2];
const metadata = JSON.parse(fs.readFileSync(path.join(runDir, 'analysis/metadata.json'), 'utf8'));
const editRhythm = JSON.parse(fs.readFileSync(path.join(runDir, 'analysis/edit-rhythm.json'), 'utf8'));
const captions = JSON.parse(fs.readFileSync(path.join(runDir, 'analysis/captions.json'), 'utf8'));
const transcript = JSON.parse(fs.readFileSync(path.join(runDir, 'analysis/transcript.json'), 'utf8'));

console.log('Smoke summary:');
console.log(JSON.stringify({
  runDir,
  durationSec: metadata.video.durationSec,
  aspectRatio: metadata.video.aspectRatio,
  sceneCount: editRhythm.estimatedSceneCount,
  cutCount: editRhythm.cuts.length,
  captionObservationCount: captions.observations.length,
  transcriptWordCount: transcript.words.length,
}, null, 2));
NODE

echo "Douyin smoke completed: $RUN_DIR"
