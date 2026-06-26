import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateReport } from '../src/report/report.js';

describe('generateReport', () => {
  it('writes a human-readable report and segmented transcript', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openvideo-report-test-'));
    try {
      const runDir = path.join(root, 'runs', 'demo');
      const analysisDir = path.join(runDir, 'analysis');
      await writeFixture(analysisDir);

      const result = await generateReport({ runDir });

      const report = await readFile(result.reportPath, 'utf8');
      const transcript = await readFile(result.transcriptReadablePath, 'utf8');
      expect(result.reportPath).toBe(path.join(analysisDir, 'report.md'));
      expect(report).toContain('OpenVideo Analysis Report');
      expect(report).toContain('Scenes detected: 3');
      expect(report).toContain('Reusable Creative Pattern');
      expect(transcript).toContain('Segment count:');
      expect(transcript).toContain('开场先抛出反常识问题');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function writeFixture(analysisDir: string): Promise<void> {
  await mkdir(analysisDir, { recursive: true });
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
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
