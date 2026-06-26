import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRunLayout } from '../src/project/paths.js';
import { writeAnalysisArtifacts, type AnalysisArtifactInput } from '../src/analysis/artifacts.js';
import { analyzeVideo } from '../src/analysis/analyze.js';

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
      sceneDetection: {
        threshold: 0.32,
        raw: 'showinfo',
        cuts: [{ timestampSec: 1.2 }, { timestampSec: 3.4 }],
        scenes: [
          { index: 1, startSec: 0, endSec: 1.2, durationSec: 1.2 },
          { index: 2, startSec: 1.2, endSec: 3.4, durationSec: 2.2 },
          { index: 3, startSec: 3.4, endSec: 12.5, durationSec: 9.1 },
        ],
      },
      audioDetection: {
        raw: 'silencedetect',
        silenceEvents: [
          { type: 'silence-start', timestampSec: 0 },
          { type: 'silence-end', timestampSec: 0.52, durationSec: 0.52 },
        ],
        cues: [{ type: 'sound-start', timestampSec: 0.52, confidence: 'ffmpeg-silencedetect' }],
      },
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
    const shotBreakdown = JSON.parse(await readFile(path.join(layout.analysisDir, 'shot-breakdown.json'), 'utf8'));
    const editRhythm = JSON.parse(await readFile(path.join(layout.analysisDir, 'edit-rhythm.json'), 'utf8'));
    const soundNotes = await readFile(path.join(layout.analysisDir, 'sound-notes.md'), 'utf8');
    expect(metadata.category).toBe('product-demo');
    expect(metadata.video.aspectRatio).toBe('9:16');
    expect(metadata.video.durationSec).toBe(12.5);
    expect(shotBreakdown.shots).toHaveLength(3);
    expect(shotBreakdown.shots[1].startSec).toBe(1.2);
    expect(editRhythm.estimatedSceneCount).toBe(3);
    expect(editRhythm.cuts).toEqual([
      { timestampSec: 1.2, type: 'scene-cut', confidence: 'ffmpeg-scene-detect' },
      { timestampSec: 3.4, type: 'scene-cut', confidence: 'ffmpeg-scene-detect' },
    ]);
    expect(editRhythm.audioCues).toEqual([
      { timestampSec: 0.52, type: 'sound-start', confidence: 'ffmpeg-silencedetect' },
    ]);
    expect(metadata.audioCueCount).toBe(1);
    expect(soundNotes).toContain('0.52s');
    expect(result.videoStylePath).toBe(path.join(layout.runDir, 'VIDEO_STYLE.md'));
    await expect(readFile(result.videoStylePath, 'utf8')).resolves.toContain('Things Not To Copy');
    await expect(readFile(result.hyperframesBriefPath, 'utf8')).resolves.toContain('9:16');
  });
});

describe('analyzeVideo', () => {
  it('normalizes a source, probes it, extracts frames, and writes artifacts', async () => {
    const root = await tempDir();
    const sourcePath = path.join(root, 'reference.mp4');
    await writeFile(sourcePath, 'video');

    const result = await analyzeVideo(
      {
        input: sourcePath,
        outDir: path.join(root, 'runs'),
        category: 'product-demo',
        now: new Date('2026-06-26T08:09:10.000Z'),
      },
      {
        probe: async () => ({
          durationSec: 9,
          width: 720,
          height: 1280,
          frameRate: 30,
          videoCodec: 'h264',
          audioCodec: 'aac',
          hasAudio: true,
          raw: {},
        }),
        extractFrames: async (_inputPath, framesDir) => {
          const framePath = path.join(framesDir, 'frame-0001.jpg');
          await writeFile(framePath, 'frame');
          return [{ index: 1, fileName: 'frame-0001.jpg', path: framePath }];
        },
        detectScenes: async () => ({
          threshold: 0.32,
          raw: 'showinfo',
          cuts: [{ timestampSec: 2.5 }],
          scenes: [
            { index: 1, startSec: 0, endSec: 2.5, durationSec: 2.5 },
            { index: 2, startSec: 2.5, endSec: 9, durationSec: 6.5 },
          ],
        }),
        detectAudio: async () => ({
          raw: 'silencedetect',
          silenceEvents: [],
          cues: [{ type: 'sound-start', timestampSec: 0.4, confidence: 'ffmpeg-silencedetect' }],
        }),
      },
    );

    expect(result.runId).toBe('2026-06-26T08-09-10-000Z-reference');
    await expect(stat(path.join(result.layout.runDir, 'VIDEO_STYLE.md'))).resolves.toBeTruthy();
    await expect(stat(path.join(result.layout.analysisDir, 'metadata.json'))).resolves.toBeTruthy();
    await expect(stat(path.join(result.layout.framesDir, 'frame-0001.jpg'))).resolves.toBeTruthy();
    const shotBreakdown = JSON.parse(await readFile(path.join(result.layout.analysisDir, 'shot-breakdown.json'), 'utf8'));
    const editRhythm = JSON.parse(await readFile(path.join(result.layout.analysisDir, 'edit-rhythm.json'), 'utf8'));
    expect(shotBreakdown.shots).toHaveLength(2);
    expect(editRhythm.audioCues).toEqual([
      { timestampSec: 0.4, type: 'sound-start', confidence: 'ffmpeg-silencedetect' },
    ]);
  });

  it('analyzes a platform URL through an injected downloader', async () => {
    const root = await tempDir();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('direct fetch should not be used');
    };

    try {
      const result = await analyzeVideo(
        {
          input: 'https://www.douyin.com/video/123',
          outDir: path.join(root, 'runs'),
          category: 'lifestyle',
          now: new Date('2026-06-26T08:09:10.000Z'),
        },
        {
          urlDownloader: async (_url, outputDir) => {
            const downloadedPath = path.join(outputDir, 'downloaded.mp4');
            await writeFile(downloadedPath, 'video');
            return downloadedPath;
          },
          probe: async () => ({
            durationSec: 8,
            width: 720,
            height: 1280,
            frameRate: 30,
            videoCodec: 'h264',
            audioCodec: 'aac',
            hasAudio: true,
            raw: {},
          }),
          extractFrames: async (_inputPath, framesDir) => {
            const framePath = path.join(framesDir, 'frame-0001.jpg');
            await writeFile(framePath, 'frame');
            return [{ index: 1, fileName: 'frame-0001.jpg', path: framePath }];
          },
          detectScenes: async () => ({
            threshold: 0.32,
            raw: '',
            cuts: [],
            scenes: [{ index: 1, startSec: 0, endSec: 8, durationSec: 8 }],
          }),
          detectAudio: async () => ({
            raw: '',
            silenceEvents: [],
            cues: [],
          }),
        } as Parameters<typeof analyzeVideo>[1],
      );

      await expect(readFile(path.join(result.layout.inputDir, 'source.mp4'), 'utf8')).resolves.toBe('video');
      await expect(readFile(result.artifacts.videoStylePath, 'utf8')).resolves.toContain('lifestyle');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
