#!/usr/bin/env bash
set -euo pipefail

manifest="${1:-samples/real-douyin/manifest.json}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
cd "$repo_root"

if [[ ! -f "$manifest" ]]; then
  echo "Manifest not found: $manifest" >&2
  exit 2
fi

node --input-type=module - "$manifest" <<'NODE' | while IFS=$'\t' read -r slug url category min_duration; do
import { readFileSync } from 'node:fs';

const manifestPath = process.argv[2];
const filter = process.env.OPENVIDEO_SAMPLE_FILTER;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const samples = Array.isArray(manifest.samples) ? manifest.samples : [];
for (const sample of samples) {
  if (filter && sample.slug !== filter) continue;
  console.log([sample.slug, sample.url, sample.category || 'knowledge', sample.minDurationSec || 20].join('\t'));
}
NODE
  if [[ -z "$slug" ]]; then
    continue
  fi
  echo "==> Running real Douyin sample: $slug"
  OPENVIDEO_SAMPLE_MIN_DURATION_SEC="$min_duration" \
    scripts/samples/analyze-real-douyin.sh "$url" "$slug" "$category"
done
