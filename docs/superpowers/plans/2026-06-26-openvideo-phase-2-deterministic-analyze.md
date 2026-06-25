# OpenVideo Phase 2 Deterministic Analyze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `openvideo analyze <file-or-url>` so a local file or direct video URL creates a run folder with deterministic metadata, frames, analysis JSON, `VIDEO_STYLE.md`, and `hyperframes-brief.md`.

**Architecture:** Add a small source-normalization layer, a run-store layer, and an analyzer orchestrator with injectable media operations for tests. Real CLI execution uses `ffprobe` for metadata and `ffmpeg` for representative frame extraction, while tests mock those expensive commands.

**Tech Stack:** Node 24+, TypeScript, Vitest, `fs/promises`, `child_process.spawn`, `fetch`, ffmpeg, ffprobe.

## Global Constraints

- Repository name is `openvideo`.
- Repository visibility is public.
- First version is CLI-first.
- Primary product focus is Douyin-style short video analysis.
- V1 supports local video files and direct video URLs first.
- V1 must not bypass login, paywalls, private content, watermarks, platform controls, or anti-abuse protections.
- Analysis and brief generation must still be possible when HyperFrames is missing; rendering is disabled with a clear message.

---

## File Structure

- `src/project/paths.ts`: Slug, run-id, and run-directory helpers.
- `src/sources/source.ts`: Input normalization for local files and direct video URLs.
- `src/analysis/probe.ts`: `ffprobe` wrapper and metadata shape.
- `src/analysis/frames.ts`: `ffmpeg` representative-frame extraction wrapper.
- `src/analysis/artifacts.ts`: Analysis JSON/Markdown writers.
- `src/analysis/analyze.ts`: Main orchestration function.
- `src/cli/commands/analyze.ts`: CLI flag parsing and user-facing command runner.
- `src/cli/index.ts`: Dispatch `analyze`.
- `tests/source.test.ts`: Source normalization behavior.
- `tests/analyze.test.ts`: Analyzer orchestration with mocked media ops.
- `tests/cli-analyze.test.ts`: CLI error behavior for missing input.
- `README.md`: Mark `analyze` as available and show first command.
- `.gitignore`: Ignore local temp output if needed.

---

### Task 1: Source Normalization And Run Paths

**Files:**
- Create: `src/project/paths.ts`
- Create: `src/sources/source.ts`
- Test: `tests/source.test.ts`

**Interfaces:**
- Produces: `createRunId(input: string, now?: Date): string`.
- Produces: `createRunLayout(outDir: string, runId: string): RunLayout`.
- Produces: `normalizeSource(input: string, layout: RunLayout, options?: NormalizeSourceOptions): Promise<NormalizedSource>`.
- Later tasks consume `RunLayout` and `NormalizedSource`.

- [ ] **Step 1: Write failing source tests**

Create `tests/source.test.ts` with tests for local file copying, unsupported extensions, and direct video URL downloading with an injected fetch.

- [ ] **Step 2: Run source tests and verify failure**

Run `npm test -- tests/source.test.ts`.

Expected: FAIL because `src/project/paths.ts` and `src/sources/source.ts` do not exist.

- [ ] **Step 3: Implement run paths and source normalization**

Implement:

```ts
export interface RunLayout {
  runId: string;
  runDir: string;
  inputDir: string;
  framesDir: string;
  analysisDir: string;
}
```

and source normalization:

```ts
export interface NormalizedSource {
  kind: 'local-file' | 'direct-url';
  originalInput: string;
  fileName: string;
  localPath: string;
}
```

Local files must allow `.mp4`, `.mov`, `.webm`, and `.m4v`. Direct URLs must require `http:` or `https:` and either a `video/*` content type or a known video extension.

- [ ] **Step 4: Run source tests and verify pass**

Run `npm test -- tests/source.test.ts`.

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/project/paths.ts src/sources/source.ts tests/source.test.ts
git commit -m "feat: normalize analyze sources"
```

---

### Task 2: Probe, Frames, And Artifact Writers

**Files:**
- Create: `src/analysis/probe.ts`
- Create: `src/analysis/frames.ts`
- Create: `src/analysis/artifacts.ts`
- Test: `tests/analyze.test.ts`

**Interfaces:**
- Produces: `probeVideo(inputPath: string): Promise<VideoMetadata>`.
- Produces: `extractFrames(inputPath: string, framesDir: string, options?: ExtractFramesOptions): Promise<ExtractedFrame[]>`.
- Produces: `writeAnalysisArtifacts(input: AnalysisArtifactInput): Promise<AnalysisArtifactResult>`.
- Later tasks consume these functions from `analyzeVideo`.

- [ ] **Step 1: Write failing artifact tests**

Create `tests/analyze.test.ts` with a mocked metadata object and mocked frame list. Assert that `writeAnalysisArtifacts` creates:

```text
analysis/metadata.json
analysis/shot-breakdown.json
analysis/edit-rhythm.json
analysis/director-notes.md
analysis/caption-style.md
analysis/motion-language.md
analysis/sound-notes.md
VIDEO_STYLE.md
hyperframes-brief.md
```

- [ ] **Step 2: Run artifact tests and verify failure**

Run `npm test -- tests/analyze.test.ts`.

Expected: FAIL because analysis modules do not exist.

- [ ] **Step 3: Implement probe, frame extraction, and artifact writers**

Use `ffprobe -v quiet -print_format json -show_format -show_streams <file>` for metadata. Use `ffmpeg -y -i <file> -vf fps=1/2 -frames:v 12 <framesDir>/frame-%04d.jpg` for frames. Artifact writers should create deterministic skeletons from metadata and frames, not invoke an LLM.

- [ ] **Step 4: Run artifact tests and verify pass**

Run `npm test -- tests/analyze.test.ts`.

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/analysis/probe.ts src/analysis/frames.ts src/analysis/artifacts.ts tests/analyze.test.ts
git commit -m "feat: write deterministic analysis artifacts"
```

---

### Task 3: Analyze Orchestrator And CLI

**Files:**
- Create: `src/analysis/analyze.ts`
- Create: `src/cli/commands/analyze.ts`
- Modify: `src/cli/index.ts`
- Modify: `tests/analyze.test.ts`
- Create: `tests/cli-analyze.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `normalizeSource`, `probeVideo`, `extractFrames`, and `writeAnalysisArtifacts`.
- Produces: `analyzeVideo(input: AnalyzeInput, deps?: AnalyzeDeps): Promise<AnalyzeResult>`.
- Produces: `runAnalyze(argv: string[], io?: CliIO): Promise<number>`.

- [ ] **Step 1: Write failing orchestrator and CLI tests**

Extend `tests/analyze.test.ts` to call `analyzeVideo` with injected `probe` and `extractFrames` functions. Create `tests/cli-analyze.test.ts` for missing input returning exit code 2 with usage text.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/analyze.test.ts tests/cli-analyze.test.ts
```

Expected: FAIL because `analyzeVideo` and `runAnalyze` do not exist.

- [ ] **Step 3: Implement analyze orchestrator and CLI dispatch**

`openvideo analyze <file-or-url> [--out runs] [--full] [--category <category>]` should create a run, normalize the source, probe it, extract frames, write all artifacts, and print:

```text
Created run: <run-dir>
Wrote VIDEO_STYLE.md
Wrote hyperframes-brief.md
```

- [ ] **Step 4: Run tests and verify pass**

Run `npm test`.

Expected: PASS.

- [ ] **Step 5: Update README**

Move `openvideo analyze ./reference.mp4` from "planned" to "available" and keep `brief` / `render` listed as planned next commands.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/analysis/analyze.ts src/cli/commands/analyze.ts src/cli/index.ts tests/analyze.test.ts tests/cli-analyze.test.ts README.md
git commit -m "feat: add analyze command"
```

---

### Task 4: Real ffmpeg Smoke And Push

**Files:**
- Modify: none expected unless smoke reveals a defect.

**Interfaces:**
- Consumes: all Phase 2 work.
- Produces: pushed GitHub branch with `openvideo analyze` MVP.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run doctor
```

Expected: all commands exit 0.

- [ ] **Step 2: Run a real analyze smoke**

Create a synthetic vertical fixture in `/tmp` with ffmpeg and run:

```bash
tmpdir=$(mktemp -d)
ffmpeg -y -f lavfi -i testsrc2=size=720x1280:rate=30 -f lavfi -i sine=frequency=880:sample_rate=44100 -t 2 -pix_fmt yuv420p "$tmpdir/reference.mp4"
npm run dev -- analyze "$tmpdir/reference.mp4" --out "$tmpdir/runs" --category product-demo
find "$tmpdir/runs" -maxdepth 3 -type f | sort
```

Expected: output includes `VIDEO_STYLE.md`, `hyperframes-brief.md`, and files under `analysis/` and `frames/`.

- [ ] **Step 3: Commit smoke fixes if needed**

If smoke reveals a defect, add a focused failing test, fix it, and commit with a precise message.

- [ ] **Step 4: Push branch**

Run:

```bash
git push -u origin phase-1-foundation
```

Expected: branch is pushed to GitHub for sync.

---

## Self-Review Notes

- Spec coverage: This plan covers Phase 2 deterministic analyzer, source normalization, metadata probing, frame extraction, run folder creation, and all required analysis files.
- Intentional gaps: richer scene detection, LLM summarization, Douyin share-link adapter, HyperFrames render, and web UI remain later phases.
- Placeholder scan: no unresolved placeholder markers are allowed in this plan.
- Type consistency: `RunLayout`, `NormalizedSource`, `VideoMetadata`, `ExtractedFrame`, `AnalyzeInput`, `AnalyzeDeps`, and `AnalyzeResult` are named before downstream use.

