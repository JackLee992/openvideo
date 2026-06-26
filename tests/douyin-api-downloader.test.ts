import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultDouyinApiBaseUrl, downloadWithDouyinApi, type FetchLike } from '../src/downloaders/douyin-api.js';

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'openvideo-douyin-api-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('downloadWithDouyinApi', () => {
  it('downloads through an already-running Douyin API service', async () => {
    const root = await tempDir();
    const requestedUrls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      requestedUrls.push(url);
      return new Response(Buffer.from('api-video'), {
        status: 200,
        headers: { 'content-type': 'video/mp4' },
      });
    };

    const result = await downloadWithDouyinApi('https://www.douyin.com/video/123', root, {
      baseUrl: 'http://127.0.0.1:8080',
      fetchImpl,
    });

    expect(result).toBe(path.join(root, 'source.mp4'));
    expect(requestedUrls).toEqual([
      'http://127.0.0.1:8080/api/download?url=https%3A%2F%2Fwww.douyin.com%2Fvideo%2F123&prefix=false&with_watermark=false',
    ]);
    await expect(readFile(result, 'utf8')).resolves.toBe('api-video');
  });

  it('explains that the service must be running when the request fails', async () => {
    const root = await tempDir();
    const fetchImpl: FetchLike = async () =>
      new Response('not found', {
        status: 404,
      });

    await expect(downloadWithDouyinApi('https://www.douyin.com/video/123', root, { fetchImpl })).rejects.toThrow(
      'Douyin API downloader failed',
    );
  });
});

describe('defaultDouyinApiBaseUrl', () => {
  it('uses OPENVIDEO_DOUYIN_API_BASE_URL when set', () => {
    const previous = process.env.OPENVIDEO_DOUYIN_API_BASE_URL;
    process.env.OPENVIDEO_DOUYIN_API_BASE_URL = 'http://127.0.0.1:9000';

    try {
      expect(defaultDouyinApiBaseUrl()).toBe('http://127.0.0.1:9000');
    } finally {
      if (previous === undefined) {
        delete process.env.OPENVIDEO_DOUYIN_API_BASE_URL;
      } else {
        process.env.OPENVIDEO_DOUYIN_API_BASE_URL = previous;
      }
    }
  });
});
