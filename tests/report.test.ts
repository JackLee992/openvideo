import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAnalysisReport } from '../src/report/report.js';

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'openvideo-report-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createRunFixture(root: string): Promise<string> {
  const runDir = path.join(root, 'runs', 'run-1');
  await mkdir(path.join(runDir, 'analysis'), { recursive: true });
  await mkdir(path.join(runDir, 'frames'), { recursive: true });
  await writeFile(path.join(runDir, 'frames', 'frame-0001.jpg'), 'frame');
  await writeFile(
    path.join(runDir, 'analysis', 'metadata.json'),
    JSON.stringify({
      runId: 'run-1',
      category: 'knowledge',
      video: { durationSec: 9, aspectRatio: '9:16', frameRate: 30, hasAudio: true },
      frameSample: ['frame-0001.jpg'],
      captionObservationCount: 1,
      transcriptWordCount: 2,
      visualMotion: { cameraMovement: 'locked-off', motionIntensity: 'low', dominantDirection: 'none' },
    }),
  );
  await writeFile(
    path.join(runDir, 'analysis', 'storyboard.json'),
    JSON.stringify({
      beats: [
        {
          sceneIndex: 1,
          startSec: 0,
          endSec: 3,
          role: 'hook',
          pacing: 'held',
          evidence: { captions: ['三秒看懂'], transcript: '先看结果', audioCueCount: 1 },
        },
      ],
    }),
  );
  await writeFile(
    path.join(runDir, 'analysis', 'transition-analysis.json'),
    JSON.stringify({ transitions: [{ timestampSec: 3, type: 'caption-led-cut', fromSceneIndex: 1, toSceneIndex: 2 }] }),
  );
  await writeFile(
    path.join(runDir, 'analysis', 'motion-analysis.json'),
    JSON.stringify({ cameraMovement: 'locked-off', motionIntensity: 'low', dominantDirection: 'none', sceneProfiles: [] }),
  );
  await writeFile(
    path.join(runDir, 'analysis', 'captions.json'),
    JSON.stringify({ available: true, observations: [{ frameName: 'frame-0001.jpg', text: '三秒看懂', confidence: 91 }] }),
  );
  await writeFile(
    path.join(runDir, 'analysis', 'transcript.json'),
    JSON.stringify({ available: true, words: [{ text: '先', start: 0, end: 0.2 }, { text: '结果', start: 0.3, end: 0.8 }], text: '先 结果' }),
  );
  await writeFile(path.join(runDir, 'VIDEO_STYLE.md'), '# VIDEO_STYLE\n\n## Hook Formula\n\n- Hook');
  await writeFile(path.join(runDir, 'hyperframes-brief.md'), '# HyperFrames Brief\n\n## Scene Plan\n\n1. Hook');
  return runDir;
}

describe('createAnalysisReport', () => {
  it('creates a local browser workbench from analyzed run artifacts', async () => {
    const root = await tempDir();
    const runDir = await createRunFixture(root);

    const result = await createAnalysisReport({ runDir });

    expect(result.reportDir).toBe(path.join(runDir, 'report'));
    await expect(stat(result.indexPath)).resolves.toBeTruthy();
    const html = await readFile(result.indexPath, 'utf8');
    expect(html).toContain('OpenVideo Workbench');
    expect(html).toContain('data-run-id="run-1"');
    expect(html).toContain('Storyboard Timeline');
    expect(html).toContain('Transition Table');
    expect(html).toContain('Motion / Camera');
    expect(html).toContain('OCR Evidence');
    expect(html).toContain('ASR Transcript');
    expect(html).toContain('HyperFrames Brief');
    expect(html).toContain('三秒看懂');
    expect(html).toContain('../frames/frame-0001.jpg');
  });

  it('supports a custom output directory', async () => {
    const root = await tempDir();
    const runDir = await createRunFixture(root);
    const outDir = path.join(root, 'reports', 'run-1');

    const result = await createAnalysisReport({ runDir, outDir });

    expect(result.indexPath).toBe(path.join(outDir, 'index.html'));
  });

  it('fails clearly when the run is missing metadata', async () => {
    const root = await tempDir();
    const runDir = path.join(root, 'runs', 'missing');
    await mkdir(runDir, { recursive: true });

    await expect(createAnalysisReport({ runDir })).rejects.toThrow('Missing analyzed run file');
  });
});
