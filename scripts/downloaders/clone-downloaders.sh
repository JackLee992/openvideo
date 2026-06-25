#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DOWNLOADERS_DIR="${OPENVIDEO_DOWNLOADERS_DIR:-"$ROOT_DIR/.openvideo/downloaders"}"

JIJI_REPO_URL="${OPENVIDEO_JIJI_REPO_URL:-https://github.com/jiji262/douyin-downloader.git}"
DOUYIN_API_REPO_URL="${OPENVIDEO_DOUYIN_API_REPO_URL:-https://github.com/Evil0ctal/Douyin_TikTok_Download_API.git}"
TIKTOKDOWNLOADER_REPO_URL="${OPENVIDEO_TIKTOKDOWNLOADER_REPO_URL:-https://github.com/JoeanAmier/TikTokDownloader.git}"

mkdir -p "$DOWNLOADERS_DIR"

clone_or_update() {
  local name="$1"
  local url="$2"
  local dir="$DOWNLOADERS_DIR/$name"

  if [[ -d "$dir/.git" ]]; then
    echo "Updating $name in $dir"
    git -C "$dir" fetch --all --tags --prune
    git -C "$dir" pull --ff-only || {
      echo "Could not fast-forward $name. Keep your fork changes and update it manually." >&2
      return 1
    }
    return 0
  fi

  echo "Cloning $url -> $dir"
  git clone "$url" "$dir"
}

if [[ "$#" -eq 0 ]]; then
  set -- jiji douyin-api
fi

for tool in "$@"; do
  case "$tool" in
    jiji)
      clone_or_update "jiji262-douyin-downloader" "$JIJI_REPO_URL"
      ;;
    douyin-api)
      clone_or_update "douyin-tiktok-download-api" "$DOUYIN_API_REPO_URL"
      ;;
    tiktokdownloader)
      clone_or_update "joe-anamier-tiktokdownloader" "$TIKTOKDOWNLOADER_REPO_URL"
      ;;
    all)
      clone_or_update "jiji262-douyin-downloader" "$JIJI_REPO_URL"
      clone_or_update "douyin-tiktok-download-api" "$DOUYIN_API_REPO_URL"
      clone_or_update "joe-anamier-tiktokdownloader" "$TIKTOKDOWNLOADER_REPO_URL"
      ;;
    *)
      echo "Unknown downloader tool: $tool" >&2
      echo "Usage: $0 [jiji] [douyin-api] [tiktokdownloader] [all]" >&2
      exit 2
      ;;
  esac
done

echo "Downloader tools are under: $DOWNLOADERS_DIR"
