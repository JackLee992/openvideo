import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  downloadWithBrowser,
  filterCookiesForUrl,
  readBrowserCookies,
  type BrowserCookie,
  type ChromiumLauncher,
  type MediaFetcher,
} from '../src/downloaders/browser.js';

describe('downloadWithBrowser', () => {
  it('opens the page, reads a playable video source, and downloads it', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openvideo-browser-test-'));
    try {
      const calls: string[] = [];
      let contextOptions: unknown;
      const launchChromium: ChromiumLauncher = async (options) => {
        calls.push(`launch:${options.headless}`);
        return {
          newContext: async (options) => {
            contextOptions = options;
            calls.push('new-context');
            return {
              newPage: async () => ({
                goto: async (url) => {
                  calls.push(`goto:${url}`);
                },
                evaluate: async <T>() =>
                  ({
                    src: 'https://media.example/video.mp4',
                    duration: 12,
                    width: 1080,
                    height: 1920,
                  }) as T,
                waitForTimeout: async () => undefined,
              }),
              close: async () => {
                calls.push('context-close');
              },
            };
          },
          close: async () => {
            calls.push('browser-close');
          },
        };
      };
      const fetchMedia: MediaFetcher = async (url, outputPath, referer) => {
        calls.push(`fetch:${url}:${referer}`);
        await writeFile(outputPath, 'video-bytes');
      };

      const outputDir = path.join(root, 'download');
      const result = await downloadWithBrowser('https://www.douyin.com/video/123', outputDir, {
        launchChromium,
        fetchMedia,
        storageStatePath: '/tmp/douyin-storage.json',
        headless: true,
      });

      expect(result).toBe(path.join(outputDir, 'source.mp4'));
      expect(await readFile(result, 'utf8')).toBe('video-bytes');
      expect(contextOptions).toEqual({ storageState: '/tmp/douyin-storage.json' });
      expect(calls).toEqual([
        'launch:true',
        'new-context',
        'goto:https://www.douyin.com/video/123',
        'fetch:https://media.example/video.mp4:https://www.douyin.com/video/123',
        'context-close',
        'browser-close',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('injects Netscape cookies before opening the video page', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openvideo-browser-test-'));
    try {
      const cookiesFile = path.join(root, 'cookies.txt');
      await writeFile(
        cookiesFile,
        [
          '# Netscape HTTP Cookie File',
          '#HttpOnly_.douyin.com\tTRUE\t/\tTRUE\t1893456000\tsessionid\tsession-value',
          '.douyin.com\tTRUE\t/\tTRUE\t1893456000\tttwid\tttwid-value',
        ].join('\n'),
      );
      const addedCookies: BrowserCookie[][] = [];
      const launchChromium: ChromiumLauncher = async () => ({
        newContext: async () => ({
          addCookies: async (cookies) => {
            addedCookies.push(cookies);
          },
          newPage: async () => ({
            goto: async () => undefined,
            evaluate: async <T>() => ({ src: 'https://media.example/video.mp4' }) as T,
            waitForTimeout: async () => undefined,
          }),
        }),
        close: async () => undefined,
      });
      const fetchMedia: MediaFetcher = async (_url, outputPath) => {
        await writeFile(outputPath, 'video-bytes');
      };

      await downloadWithBrowser('https://www.douyin.com/video/123', path.join(root, 'download'), {
        cookiesFile,
        launchChromium,
        fetchMedia,
      });

      expect(addedCookies).toHaveLength(1);
      expect(addedCookies[0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'sessionid', httpOnly: true, value: 'session-value' }),
          expect.objectContaining({ name: 'ttwid', domain: '.douyin.com', value: 'ttwid-value' }),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('downloads and muxes blob-backed video and audio resources', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openvideo-browser-test-'));
    try {
      let evaluateCount = 0;
      const fetched: string[] = [];
      const merged: string[] = [];
      const launchChromium: ChromiumLauncher = async () => ({
        newContext: async () => ({
          newPage: async () => ({
            goto: async () => undefined,
            evaluate: async <T>() => {
              evaluateCount += 1;
              if (evaluateCount === 1) {
                return { src: 'blob:https://www.douyin.com/video', duration: 308 } as T;
              }
              return [
                { type: 'video', url: 'https://v.example/media-video-hvc1/?token=1' },
                { type: 'audio', url: 'https://v.example/media-audio-und-mp4a/?token=1' },
              ] as T;
            },
            waitForTimeout: async () => undefined,
          }),
        }),
        close: async () => undefined,
      });

      const result = await downloadWithBrowser('https://www.douyin.com/video/123', path.join(root, 'download'), {
        launchChromium,
        fetchMedia: async (url, outputPath) => {
          fetched.push(url);
          await writeFile(outputPath, 'media');
        },
        mergeMedia: async (videoPath, audioPath, outputPath) => {
          merged.push(`${path.basename(videoPath)}+${path.basename(audioPath)}`);
          await writeFile(outputPath, 'merged');
        },
      });

      expect(fetched).toEqual([
        'https://v.example/media-video-hvc1/?token=1',
        'https://v.example/media-audio-und-mp4a/?token=1',
      ]);
      expect(merged).toEqual(['source.video.mp4+source.audio.m4a']);
      expect(await readFile(result, 'utf8')).toBe('merged');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('readBrowserCookies', () => {
  it('supports Playwright storage-state JSON files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openvideo-browser-test-'));
    try {
      const cookiesFile = path.join(root, 'storage.json');
      await writeFile(
        cookiesFile,
        JSON.stringify({
          cookies: [{ name: 'ttwid', value: 'ttwid-value', domain: '.douyin.com', path: '/', secure: true }],
        }),
      );

      await expect(readBrowserCookies(cookiesFile)).resolves.toEqual([
        expect.objectContaining({ name: 'ttwid', value: 'ttwid-value', domain: '.douyin.com' }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('normalizes session cookie expiration to Playwright-compatible -1', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openvideo-browser-test-'));
    try {
      const cookiesFile = path.join(root, 'cookies.txt');
      await writeFile(
        cookiesFile,
        ['# Netscape HTTP Cookie File', '.douyin.com\tTRUE\t/\tTRUE\t0\tttwid\tttwid-value'].join('\n'),
      );

      await expect(readBrowserCookies(cookiesFile)).resolves.toEqual([
        expect.objectContaining({ name: 'ttwid', expires: -1 }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('converts Chrome/WebKit microsecond expiration values to Unix seconds', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openvideo-browser-test-'));
    try {
      const cookiesFile = path.join(root, 'cookies.txt');
      await writeFile(
        cookiesFile,
        ['# Netscape HTTP Cookie File', '.douyin.com\tTRUE\t/\tTRUE\t13451644264413956\tttwid\tttwid-value'].join('\n'),
      );

      await expect(readBrowserCookies(cookiesFile)).resolves.toEqual([
        expect.objectContaining({ name: 'ttwid', expires: 1807170664 }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('filterCookiesForUrl', () => {
  it('keeps only cookies for the target registrable domain', () => {
    const cookies: BrowserCookie[] = [
      { name: 'ttwid', value: 'a', domain: '.douyin.com', path: '/', expires: -1 },
      { name: 's_v_web_id', value: 'b', domain: 'www.douyin.com', path: '/', expires: -1 },
      { name: 'other', value: 'c', domain: '.example.com', path: '/', expires: -1 },
    ];

    expect(filterCookiesForUrl(cookies, 'https://v.douyin.com/abc').map((cookie) => cookie.name)).toEqual([
      'ttwid',
      's_v_web_id',
    ]);
  });
});
