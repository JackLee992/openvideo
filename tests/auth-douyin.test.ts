import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { authenticateDouyin, writeNetscapeCookieFile, type BrowserCookie } from '../src/auth/douyin.js';

describe('writeNetscapeCookieFile', () => {
  it('writes cookies in yt-dlp compatible Netscape format', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openvideo-auth-test-'));
    try {
      const outPath = path.join(root, 'douyin-cookies.txt');
      const cookies: BrowserCookie[] = [
        {
          name: 'ttwid',
          value: 'ttwid-value',
          domain: '.douyin.com',
          path: '/',
          expires: 1893456000,
          secure: true,
          httpOnly: true,
        },
      ];

      await writeNetscapeCookieFile(outPath, cookies);

      const text = await readFile(outPath, 'utf8');
      expect(text).toContain('#HttpOnly_.douyin.com\tTRUE\t/\tTRUE\t1893456000\tttwid\tttwid-value');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('authenticateDouyin', () => {
  it('opens Douyin and saves cookies after required login cookies appear', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openvideo-auth-test-'));
    try {
      const outPath = path.join(root, 'cookies.txt');
      const storagePath = path.join(root, 'storage.json');
      const calls: string[] = [];
      const cookies: BrowserCookie[] = [
        browserCookie('ttwid', 'ttwid-value'),
        browserCookie('odin_tt', 'odin-value'),
        browserCookie('passport_csrf_token', 'csrf-value'),
      ];

      const result = await authenticateDouyin(
        { outPath, storagePath, timeoutSec: 1, pollIntervalMs: 250 },
        {
          launchChromium: async () => ({
            newContext: async () => ({
              newPage: async () => ({
                goto: async (url) => {
                  calls.push(`goto:${url}`);
                },
                waitForTimeout: async () => undefined,
              }),
              cookies: async () => cookies,
              storageState: async ({ path: target }) => {
                await writeFile(target, JSON.stringify({ cookies: [] }));
              },
              close: async () => {
                calls.push('context-close');
              },
            }),
            close: async () => {
              calls.push('browser-close');
            },
          }),
        },
      );

      expect(result.cookiesPath).toBe(outPath);
      expect(result.storagePath).toBe(storagePath);
      expect(result.detectedCookies).toEqual(['ttwid', 'odin_tt', 'passport_csrf_token']);
      expect(await readFile(outPath, 'utf8')).toContain('passport_csrf_token\tcsrf-value');
      expect(calls).toEqual(['goto:https://www.douyin.com/', 'context-close', 'browser-close']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('times out when required login cookies never appear', async () => {
    await expect(
      authenticateDouyin(
        { timeoutSec: 0.001, pollIntervalMs: 250 },
        {
          launchChromium: async () => ({
            newContext: async () => ({
              newPage: async () => ({
                goto: async () => undefined,
                waitForTimeout: async () => undefined,
              }),
              cookies: async () => [browserCookie('ttwid', 'ttwid-value')],
            }),
            close: async () => undefined,
          }),
        },
      ),
    ).rejects.toThrow('Missing: odin_tt, passport_csrf_token');
  });
});

function browserCookie(name: string, value: string): BrowserCookie {
  return {
    name,
    value,
    domain: '.douyin.com',
    path: '/',
    expires: 1893456000,
    secure: true,
  };
}
