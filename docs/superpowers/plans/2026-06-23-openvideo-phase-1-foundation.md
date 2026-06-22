# OpenVideo Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable public OpenVideo foundation: TypeScript CLI package, `openvideo doctor`, README, MIT license, tests, and GitHub-ready project metadata.

**Architecture:** Keep Phase 1 intentionally small: one Node/TypeScript package with a CLI entrypoint and pure helper modules that can be tested without shelling out to real tools. The CLI exposes the future command shape but only `doctor` performs real work in Phase 1.

**Tech Stack:** Node 24+, TypeScript, Vitest, npm scripts, ESM, `child_process.spawn` for dependency checks.

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

- `package.json`: Package metadata, CLI bin, scripts, dev dependencies.
- `tsconfig.json`: Strict TypeScript ESM configuration.
- `vitest.config.ts`: Vitest config for TypeScript tests.
- `.gitignore`: Node build output, dependencies, runtime runs, and OS files.
- `src/cli/index.ts`: CLI argument parsing, help output, command dispatch.
- `src/cli/commands/doctor.ts`: Doctor report types, injectable dependency checker, human-readable output.
- `src/utils/exec.ts`: Small process helpers for checking command availability and reading a version line.
- `tests/cli-help.test.ts`: CLI help behavior and unknown-command behavior.
- `tests/doctor.test.ts`: Doctor report generation with mocked dependency checks.
- `README.md`: Public project intro, safety stance, quickstart, command list.
- `LICENSE`: MIT license.

---

### Task 1: TypeScript CLI Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/cli/index.ts`
- Test: `tests/cli-help.test.ts`

**Interfaces:**
- Produces: `runCli(argv: string[], io?: CliIO): Promise<number>` from `src/cli/index.ts`.
- Produces: `printHelp(io: CliIO): void` from `src/cli/index.ts`.
- Later tasks consume `runCli` to dispatch `doctor`.

- [ ] **Step 1: Write the failing CLI help test**

Create `tests/cli-help.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { runCli, type CliIO } from '../src/cli/index.js';

function createIO(): CliIO & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    writeOut: (line) => stdout.push(line),
    writeErr: (line) => stderr.push(line),
  };
}

describe('openvideo cli help', () => {
  it('prints help with the planned command surface', async () => {
    const io = createIO();

    const exitCode = await runCli(['--help'], io);

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Usage: openvideo <command>');
    expect(io.stdout.join('\n')).toContain('doctor');
    expect(io.stdout.join('\n')).toContain('analyze <file-or-url>');
    expect(io.stdout.join('\n')).toContain('brief <run-dir>');
    expect(io.stdout.join('\n')).toContain('render <run-dir>');
  });

  it('returns exit code 2 for unknown commands', async () => {
    const io = createIO();

    const exitCode = await runCli(['wat'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Unknown command: wat');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/cli-help.test.ts
```

Expected: FAIL because `package.json`, Vitest config, and `src/cli/index.ts` do not exist yet.

- [ ] **Step 3: Create package metadata and TypeScript config**

Create `package.json`:

```json
{
  "name": "openvideo",
  "version": "0.1.0",
  "description": "Douyin-first short video analysis and HyperFrames generation toolkit.",
  "type": "module",
  "bin": {
    "openvideo": "./dist/cli/index.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "dev": "tsx src/cli/index.ts",
    "doctor": "tsx src/cli/index.ts doctor"
  },
  "keywords": [
    "douyin",
    "short-video",
    "video-analysis",
    "hyperframes",
    "cli"
  ],
  "license": "MIT",
  "engines": {
    "node": ">=24"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.20.0",
    "typescript": "^5.8.0",
    "vitest": "^4.0.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
runs/
.DS_Store
.env
.env.*
!.env.example
coverage/
```

- [ ] **Step 4: Implement the CLI skeleton**

Create `src/cli/index.ts`:

```ts
#!/usr/bin/env node

export interface CliIO {
  writeOut: (line: string) => void;
  writeErr: (line: string) => void;
}

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

const HELP_TEXT = `Usage: openvideo <command> [options]

Commands:
  doctor                         Check local dependencies
  analyze <file-or-url>           Analyze a local video file or direct video URL
  brief <run-dir>                 Generate a HyperFrames-ready brief from a run
  render <run-dir>                Render an original video from a run brief

Examples:
  openvideo doctor
  openvideo analyze ./reference.mp4
  openvideo brief runs/2026-06-23-demo --goal "做一个 AI 工具教程类抖音短视频"
  openvideo render runs/2026-06-23-demo --prompt "介绍一个能自动生成设计稿的工具"
`;

export function printHelp(io: CliIO = DEFAULT_IO): void {
  io.writeOut(HELP_TEXT);
}

export async function runCli(argv: string[], io: CliIO = DEFAULT_IO): Promise<number> {
  const [command] = argv;
  if (!command || command === '--help' || command === '-h') {
    printHelp(io);
    return 0;
  }

  if (command === 'doctor') {
    io.writeErr('The doctor command is not implemented yet.');
    return 2;
  }

  if (command === 'analyze' || command === 'brief' || command === 'render') {
    io.writeErr(`The ${command} command is planned but not implemented in Phase 1.`);
    return 2;
  }

  io.writeErr(`Unknown command: ${command}`);
  io.writeErr('Run `openvideo --help` for usage.');
  return 2;
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href;
if (isDirectRun) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
```

- [ ] **Step 5: Run the CLI help test to verify it passes**

Run:

```bash
npm install
npm test -- tests/cli-help.test.ts
```

Expected: PASS for `tests/cli-help.test.ts`.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/cli/index.ts tests/cli-help.test.ts
git commit -m "feat: scaffold openvideo cli"
```

---

### Task 2: Doctor Dependency Report

**Files:**
- Create: `src/utils/exec.ts`
- Create: `src/cli/commands/doctor.ts`
- Modify: `src/cli/index.ts`
- Test: `tests/doctor.test.ts`

**Interfaces:**
- Consumes: `runCli(argv, io)` from Task 1.
- Produces: `createDoctorReport(checker?: DependencyChecker): Promise<DoctorReport>`.
- Produces: `formatDoctorReport(report: DoctorReport): string`.
- Produces: `runDoctor(io?: CliIO): Promise<number>`.

- [ ] **Step 1: Write the failing doctor test**

Create `tests/doctor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createDoctorReport,
  formatDoctorReport,
  type DependencyChecker,
} from '../src/cli/commands/doctor.js';
import { runCli, type CliIO } from '../src/cli/index.js';

function createIO(): CliIO & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    writeOut: (line) => stdout.push(line),
    writeErr: (line) => stderr.push(line),
  };
}

describe('doctor report', () => {
  it('reports required and optional dependency status', async () => {
    const checker: DependencyChecker = async (command) => ({
      command,
      found: command !== 'yt-dlp',
      version: command === 'ffmpeg' ? 'ffmpeg version 8.1.2' : undefined,
    });

    const report = await createDoctorReport(checker);

    expect(report.required.ffmpeg.found).toBe(true);
    expect(report.required.ffprobe.found).toBe(true);
    expect(report.optional.hyperframes.found).toBe(true);
    expect(report.optional['yt-dlp'].found).toBe(false);
    expect(report.readyForAnalyze).toBe(true);
    expect(report.readyForRender).toBe(true);
  });

  it('formats actionable missing dependency guidance', async () => {
    const checker: DependencyChecker = async (command) => ({
      command,
      found: command === 'node',
    });

    const text = formatDoctorReport(await createDoctorReport(checker));

    expect(text).toContain('ffmpeg: missing');
    expect(text).toContain('Install ffmpeg');
    expect(text).toContain('yt-dlp: missing');
    expect(text).toContain('optional');
  });

  it('dispatches doctor from the cli', async () => {
    const io = createIO();

    const exitCode = await runCli(['doctor'], io);

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('OpenVideo Doctor');
  });
});
```

- [ ] **Step 2: Run the doctor test to verify it fails**

Run:

```bash
npm test -- tests/doctor.test.ts
```

Expected: FAIL because `src/cli/commands/doctor.ts` and `src/utils/exec.ts` do not exist.

- [ ] **Step 3: Add process helper utilities**

Create `src/utils/exec.ts`:

```ts
import { spawn } from 'node:child_process';

export interface CommandStatus {
  command: string;
  found: boolean;
  version?: string;
  error?: string;
}

export async function checkCommand(command: string, args: string[] = ['--version']): Promise<CommandStatus> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      resolve({ command, found: false, error: err.message });
    });
    child.on('close', (code) => {
      const output = `${stdout}\n${stderr}`.trim();
      const firstLine = output.split(/\r?\n/).find((line) => line.trim().length > 0);
      resolve({
        command,
        found: code === 0,
        ...(firstLine ? { version: firstLine.trim() } : {}),
        ...(code === 0 ? {} : { error: `exited with code ${code}` }),
      });
    });
  });
}
```

- [ ] **Step 4: Implement doctor report and formatting**

Create `src/cli/commands/doctor.ts`:

```ts
import type { CliIO } from '../index.js';
import { checkCommand, type CommandStatus } from '../../utils/exec.js';

export type DependencyChecker = (command: string) => Promise<CommandStatus>;

export interface DoctorReport {
  required: {
    node: CommandStatus;
    ffmpeg: CommandStatus;
    ffprobe: CommandStatus;
  };
  optional: {
    hyperframes: CommandStatus;
    'yt-dlp': CommandStatus;
  };
  readyForAnalyze: boolean;
  readyForRender: boolean;
}

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

function nodeStatus(): CommandStatus {
  return {
    command: 'node',
    found: true,
    version: `node ${process.version}`,
  };
}

export async function createDoctorReport(
  checker: DependencyChecker = (command) => checkCommand(command),
): Promise<DoctorReport> {
  const [ffmpeg, ffprobe, hyperframes, ytdlp] = await Promise.all([
    checker('ffmpeg'),
    checker('ffprobe'),
    checker('hyperframes'),
    checker('yt-dlp'),
  ]);
  const required = {
    node: nodeStatus(),
    ffmpeg,
    ffprobe,
  };
  const optional = {
    hyperframes,
    'yt-dlp': ytdlp,
  };
  return {
    required,
    optional,
    readyForAnalyze: required.node.found && required.ffmpeg.found && required.ffprobe.found,
    readyForRender: hyperframes.found,
  };
}

function lineFor(label: string, status: CommandStatus, required: boolean): string {
  const state = status.found ? 'ok' : 'missing';
  const suffix = status.version ? ` - ${status.version}` : '';
  const kind = required ? 'required' : 'optional';
  return `- ${label} (${kind}): ${state}${suffix}`;
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    'OpenVideo Doctor',
    '',
    'Required:',
    lineFor('node', report.required.node, true),
    lineFor('ffmpeg', report.required.ffmpeg, true),
    lineFor('ffprobe', report.required.ffprobe, true),
    '',
    'Optional:',
    lineFor('hyperframes', report.optional.hyperframes, false),
    lineFor('yt-dlp', report.optional['yt-dlp'], false),
    '',
    `Analyze ready: ${report.readyForAnalyze ? 'yes' : 'no'}`,
    `Render ready: ${report.readyForRender ? 'yes' : 'no'}`,
  ];

  const guidance: string[] = [];
  if (!report.required.ffmpeg.found || !report.required.ffprobe.found) {
    guidance.push('Install ffmpeg to enable metadata probing and frame extraction.');
  }
  if (!report.optional.hyperframes.found) {
    guidance.push('Install HyperFrames to enable `openvideo render`; analysis and brief generation can still run.');
  }
  if (!report.optional['yt-dlp'].found) {
    guidance.push('yt-dlp is optional and only needed for supported public link adapters.');
  }
  if (guidance.length > 0) {
    lines.push('', 'Guidance:', ...guidance.map((item) => `- ${item}`));
  }

  return lines.join('\n');
}

export async function runDoctor(io: CliIO = DEFAULT_IO): Promise<number> {
  const report = await createDoctorReport();
  io.writeOut(formatDoctorReport(report));
  return 0;
}
```

- [ ] **Step 5: Wire doctor into the CLI**

Modify `src/cli/index.ts` so the `doctor` branch imports and runs `runDoctor`:

```ts
  if (command === 'doctor') {
    const { runDoctor } = await import('./commands/doctor.js');
    return runDoctor(io);
  }
```

- [ ] **Step 6: Run doctor tests**

Run:

```bash
npm test -- tests/doctor.test.ts
```

Expected: PASS for `tests/doctor.test.ts`.

- [ ] **Step 7: Run all tests and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: all tests pass and typecheck exits 0.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/utils/exec.ts src/cli/commands/doctor.ts src/cli/index.ts tests/doctor.test.ts
git commit -m "feat: add dependency doctor"
```

---

### Task 3: Public README And License

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Modify: `package.json`

**Interfaces:**
- Consumes: command names from Task 1 and doctor behavior from Task 2.
- Produces: public-facing quickstart and safety statement for GitHub visitors.

- [ ] **Step 1: Add README content**

Create `README.md`:

```md
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
```

- [ ] **Step 2: Add MIT license**

Create `LICENSE`:

```text
MIT License

Copyright (c) 2026 JackLee992

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Update package metadata**

Modify `package.json` to add repository metadata:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/JackLee992/openvideo.git"
  },
  "bugs": {
    "url": "https://github.com/JackLee992/openvideo/issues"
  },
  "homepage": "https://github.com/JackLee992/openvideo#readme"
}
```

Keep the existing package fields; add these keys at the top level.

- [ ] **Step 4: Verify docs and build**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all tests pass, typecheck exits 0, and `dist/cli/index.js` exists.

- [ ] **Step 5: Commit**

Run:

```bash
git add README.md LICENSE package.json package-lock.json
git commit -m "docs: add public project readme"
```

---

### Task 4: Final Phase 1 Verification And Push

**Files:**
- Modify: none expected unless verification finds a defect.

**Interfaces:**
- Consumes: all Phase 1 files.
- Produces: pushed GitHub state with runnable CLI foundation.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run doctor
```

Expected:

- `npm test` reports all tests passing.
- `npm run typecheck` exits 0.
- `npm run build` exits 0.
- `npm run doctor` prints `OpenVideo Doctor` and dependency status.

- [ ] **Step 2: Inspect Git status**

Run:

```bash
git status --short
```

Expected: clean working tree except intentional generated files ignored by `.gitignore`.

- [ ] **Step 3: Push commits**

Run:

```bash
git push origin main
```

Expected: push succeeds to `https://github.com/JackLee992/openvideo`.

- [ ] **Step 4: Confirm GitHub state**

Run:

```bash
gh repo view JackLee992/openvideo --json name,visibility,url
```

Expected: JSON contains `"name":"openvideo"`, `"visibility":"PUBLIC"`, and the GitHub URL.

---

## Self-Review Notes

- Spec coverage: Phase 1 covers public repository defaults, CLI-first foundation, `doctor`, dependency checks, README safety statement, MIT license, and test baseline.
- Intentional gaps: deterministic analyzer, style contracts, HyperFrames brief generation, render MVP, and Douyin link adapter are later phases from the approved spec.
- Placeholder scan: no unresolved placeholder markers are allowed in this plan.
- Type consistency: `CliIO`, `runCli`, `DependencyChecker`, `DoctorReport`, `createDoctorReport`, `formatDoctorReport`, and `runDoctor` are defined before use by later tasks.
