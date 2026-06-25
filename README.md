# OpenVideo

OpenVideo is a local-first toolkit for analyzing Douyin-style short videos and turning their director, editing, caption, motion, and sound language into reusable generation briefs.

The first version is CLI-first. It focuses on local video files, direct video URLs, and public platform URLs that downloader providers can resolve, then produces artifacts such as `VIDEO_STYLE.md`, `shot-breakdown.json`, `edit-rhythm.json`, and `hyperframes-brief.md`.

## Why

Short videos are not just colors and fonts. A useful breakdown needs to capture:

- the hook in the first 1-3 seconds
- shot scale and camera movement
- cut timing and pacing curve
- caption position, density, and emphasis
- motion grammar for text and graphics
- audio and beat relationships

OpenVideo turns those observations into a reusable style contract for original videos.

## Safety And Platform Boundaries

OpenVideo is designed for videos you own, have permission to analyze, or can access publicly. It does not bypass login, private content, paywalls, watermarks, anti-abuse controls, or platform restrictions. The goal is style abstraction and original creation, not cloning a creator's exact video, wording, identity, or assets.

## Requirements

- Node.js 24+
- ffmpeg and ffprobe for analysis
- HyperFrames CLI for rendering
- yt-dlp for Douyin/TikTok-style public platform links
- optional cloned Douyin-specific downloaders under `.openvideo/downloaders/`

Check your machine:

```bash
npm run doctor
```

## Quickstart

```bash
npm install
npm run doctor
npm run build
```

Analyze a local video file or direct video URL:

```bash
openvideo analyze ./reference.mp4
openvideo analyze https://example.com/video.mp4
```

Analyze a supported public platform URL:

```bash
brew install yt-dlp
openvideo analyze "https://www.douyin.com/video/..."
```

Download first, then inspect the downloaded file:

```bash
openvideo download "https://www.douyin.com/video/..." --downloader auto
```

Clone Douyin-specific fallback tools:

```bash
scripts/downloaders/clone-downloaders.sh
openvideo download "https://www.douyin.com/video/..." --downloader jiji
```

This creates a run folder under `runs/` with `VIDEO_STYLE.md`, `hyperframes-brief.md`, sampled frames, and analysis files.

Create a goal-specific generation brief from an analyzed run:

```bash
openvideo brief runs/<run-id> --goal "做一个 AI 工具教程类抖音短视频"
```

Prepare a HyperFrames render project from the generation brief:

```bash
openvideo render runs/<run-id> --prompt "介绍一个能自动生成设计稿的工具"
```

The render command prepares `renders/<run-id>/index.html` and `OPENVIDEO_RENDER.md`. Preview and final MP4 rendering stay explicit:

```bash
cd renders/<run-id>
npx hyperframes lint
npx hyperframes validate
npx hyperframes preview
npx hyperframes render --quality draft --output out.mp4
```

## Project Status

Phase 2 adds the deterministic `analyze` pipeline. The Douyin-first analysis system is specified in:

```text
docs/superpowers/specs/2026-06-23-openvideo-douyin-first-design.md
```

Downloader provider details live in:

```text
docs/downloaders.md
```

## License

MIT
