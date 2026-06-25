import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRunId, createRunLayout } from '../src/project/paths.js';
import { normalizeSource, type FetchLike } from '../src/sources/source.js';

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'openvideo-source-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('run paths', () => {
  it('creates stable readable run ids from input and date', () => {
    const id = createRunId('/tmp/My Douyin Clip.mp4', new Date('2026-06-26T08:09:10.000Z'));

    expect(id).toBe('2026-06-26T08-09-10-000Z-my-douyin-clip');
  });
});

describe('normalizeSource', () => {
  it('copies a supported local video into the run input folder', async () => {
    const root = await tempDir();
    const source = path.join(root, 'reference.mp4');
    await writeFile(source, Buffer.from('video-bytes'));
    const layout = createRunLayout(path.join(root, 'runs'), 'run-1');

    const normalized = await normalizeSource(source, layout);

    expect(normalized.kind).toBe('local-file');
    expect(normalized.fileName).toBe('source.mp4');
    expect(normalized.originalInput).toBe(source);
    await expect(readFile(normalized.localPath, 'utf8')).resolves.toBe('video-bytes');
  });

  it('rejects unsupported local file extensions', async () => {
    const root = await tempDir();
    const source = path.join(root, 'notes.txt');
    await writeFile(source, 'not video');
    const layout = createRunLayout(path.join(root, 'runs'), 'run-2');

    await expect(normalizeSource(source, layout)).rejects.toThrow('Unsupported video extension');
  });

  it('downloads a direct video URL when the response is video content', async () => {
    const root = await tempDir();
    const layout = createRunLayout(path.join(root, 'runs'), 'run-3');
    const fetchImpl: FetchLike = async () =>
      new Response(Buffer.from('remote-video'), {
        status: 200,
        headers: { 'content-type': 'video/mp4' },
      });

    const normalized = await normalizeSource('https://example.com/video', layout, { fetchImpl });

    expect(normalized.kind).toBe('direct-url');
    expect(normalized.fileName).toBe('source.mp4');
    await expect(readFile(normalized.localPath, 'utf8')).resolves.toBe('remote-video');
  });

  it('rejects direct URLs that are not video content and have no video extension', async () => {
    const root = await tempDir();
    const layout = createRunLayout(path.join(root, 'runs'), 'run-4');
    const fetchImpl: FetchLike = async () =>
      new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });

    await expect(normalizeSource('https://example.com/page', layout, { fetchImpl })).rejects.toThrow(
      'Direct URL did not return video content',
    );
  });
});
