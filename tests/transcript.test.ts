import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  detectTranscript,
  parseHyperframesTranscriptJson,
  type HyperframesTranscribeRunner,
} from '../src/analysis/transcript.js';

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'openvideo-transcript-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('parseHyperframesTranscriptJson', () => {
  it('normalizes HyperFrames word-level transcript output', () => {
    const words = parseHyperframesTranscriptJson(
      JSON.stringify([
        { text: '这', start: 0, end: 0.2 },
        { id: 'custom', text: '就是', start: 0.25, end: 0.7 },
        { text: '开场钩子', start: 0.75, end: 1.4 },
      ]),
    );

    expect(words).toEqual([
      { id: 'w0', text: '这', start: 0, end: 0.2 },
      { id: 'custom', text: '就是', start: 0.25, end: 0.7 },
      { id: 'w2', text: '开场钩子', start: 0.75, end: 1.4 },
    ]);
  });

  it('accepts object output with a words array', () => {
    const words = parseHyperframesTranscriptJson(
      JSON.stringify({
        words: [
          { text: 'OpenVideo', start: 1, end: 1.6 },
          { text: '分析', start: 1.7, end: 2 },
        ],
      }),
    );

    expect(words.map((word) => word.text)).toEqual(['OpenVideo', '分析']);
  });
});

describe('detectTranscript', () => {
  it('returns unavailable when HyperFrames transcription emits no JSON', async () => {
    const runner: HyperframesTranscribeRunner = async () => ({
      stdout: '',
      stderr: 'whisper-cpp unavailable',
      code: 0,
    });

    const result = await detectTranscript('/tmp/source.mp4', { runner, model: 'small' });

    expect(result.available).toBe(false);
    expect(result.words).toEqual([]);
    expect(result.error).toContain('No transcript JSON');
  });

  it('runs HyperFrames transcription with an explicit multilingual model', async () => {
    const calls: string[][] = [];
    const runner: HyperframesTranscribeRunner = async (_inputPath, args) => {
      calls.push(args);
      return {
        stdout: JSON.stringify([{ text: '你好', start: 0.1, end: 0.5 }]),
        stderr: '',
        code: 0,
      };
    };

    const result = await detectTranscript('/tmp/source.mp4', {
      runner,
      model: 'small',
      language: 'zh',
    });

    expect(calls[0]).toEqual([
      'hyperframes',
      'transcribe',
      '--json',
      '--optional',
      '--model',
      'small',
      '--language',
      'zh',
      '/tmp/source.mp4',
    ]);
    expect(result).toMatchObject({
      available: true,
      provider: 'hyperframes-transcribe',
      model: 'small',
      language: 'zh',
      text: '你好',
      words: [{ id: 'w0', text: '你好', start: 0.1, end: 0.5 }],
    });
  });

  it('reads the HyperFrames transcript sidecar when stdout returns a summary object', async () => {
    const root = await tempDir();
    const transcriptPath = path.join(root, 'transcript.json');
    await writeFile(
      transcriptPath,
      JSON.stringify([
        { text: 'open', start: 0.01, end: 0.3 },
        { text: 'video', start: 0.3, end: 0.67 },
      ]),
    );
    const runner: HyperframesTranscribeRunner = async () => ({
      stdout: JSON.stringify({
        ok: true,
        model: 'tiny.en',
        wordCount: 2,
        transcriptPath,
      }),
      stderr: '',
      code: 0,
    });

    const result = await detectTranscript('/tmp/source.mp4', { runner, model: 'tiny.en' });

    expect(result.words).toEqual([
      { id: 'w0', text: 'open', start: 0.01, end: 0.3 },
      { id: 'w1', text: 'video', start: 0.3, end: 0.67 },
    ]);
    expect(result.text).toBe('open video');
  });
});
