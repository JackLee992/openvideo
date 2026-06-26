import { describe, expect, it } from 'vitest';
import { runAuth } from '../src/cli/commands/auth.js';
import { runCli, type CliIO } from '../src/cli/index.js';

function createIO(): CliIO & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    writeOut: (line) => stdout.push(line),
    writeErr: (line) => stderr.push(line),
  };
}

describe('openvideo auth cli', () => {
  it('returns usage when provider is missing', async () => {
    const io = createIO();

    const exitCode = await runCli(['auth'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Usage: openvideo auth douyin');
  });

  it('runs Douyin auth and reports the cookie output path', async () => {
    const io = createIO();

    const exitCode = await runAuth(
      [
        'douyin',
        '--out',
        '/tmp/douyin-cookies.txt',
        '--storage',
        '/tmp/douyin-storage.json',
        '--timeout',
        '120',
        '--url',
        'https://www.douyin.com/video/123',
      ],
      io,
      {
        authenticate: async (input) => {
          expect(input).toEqual({
            outPath: '/tmp/douyin-cookies.txt',
            storagePath: '/tmp/douyin-storage.json',
            timeoutSec: 120,
            url: 'https://www.douyin.com/video/123',
          });
          return {
            cookiesPath: '/tmp/douyin-cookies.txt',
            storagePath: '/tmp/douyin-storage.json',
            cookieCount: 8,
            detectedCookies: ['ttwid', 'odin_tt', 'passport_csrf_token'],
          };
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Wrote cookies: /tmp/douyin-cookies.txt');
    expect(io.stdout.join('\n')).toContain('ttwid, odin_tt, passport_csrf_token');
  });
});
