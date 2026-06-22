# OpenVideo Douyin-First Design

Date: 2026-06-23
Status: Approved direction, ready for implementation planning
Repository: `openvideo`
Visibility: public GitHub repository

## Summary

OpenVideo is a local-first video analysis and generation toolkit focused on Douyin-style short videos. Its first version turns a user-provided video file or direct video URL into structured director, editing, motion, caption, and sound analysis. The analysis is then distilled into reusable style contracts and HyperFrames-ready generation briefs so the user can create an original video in the same broad rhythm and craft language without copying the source video's protected expression.

The first implementation is CLI-first. A web workbench can be added later, but the core product must work from the terminal and be Git-managed from day one.

## Goals

1. Make Douyin short-video analysis the default, not a generic video-analysis afterthought.
2. Extract reusable style language across director, editor, motion designer, caption designer, and sound editor viewpoints.
3. Produce durable files that an agent or another tool can read directly.
4. Feed HyperFrames with a practical `hyperframes-brief.md` rather than a vague style summary.
5. Keep the system local-first and transparent: analysis artifacts live on disk, under Git if the user chooses.
6. Keep source-video handling compliant: analyze user-provided or publicly accessible material, do not bypass login, paywalls, private content, or platform restrictions.

## Non-Goals For V1

1. V1 is not a cloud SaaS.
2. V1 does not ship a full web editor.
3. V1 does not guarantee direct Douyin link downloading. It supports local files and direct video URLs first, with a pluggable source adapter reserved for Douyin links.
4. V1 does not clone a video frame-for-frame, reuse source assets, reproduce source copy, impersonate a creator, or remove watermarks.
5. V1 does not do high-end computer vision model fine-tuning. It uses deterministic media probes and agent-readable artifacts first.

## Primary User Journey

1. The user saves or provides a Douyin-style vertical short video.
2. The user runs:

```bash
openvideo analyze ./reference.mp4
```

3. OpenVideo creates a run folder under `runs/`.
4. OpenVideo extracts metadata, representative frames, scene segments, timing signals, caption observations, audio rhythm hints, and edit rhythm notes.
5. OpenVideo writes:

```text
runs/<run-id>/
  input/
    source.mp4
  frames/
    frame-0001.jpg
    frame-0002.jpg
  analysis/
    metadata.json
    shot-breakdown.json
    edit-rhythm.json
    director-notes.md
    caption-style.md
    motion-language.md
    sound-notes.md
  VIDEO_STYLE.md
  hyperframes-brief.md
```

6. The user asks OpenVideo to create a generation brief:

```bash
openvideo brief runs/<run-id> --goal "做一个 AI 工具教程类抖音短视频"
```

7. The user renders an original HyperFrames video:

```bash
openvideo render runs/<run-id> --prompt "介绍一个能自动生成设计稿的工具"
```

## Douyin-First Analysis Model

OpenVideo treats most input as short-form vertical video unless metadata strongly suggests otherwise. The default target assumptions are:

1. Aspect ratio: `9:16`
2. Duration sweet spot: 8 to 90 seconds
3. First 1 to 3 seconds are hook-critical
4. Captions are likely part of the visual identity, not just accessibility text
5. Editing rhythm, beat points, and visible jump cuts are first-class signals
6. Content category changes the analysis lens

### Content Categories

V1 classifies the video into one primary category and may add secondary tags:

1. `product-demo`: product, app, workflow, AI tool, screen recording, feature reveal
2. `talking-head`:口播, commentary, advice, founder/personality content
3. `knowledge`:教程, explainers, educational breakdowns
4. `commerce`:带货, product selling, offer, testimonial
5. `lifestyle`:探店, travel, daily life, aesthetic montage
6. `story`:剧情, skit, transformation, before/after
7. `cinematic-ad`:广告片, high-production-value brand or mood film
8. `motion-graphic`:mostly typography, charts, UI, graphics, and transitions

The category controls which analysis sections are emphasized. For example, `talking-head` emphasizes hook phrasing, caption density, jump cuts, and retention beats; `cinematic-ad` emphasizes shot scale, camera movement, mood progression, and audio dynamics.

## Analysis Angles

### Universal Layer

Every run produces:

1. Duration, aspect ratio, resolution, frame rate, codec, audio presence
2. Scene count estimate and average scene duration
3. Visual density: low, medium, high
4. Motion intensity: low, medium, high
5. Caption presence and caption density
6. Hook window summary for the first 3 seconds
7. Ending pattern: CTA, reveal, loop, unresolved, recap, punchline

### Director Layer

The director layer describes what the camera and subject are doing:

1. Shot scale: extreme close-up, close-up, medium, wide, screen capture, graphic frame
2. Camera movement: static, push-in, pull-out, pan, tilt, handheld, digital zoom, screen scroll
3. Subject blocking: centered, rule-of-thirds, split-screen, over-shoulder, product-in-hand
4. Emotional progression: curiosity, tension, proof, relief, desire, urgency
5. Visual motif: repeated framing, repeated action, repeated prop, repeated UI surface

### Editing Layer

The editing layer describes how time is shaped:

1. Cut timestamps and estimated cut reasons
2. Cut type: hard cut, jump cut, match cut, whip, zoom cut, wipe, overlay reveal, text-driven cut
3. Pacing curve: front-loaded, accelerating, pulsed, steady, slow-build, reveal-driven
4. Retention beats: pattern interrupt, visual proof, surprising claim, before/after, list progression
5. Loop mechanics: ending links back to opening, repeated phrase, unresolved final frame

### Motion Layer

The motion layer turns visual movement into reusable HyperFrames instructions:

1. Text entrance style: mask reveal, pop, typewriter, slide, scale, bounce, kinetic stagger
2. Text emphasis: color swap, outline, underline, highlight bar, zoom punch, shake
3. Graphic motion: card slide, UI zoom, cursor trace, spotlight, callout line, chart reveal
4. Transition grammar: snap cut, motion blur, scale cut, overlay wipe, flash, glitch
5. Timing hints: entrance duration, hold duration, exit duration, easing family

### Caption Layer

Caption analysis is separate because Douyin captions often drive retention:

1. Position: top, center, lower third, mixed, safe-area aware
2. Line count and words per line
3. Font weight and approximate style
4. Color, stroke, shadow, background chip, highlight words
5. Punctuation style and pacing
6. Keywords emphasized per beat

### Sound Layer

V1 does not need full music source separation. It records practical editing cues:

1. Audio present or silent
2. Speech likely present
3. Music likely present
4. Beat density estimate
5. Strong onset timestamps when detectable
6. Sound-effect moments such as whoosh, click, pop, impact when obvious
7. Relationship between cuts and beats

## Style Contracts

### `VIDEO_STYLE.md`

This is the human-readable reusable contract. It includes:

1. Category and target format
2. Hook formula
3. Visual language
4. Director notes
5. Editing rhythm
6. Caption system
7. Motion grammar
8. Sound guidance
9. Things not to copy

The "things not to copy" section is mandatory. It prevents the generated video from reusing protected expression such as exact wording, creator identity, logos, watermarks, or distinctive source frames.

### JSON Files

The JSON files are machine-readable. They must be stable enough for future web UI and automation:

1. `metadata.json`: source, probe results, run config, tool versions
2. `shot-breakdown.json`: scene and shot observations
3. `edit-rhythm.json`: cuts, durations, pacing, retention beats

### `hyperframes-brief.md`

This file translates analysis into generation instructions:

1. Target duration and aspect ratio
2. Scene list with timestamps
3. Layout instructions
4. Caption and kinetic type instructions
5. Transition and easing instructions
6. Asset needs
7. Render notes for HyperFrames

## Architecture

V1 is a TypeScript monorepo-sized single package, not a full multi-service app.

```text
openvideo/
  package.json
  tsconfig.json
  src/
    cli/
      index.ts
      commands/
        analyze.ts
        brief.ts
        render.ts
    analysis/
      probe.ts
      frames.ts
      shots.ts
      rhythm.ts
      captions.ts
      sound.ts
      style-contract.ts
    sources/
      local-file.ts
      direct-url.ts
      douyin.ts
    hyperframes/
      brief.ts
      render.ts
    project/
      run-store.ts
      paths.ts
    utils/
      exec.ts
      json.ts
      ids.ts
  tests/
  docs/
```

### CLI Layer

The CLI is the primary interface:

```bash
openvideo analyze <file-or-url> [--out runs] [--full] [--category auto|product-demo|talking-head|knowledge|commerce|lifestyle|story|cinematic-ad|motion-graphic]
openvideo brief <run-dir> --goal <text>
openvideo render <run-dir> --prompt <text> [--output output.mp4]
openvideo doctor
```

`doctor` checks for `ffmpeg`, `ffprobe`, Node version, HyperFrames CLI, and optional link adapters such as `yt-dlp`.

### Source Layer

Source adapters normalize input into a local source file:

1. `local-file`: copies or references a local MP4/MOV/WebM
2. `direct-url`: downloads a direct media URL when the content type is video
3. `douyin`: V1 explanatory adapter that detects likely Douyin share URLs, explains supported input paths, and points to optional legal dependencies; it must not bypass login, private access, watermarks, platform controls, or anti-abuse protections

### Analysis Layer

The analysis layer starts deterministic:

1. `ffprobe` for metadata
2. `ffmpeg` scene detection and frame extraction
3. audio waveform or onset heuristics where possible
4. image-frame sampling for later multimodal LLM analysis
5. typed JSON writers with schema-like validation

V1 may use LLM assistance for narrative classification and style summarization if configured, but deterministic artifacts must exist even without an API key.

### HyperFrames Layer

V1 integrates HyperFrames in two levels:

1. `brief`: generate a HyperFrames-ready plan without rendering
2. `render`: scaffold a HyperFrames composition and render an MP4

The render path should prefer the installed `hyperframes` CLI. If HyperFrames is missing, `openvideo doctor` and `openvideo render` must show clear installation guidance instead of failing with a raw stack trace.

## Error Handling

1. Unsupported file type: say which extensions are supported.
2. Missing `ffmpeg` or `ffprobe`: show install command hints.
3. Direct URL is not a media file: explain that V1 needs local file or direct video URL.
4. Douyin share URL cannot be resolved: explain that V1 does not bypass platform access and suggest downloading the user's own video file.
5. HyperFrames missing: analysis and brief still work; render is disabled.
6. Empty or too-short video: fail with a clear minimum duration message.
7. Long video: warn and sample only the first configured window unless `--full` is passed.

## Testing Strategy

1. Unit-test path handling, JSON writers, CLI argument parsing, and category normalization.
2. Use tiny synthetic fixture videos generated by `ffmpeg` for probe, frame extraction, and scene detection tests.
3. Snapshot-test `VIDEO_STYLE.md` and `hyperframes-brief.md` for stable structure.
4. Test `doctor` with mocked dependency availability.
5. Keep render tests optional or smoke-level because browser/FFmpeg rendering can be slow.

## Public Repository Defaults

The public repo should start with:

1. MIT license
2. README explaining local-first Douyin-style video analysis
3. Clear safety statement about user-provided videos and no platform bypass
4. CLI-first quickstart
5. `docs/superpowers/specs/2026-06-23-openvideo-douyin-first-design.md` as the initial design record

## Implementation Phases

### Phase 1: Project Foundation

Create the TypeScript CLI package, README, license, formatting baseline, `doctor`, and GitHub repository.

### Phase 2: Deterministic Analyzer

Implement source normalization, `ffprobe`, frame extraction, scene detection, metadata JSON, and run folder creation.

### Phase 3: Douyin Style Contracts

Implement category classification heuristics, director/editing/motion/caption/sound markdown and JSON outputs, plus `VIDEO_STYLE.md`.

### Phase 4: HyperFrames Brief

Generate `hyperframes-brief.md` from the analysis files and user goal.

### Phase 5: HyperFrames Render MVP

Scaffold a simple vertical HyperFrames composition from the brief and render an MP4 when HyperFrames is available.

### Phase 6: Optional Douyin Link Adapter

Add a source adapter that can use user-installed legal tooling when available. The adapter must remain transparent and must refuse private, login-gated, or inaccessible content.

## Acceptance Criteria For V1

1. `openvideo doctor` reports dependency status.
2. `openvideo analyze ./fixture.mp4` creates a run folder with all required analysis files.
3. `VIDEO_STYLE.md` includes hook, director, editing, motion, caption, sound, and safety sections.
4. `hyperframes-brief.md` contains a scene-by-scene vertical short-video plan.
5. Missing optional tools produce actionable messages.
6. The repository is public on GitHub under the `openvideo` name.
