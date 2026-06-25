import { describe, expect, it } from 'vitest';
import { downloadWithFallback, type DownloadProvider } from '../src/downloaders/fallback.js';

describe('downloadWithFallback', () => {
  it('tries providers in order until one downloads the video', async () => {
    const calls: string[] = [];
    const providers: DownloadProvider[] = [
      {
        name: 'yt-dlp',
        download: async () => {
          calls.push('yt-dlp');
          throw new Error('site extractor failed');
        },
      },
      {
        name: 'jiji',
        download: async () => {
          calls.push('jiji');
          return '/tmp/openvideo/source.mp4';
        },
      },
      {
        name: 'douyin-api',
        download: async () => {
          calls.push('douyin-api');
          return '/tmp/openvideo/unused.mp4';
        },
      },
    ];

    const result = await downloadWithFallback('https://www.douyin.com/video/123', '/tmp/openvideo', providers);

    expect(result.provider).toBe('jiji');
    expect(result.path).toBe('/tmp/openvideo/source.mp4');
    expect(result.attempts).toEqual([
      { provider: 'yt-dlp', ok: false, error: 'site extractor failed' },
      { provider: 'jiji', ok: true, path: '/tmp/openvideo/source.mp4' },
    ]);
    expect(calls).toEqual(['yt-dlp', 'jiji']);
  });

  it('reports every provider failure when no downloader succeeds', async () => {
    const providers: DownloadProvider[] = [
      {
        name: 'yt-dlp',
        download: async () => {
          throw new Error('yt-dlp failed');
        },
      },
      {
        name: 'jiji',
        download: async () => {
          throw new Error('jiji failed');
        },
      },
    ];

    await expect(downloadWithFallback('https://www.douyin.com/video/123', '/tmp/openvideo', providers)).rejects.toThrow(
      'All download providers failed: yt-dlp: yt-dlp failed; jiji: jiji failed',
    );
  });
});
