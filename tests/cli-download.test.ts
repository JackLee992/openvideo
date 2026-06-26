import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runDownload } from '../src/cli/commands/download.js';
import type { CliIO } from '../src/cli/index.js';

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

describe('runDownload', () => {
  it('downloads a URL with the selected provider strategy', async () => {
    const io = createIO();
    const outDir = path.join('/tmp', 'openvideo-downloads');

    const exitCode = await runDownload(
      [
        'https://www.douyin.com/video/123',
        '--out',
        outDir,
        '--downloader',
        'jiji',
        '--cookies',
        '/tmp/cookies.txt',
        '--cookies-from-browser',
        'chrome',
        '--storage',
        '/tmp/douyin-storage.json',
      ],
      io,
      {
        download: async (input) => {
          expect(input).toEqual({
            url: 'https://www.douyin.com/video/123',
            outDir,
            downloader: 'jiji',
            cookiesFile: '/tmp/cookies.txt',
            cookiesFromBrowser: 'chrome',
            browserStoragePath: '/tmp/douyin-storage.json',
          });
          return {
            downloadId: 'run-1',
            outputDir: path.join(outDir, 'run-1'),
            provider: 'jiji',
            path: path.join(outDir, 'run-1', 'clip.mp4'),
            attempts: [{ provider: 'jiji', ok: true, path: path.join(outDir, 'run-1', 'clip.mp4') }],
          };
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Provider: jiji');
    expect(io.stdout.join('\n')).toContain(path.join(outDir, 'run-1', 'clip.mp4'));
  });

  it('accepts the browser downloader strategy', async () => {
    const io = createIO();

    const exitCode = await runDownload(['https://www.douyin.com/video/123', '--downloader', 'browser'], io, {
      download: async (input) => {
        expect(input.downloader).toBe('browser');
        return {
          downloadId: 'run-1',
          outputDir: '/tmp/openvideo/run-1',
          provider: 'browser',
          path: '/tmp/openvideo/run-1/source.mp4',
          attempts: [{ provider: 'browser', ok: true, path: '/tmp/openvideo/run-1/source.mp4' }],
        };
      },
    });

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Provider: browser');
  });

  it('rejects unknown downloader strategies', async () => {
    const io = createIO();

    const exitCode = await runDownload(['https://www.douyin.com/video/123', '--downloader', 'unknown'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Unknown downloader: unknown');
  });
});
