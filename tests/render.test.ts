import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareHyperFramesRender } from '../src/render/render.js';

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'openvideo-render-test-'));
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
        video: { durationSec: 12, aspectRatio: '9:16', hasAudio: true },
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(runDir, 'generation-brief.md'),
    '# OpenVideo Generation Brief\n\n## Goal\n\n做一个 AI 工具教程类抖音短视频\n\n## Target Scene Plan\n\n1. Hook\n2. Proof\n3. Payoff\n',
  );
  return runDir;
}

describe('prepareHyperFramesRender', () => {
  it('creates a renderable HyperFrames project scaffold from a generation brief', async () => {
    const root = await tempDir();
    const runDir = await createRunFixture(root);

    const result = await prepareHyperFramesRender({
      runDir,
      prompt: '介绍一个能自动生成设计稿的工具',
      outDir: path.join(root, 'renders'),
    });

    expect(result.projectDir).toBe(path.join(root, 'renders', 'run-1'));
    await expect(stat(path.join(result.projectDir, 'index.html'))).resolves.toBeTruthy();
    await expect(stat(path.join(result.projectDir, 'OPENVIDEO_RENDER.md'))).resolves.toBeTruthy();

    const html = await readFile(path.join(result.projectDir, 'index.html'), 'utf8');
    expect(html).toContain('data-composition-id="openvideo-main"');
    expect(html).toContain('data-start="0"');
    expect(html).toContain('data-width="1080"');
    expect(html).toContain('data-height="1920"');
    expect(html).toContain('介绍一个能自动生成设计稿的工具');
    expect(html).not.toContain('-apple-system');
    expect(html).not.toContain('BlinkMacSystemFont');
  });

  it('fails clearly when the generation brief is missing', async () => {
    const root = await tempDir();
    const runDir = path.join(root, 'runs', 'run-2');
    await mkdir(runDir, { recursive: true });

    await expect(prepareHyperFramesRender({ runDir, prompt: 'demo' })).rejects.toThrow('Missing generation brief');
  });
});
