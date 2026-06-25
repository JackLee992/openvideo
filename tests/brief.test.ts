import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createGenerationBrief } from '../src/brief/brief.js';

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'openvideo-brief-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createRunFixture(root: string): Promise<string> {
  const runDir = path.join(root, 'runs', 'run-1');
  await mkdir(path.join(runDir, 'analysis'), { recursive: true });
  await writeFile(
    path.join(runDir, 'analysis', 'metadata.json'),
    JSON.stringify(
      {
        runId: 'run-1',
        category: 'product-demo',
        video: {
          durationSec: 12.5,
          aspectRatio: '9:16',
          width: 720,
          height: 1280,
          hasAudio: true,
        },
      },
      null,
      2,
    ),
  );
  await writeFile(path.join(runDir, 'VIDEO_STYLE.md'), '# VIDEO_STYLE\n\n## Things Not To Copy\n\n- Do not copy exact source wording.\n');
  await writeFile(path.join(runDir, 'hyperframes-brief.md'), '# HyperFrames Brief\n\n## Scene Plan\n\n1. Hook scene.\n');
  return runDir;
}

describe('createGenerationBrief', () => {
  it('writes a goal-specific HyperFrames generation brief from an analyzed run', async () => {
    const root = await tempDir();
    const runDir = await createRunFixture(root);

    const result = await createGenerationBrief({
      runDir,
      goal: '做一个 AI 工具教程类抖音短视频',
    });

    expect(result.outputPath).toBe(path.join(runDir, 'generation-brief.md'));
    const text = await readFile(result.outputPath, 'utf8');
    expect(text).toContain('# OpenVideo Generation Brief');
    expect(text).toContain('做一个 AI 工具教程类抖音短视频');
    expect(text).toContain('product-demo');
    expect(text).toContain('9:16');
    expect(text).toContain('Things Not To Copy');
  });

  it('fails clearly when the run has not been analyzed', async () => {
    const root = await tempDir();
    const runDir = path.join(root, 'runs', 'missing-analysis');
    await mkdir(runDir, { recursive: true });

    await expect(createGenerationBrief({ runDir, goal: 'demo' })).rejects.toThrow('Missing analyzed run file');
  });
});
