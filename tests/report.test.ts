import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateReport } from '../src/report/report.js';
import { createAnalysisWorkbench } from '../src/report/workbench.js';

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'openvideo-report-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('generateReport', () => {
  it('writes a human-readable report and segmented transcript', async () => {
    const root = await tempDir();
    const runDir = await createRunFixture(root);

    const result = await generateReport({ runDir });

    const report = await readFile(result.reportPath, 'utf8');
    const transcript = await readFile(result.transcriptReadablePath, 'utf8');
    expect(result.reportPath).toBe(path.join(runDir, 'analysis', 'report.md'));
    expect(report).toContain('OpenVideo Analysis Report');
    expect(report).toContain('Scenes detected: 3');
    expect(report).toContain('Reusable Creative Pattern');
    expect(transcript).toContain('Segment count:');
    expect(transcript).toContain('开场先抛出反常识问题');
  });
});

describe('createAnalysisWorkbench', () => {
  it('creates a local browser workbench from analyzed run artifacts', async () => {
    const root = await tempDir();
    const runDir = await createRunFixture(root);

    const result = await createAnalysisWorkbench({ runDir });

    expect(result.reportDir).toBe(path.join(runDir, 'report'));
    await expect(stat(result.indexPath)).resolves.toBeTruthy();
    const html = await readFile(result.indexPath, 'utf8');
    expect(html).toContain('OpenVideo Workbench');
    expect(html).toContain('data-run-id="demo"');
    expect(html).toContain('Storyboard Timeline');
    expect(html).toContain('Transition Table');
    expect(html).toContain('Motion / Camera');
    expect(html).toContain('OCR Evidence');
    expect(html).toContain('ASR Transcript');
    expect(html).toContain('HyperFrames Brief');
    expect(html).toContain('开场先抛出反常识问题');
    expect(html).toContain('../frames/frame-0001.jpg');
  });

  it('supports a custom output directory', async () => {
    const root = await tempDir();
    const runDir = await createRunFixture(root);
    const outDir = path.join(root, 'reports', 'demo');

    const result = await createAnalysisWorkbench({ runDir, outDir });

    expect(result.indexPath).toBe(path.join(outDir, 'index.html'));
  });

  it('fails clearly when the run is missing metadata', async () => {
    const root = await tempDir();
    const runDir = path.join(root, 'runs', 'missing');
    await mkdir(runDir, { recursive: true });

    await expect(createAnalysisWorkbench({ runDir })).rejects.toThrow('Missing analyzed run file');
  });
});

async function createRunFixture(root: string): Promise<string> {
  const runDir = path.join(root, 'runs', 'demo');
  const analysisDir = path.join(runDir, 'analysis');
  await mkdir(analysisDir, { recursive: true });
  await mkdir(path.join(runDir, 'frames'), { recursive: true });
  await writeFile(path.join(runDir, 'frames', 'frame-0001.jpg'), 'frame');
  await writeJson(path.join(analysisDir, 'metadata.json'), {
    runId: 'demo',
    category: 'knowledge',
    source: { kind: 'local-file', originalInput: 'source.mp4', fileName: 'source.mp4' },
    video: {
      durationSec: 121.49,
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      frameRate: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
      hasAudio: true,
    },
    frameSample: ['frame-0001.jpg'],
    audioCueCount: 1,
    captionObservationCount: 1,
    transcriptWordCount: 1,
    visualMotion: {
      available: true,
      cameraMovement: 'locked-off',
      motionIntensity: 'low',
      dominantDirection: 'none',
    },
    transcript: { available: true, model: 'small', language: 'zh' },
  });
  await writeJson(path.join(analysisDir, 'edit-rhythm.json'), {
    estimatedSceneCount: 3,
    averageSceneDurationSec: 40.5,
    hookWindowSec: 3,
    pacingCurve: 'slow-build',
    cuts: [{ timestampSec: 2.4 }, { timestampSec: 8.1 }],
    audioCues: [{ timestampSec: 0.4, type: 'sound-start' }],
  });
  await writeJson(path.join(analysisDir, 'storyboard.json'), {
    sceneCount: 3,
    progressionCurve: 'slow-build',
    beats: [
      {
        sceneIndex: 1,
        startSec: 0,
        endSec: 3,
        role: 'hook',
        pacing: 'held',
        evidence: { captions: ['标题'], transcript: '开场先抛出反常识问题' },
      },
    ],
  });
  await writeJson(path.join(analysisDir, 'transition-analysis.json'), {
    transitions: [{ timestampSec: 3, type: 'caption-led-cut', fromSceneIndex: 1, toSceneIndex: 2 }],
  });
  await writeJson(path.join(analysisDir, 'motion-analysis.json'), {
    cameraMovement: 'locked-off',
    motionIntensity: 'low',
    dominantDirection: 'none',
    frameCount: 1,
    sceneProfiles: [],
  });
  await writeJson(path.join(analysisDir, 'captions.json'), {
    available: true,
    language: 'chi_sim+eng',
    observations: [{ frameName: 'frame-0001.jpg', text: '标题', confidence: 80 }],
  });
  await writeJson(path.join(analysisDir, 'transcript.json'), {
    available: true,
    provider: 'hyperframes-transcribe',
    model: 'small',
    language: 'zh',
    words: [{ text: '开场先抛出反常识问题然后展开证据链最后做价值收束', start: 0, end: 10 }],
    text: '开场先抛出反常识问题然后展开证据链最后做价值收束',
  });
  await writeFile(path.join(runDir, 'VIDEO_STYLE.md'), '# VIDEO_STYLE\n\n## Hook Formula\n\n- Hook');
  await writeFile(path.join(runDir, 'hyperframes-brief.md'), '# HyperFrames Brief\n\n## Scene Plan\n\n1. Hook');
  return runDir;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
