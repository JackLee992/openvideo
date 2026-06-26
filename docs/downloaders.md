# OpenVideo Downloaders

OpenVideo treats third-party Douyin downloaders as external tools. We clone them completely into a local workspace and call their CLIs as fallback providers. Their source code is not copied into OpenVideo.

## Local Tool Workspace

Default path:

```bash
.openvideo/downloaders/
```

This folder is ignored by git. Override it when needed:

```bash
export OPENVIDEO_DOWNLOADERS_DIR=/absolute/path/to/downloaders
```

## Clone Recommended Tools

```bash
scripts/downloaders/clone-downloaders.sh
```

Default tools:

- `jiji`: `jiji262/douyin-downloader`, MIT, CLI-first Douyin downloader.
- `douyin-api`: `Evil0ctal/Douyin_TikTok_Download_API`, Apache-2.0, service/API-oriented fallback.

Optional local-only tool:

```bash
scripts/downloaders/clone-downloaders.sh tiktokdownloader
```

`JoeanAmier/TikTokDownloader` is feature-rich but GPLv3, so keep it as an external local tool unless we explicitly decide to adopt GPL obligations for a combined distribution.

## Forking And Enhancement

If a downloader needs changes, fork it and point OpenVideo's clone script to the fork:

```bash
export OPENVIDEO_JIJI_REPO_URL=https://github.com/JackLee992/douyin-downloader.git
scripts/downloaders/clone-downloaders.sh jiji
```

The runtime adapter can also point at a custom clone:

```bash
export OPENVIDEO_JIJI_DOWNLOADER_DIR=/absolute/path/to/jiji262-douyin-downloader
openvideo download "https://www.douyin.com/video/..." --downloader jiji
```

## Current Provider Order

```text
auto -> yt-dlp -> jiji -> douyin-api
```

`yt-dlp` remains the default first provider because it is broadly maintained and lightweight to call from Node. `jiji` is the first Douyin-specific fallback. `douyin-api` calls an already-running `Douyin_TikTok_Download_API` service through `/api/download`; set `OPENVIDEO_DOUYIN_API_BASE_URL` when it is not running at `http://127.0.0.1:80`.
