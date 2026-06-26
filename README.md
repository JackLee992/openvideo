# OpenVideo

OpenVideo is a local-first toolkit for analyzing Douyin-style short videos and turning their director, editing, caption, motion, and sound language into reusable generation briefs.

The `v0.2.0` release is CLI-first. It focuses on local video files, direct video URLs, and public platform URLs that downloader providers can resolve, then produces artifacts such as `VIDEO_STYLE.md`, `shot-breakdown.json`, `edit-rhythm.json`, `analysis/report.md`, `analysis/transcript-readable.md`, and `hyperframes-brief.md`.

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
- HyperFrames CLI for rendering and optional ASR transcription
- yt-dlp for Douyin/TikTok-style public platform links
- Tesseract OCR for sampled-frame caption text extraction
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

For Douyin links that require a logged-in browser session, export cookies with QR-code login first:

```bash
npm install --save-dev playwright
openvideo auth douyin \
  --out .openvideo/cookies/douyin-cookies.txt \
  --storage .openvideo/cookies/douyin-storage.json
openvideo analyze "https://v.douyin.com/..." \
  --downloader auto \
  --cookies .openvideo/cookies/douyin-cookies.txt \
  --storage .openvideo/cookies/douyin-storage.json \
  --min-duration 90
```

OpenVideo uses your installed Google Chrome for Playwright browser flows by default. Set `OPENVIDEO_PLAYWRIGHT_CHANNEL=bundled` and run `npx playwright install chromium` if you prefer Playwright's bundled Chromium.

Download first, then inspect the downloaded file:

```bash
openvideo download "https://www.douyin.com/video/..." --downloader auto
```

When a public platform URL needs your normal browser session, pass cookies to `yt-dlp`:

```bash
openvideo download "https://www.douyin.com/video/..." --downloader yt-dlp --cookies-from-browser chrome
openvideo analyze "https://www.douyin.com/video/..." --downloader yt-dlp --cookies ./cookies.txt
```

If cookie-only HTTP downloaders fail because the platform requires browser-generated page state, use the browser downloader. It opens Chromium, lets the real page generate the playable `<video>` URL, then downloads that media into `source.mp4`:

```bash
openvideo download "https://www.douyin.com/video/..." \
  --downloader browser \
  --cookies .openvideo/cookies/douyin-cookies.txt \
  --storage .openvideo/cookies/douyin-storage.json \
  --min-duration 90

openvideo analyze "https://www.douyin.com/video/..." \
  --downloader browser \
  --cookies .openvideo/cookies/douyin-cookies.txt \
  --storage .openvideo/cookies/douyin-storage.json \
  --min-duration 90 \
  --full
```

`--min-duration` makes real-platform runs fail fast when a provider returns a short preview instead of the full video. Every successful `openvideo download` also writes `download-diagnostics.json` with provider attempts, captured media metadata, and preview-check status.

Clone Douyin-specific fallback tools:

```bash
scripts/downloaders/clone-downloaders.sh
python3 -m venv .openvideo/downloaders/jiji262-douyin-downloader/.venv
.openvideo/downloaders/jiji262-douyin-downloader/.venv/bin/pip install -r .openvideo/downloaders/jiji262-douyin-downloader/requirements.txt
export OPENVIDEO_JIJI_PYTHON_COMMAND="$PWD/.openvideo/downloaders/jiji262-douyin-downloader/.venv/bin/python3"
openvideo download "https://www.douyin.com/video/..." --downloader jiji
```

Enable OCR for Chinese and English captions:

```bash
brew install tesseract tesseract-lang
export OPENVIDEO_OCR_LANG=chi_sim+eng
```

Tune ASR transcription for Douyin-style speech:

```bash
export OPENVIDEO_TRANSCRIBE_MODEL=small
export OPENVIDEO_TRANSCRIBE_LANGUAGE=zh
```

Use an already-running Douyin API service as the final fallback:

```bash
export OPENVIDEO_DOUYIN_API_BASE_URL=http://127.0.0.1:8080
openvideo download "https://www.douyin.com/video/..." --downloader douyin-api
```

Run an opt-in real Douyin smoke test:

```bash
OPENVIDEO_SMOKE_DOUYIN_URL="https://www.douyin.com/video/..." npm run smoke:douyin
```

Useful overrides:

```bash
OPENVIDEO_SMOKE_DOWNLOADER=jiji
OPENVIDEO_SMOKE_CATEGORY=knowledge
OPENVIDEO_SMOKE_DIR=.openvideo/smoke/douyin
OPENVIDEO_SMOKE_COOKIES=./cookies.txt
OPENVIDEO_SMOKE_COOKIES_FROM_BROWSER=chrome
```

Run the checked-in real Douyin sample workflow with QR-code login, browser download, duration validation, and HyperFrames ASR:

```bash
OPENVIDEO_AUTH=1 \
OPENVIDEO_SAMPLE_MIN_DURATION_SEC=90 \
scripts/samples/analyze-real-douyin.sh \
  "https://v.douyin.com/HNHOupn_zYI/" \
  shanghai-12345-committee \
  auto
```

The real sample reports live in `samples/real-douyin/`. They keep only links, commands, metrics, and human-readable analysis in Git; raw videos, cookies, browser storage, and signed media URLs stay under `.openvideo/`.

Run all manifest-backed real samples:

```bash
scripts/samples/run-real-douyin-manifest.sh
```

This creates a run folder under `runs/` with `VIDEO_STYLE.md`, `hyperframes-brief.md`, sampled frames, and analysis files.
`shot-breakdown.json` and `edit-rhythm.json` include ffmpeg-based scene cut detection for deterministic first-pass shot ranges.
`storyboard.json`, `transition-analysis.json`, and `editor-notes.md` organize scenes into hook/proof/payoff beats, pacing roles, and cut-type evidence for director/editor review.
`motion-analysis.json` estimates visual motion, dominant direction, and camera movement hints such as locked-off, pan/reframe, or push-in/graphic motion.
`edit-rhythm.json` and `sound-notes.md` also include ffmpeg-based sound-start cues from silence detection when the source has audio.
`captions.json` and `caption-style.md` include optional Tesseract OCR observations from sampled frames when OCR is installed.
`transcript.json` and `script-notes.md` include optional HyperFrames ASR word timestamps when the source has audio and transcription is available.

Generate a human-readable report and local browser workbench from an analyzed run:

```bash
openvideo report runs/<run-id>
```

This writes `analysis/report.md`, `analysis/transcript-readable.md`, and `report/index.html`. The browser workbench brings run metadata, storyboard timeline, transition table, motion/camera summary, OCR evidence, ASR transcript, HyperFrames brief, and sampled frames into one page.

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

`v0.2.0` is usable for repeatable local-first video analysis, authenticated Douyin sample runs, and first-pass human-readable reporting:

- QR-code Douyin login through `openvideo auth douyin`
- downloader fallback providers: `yt-dlp`, browser-backed capture, jiji, and Douyin API
- preview-media detection with `--min-duration` and `download-diagnostics.json`
- deterministic analysis artifacts for frames, scenes, motion, audio cues, OCR captions, and HyperFrames ASR
- `report` command for `analysis/report.md`, segmented `analysis/transcript-readable.md`, and `report/index.html`
- `brief` and `render` preparation commands for downstream HyperFrames workflows
- manifest-backed real Douyin sample reports and regression scripts under `samples/real-douyin/`

Known limitations:

- Douyin login state can expire and may need QR-code refresh.
- Some pages can still serve preview media if browser storage is incomplete; use `--min-duration` and inspect `download-diagnostics.json`.
- Chinese OCR and ASR segmentation are useful first passes, but still need human review for publication-grade reports.

The Douyin-first analysis system is specified in:

```text
docs/superpowers/plans/2026-06-23-openvideo-phase-1-foundation.md
docs/superpowers/plans/2026-06-26-openvideo-phase-2-deterministic-analyze.md
```

Downloader provider details live in:

```text
docs/downloaders.md
```

## License

MIT
