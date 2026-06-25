import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { downloadWithYtDlp, type CommandRunner } from '../src/sources/yt-dlp.js';

describe('downloadWithYtDlp', () => {
  it('asks yt-dlp to save one platform video into the run input folder', async () => {
    const outputDir = path.join('/tmp', 'openvideo-run', 'input');
    const downloadedPath = path.join(outputDir, 'source.mp4');
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push({ command, args });
      return { code: 0, stdout: `${downloadedPath}\n`, stderr: '' };
    };

    const result = await downloadWithYtDlp('https://www.douyin.com/video/123', outputDir, runner);

    expect(result).toBe(downloadedPath);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe('yt-dlp');
    expect(calls[0]?.args).toEqual(
      expect.arrayContaining([
        '--no-playlist',
        '--merge-output-format',
        'mp4',
        '--paths',
        outputDir,
        '--output',
        'source.%(ext)s',
        '--print',
        'after_move:filepath',
        'https://www.douyin.com/video/123',
      ]),
    );
  });

  it('explains how to install yt-dlp when the command is missing', async () => {
    const runner: CommandRunner = async () => {
      const error = new Error('spawn yt-dlp ENOENT') as Error & { code: string };
      error.code = 'ENOENT';
      throw error;
    };

    await expect(downloadWithYtDlp('https://www.douyin.com/video/123', '/tmp/openvideo-input', runner)).rejects.toThrow(
      'yt-dlp is required for platform video URLs',
    );
  });
});
