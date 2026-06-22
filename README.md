# OpenVideo

OpenVideo is a local-first toolkit for analyzing Douyin-style short videos and turning their director, editing, caption, motion, and sound language into reusable generation briefs.

The first version is CLI-first. It focuses on local video files and direct video URLs, then produces artifacts such as `VIDEO_STYLE.md`, `shot-breakdown.json`, `edit-rhythm.json`, and `hyperframes-brief.md`.

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
- yt-dlp is optional for future public-link adapters

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

Planned commands:

```bash
openvideo analyze ./reference.mp4
openvideo brief runs/<run-id> --goal "做一个 AI 工具教程类抖音短视频"
openvideo render runs/<run-id> --prompt "介绍一个能自动生成设计稿的工具"
```

## Project Status

Phase 1 is the CLI foundation. The Douyin-first analysis pipeline is specified in:

```text
docs/superpowers/specs/2026-06-23-openvideo-douyin-first-design.md
```

## License

MIT
