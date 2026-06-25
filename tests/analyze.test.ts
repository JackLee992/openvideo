import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRunLayout } from '../src/project/paths.js';
import { writeAnalysisArtifacts, type AnalysisArtifactInput } from '../src/analysis/artifacts.js';

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'openvideo-analyze-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('writeAnalysisArtifacts', () => {
  it('writes the deterministic analysis file set', async () => {
    const root = await tempDir();
    const layout = createRunLayout(path.join(root, 'runs'), 'run-1');
    const sourcePath = path.join(root, 'source.mp4');
    await writeFile(sourcePath, 'video');
    const input: AnalysisArtifactInput = {
      layout,
      source: {
        kind: 'local-file',
        originalInput: sourcePath,
        fileName: 'source.mp4',
        localPath: sourcePath,
      },
      category: 'product-demo',
      metadata: {
        durationSec: 12.5,
        width: 720,
        height: 1280,
        frameRate: 30,
        videoCodec: 'h264',
        audioCodec: 'aac',
        hasAudio: true,
        raw: { format: { duration: '12.5' } },
      },
      frames: [
        { index: 1, fileName: 'frame-0001.jpg', path: path.join(layout.framesDir, 'frame-0001.jpg') },
        { index: 2, fileName: 'frame-0002.jpg', path: path.join(layout.framesDir, 'frame-0002.jpg') },
      ],
    };

    const result = await writeAnalysisArtifacts(input);

    await expect(stat(path.join(layout.analysisDir, 'metadata.json'))).resolves.toBeTruthy();
    await expect(stat(path.join(layout.analysisDir, 'shot-breakdown.json'))).resolves.toBeTruthy();
    await expect(stat(path.join(layout.analysisDir, 'edit-rhythm.json'))).resolves.toBeTruthy();
    await expect(stat(path.join(layout.analysisDir, 'director-notes.md'))).resolves.toBeTruthy();
    await expect(stat(path.join(layout.analysisDir, 'caption-style.md'))).resolves.toBeTruthy();
    await expect(stat(path.join(layout.analysisDir, 'motion-language.md'))).resolves.toBeTruthy();
    await expect(stat(path.join(layout.analysisDir, 'sound-notes.md'))).resolves.toBeTruthy();
    await expect(stat(path.join(layout.runDir, 'VIDEO_STYLE.md'))).resolves.toBeTruthy();
    await expect(stat(path.join(layout.runDir, 'hyperframes-brief.md'))).resolves.toBeTruthy();

    const metadata = JSON.parse(await readFile(path.join(layout.analysisDir, 'metadata.json'), 'utf8'));
    expect(metadata.category).toBe('product-demo');
    expect(metadata.video.aspectRatio).toBe('9:16');
    expect(metadata.video.durationSec).toBe(12.5);
    expect(result.videoStylePath).toBe(path.join(layout.runDir, 'VIDEO_STYLE.md'));
    await expect(readFile(result.videoStylePath, 'utf8')).resolves.toContain('Things Not To Copy');
    await expect(readFile(result.hyperframesBriefPath, 'utf8')).resolves.toContain('9:16');
  });
});
