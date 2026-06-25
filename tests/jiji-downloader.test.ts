import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultJijiToolDir, downloadWithJiji, type CommandRunner } from '../src/downloaders/jiji.js';

describe('downloadWithJiji', () => {
  it('runs the cloned jiji douyin-downloader CLI and returns the downloaded video', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push({ command, args });
      return { code: 0, stdout: 'done', stderr: '' };
    };
    const toolDir = path.join('/tmp', 'openvideo', '.openvideo', 'downloaders', 'jiji262-douyin-downloader');
    const outputDir = path.join('/tmp', 'openvideo-output');
    const downloadedPath = path.join(outputDir, 'creator', 'post', 'clip.mp4');

    const result = await downloadWithJiji('https://www.douyin.com/video/123', outputDir, {
      toolDir,
      runner,
      pathExists: async () => true,
      findDownloadedVideo: async () => downloadedPath,
    });

    expect(result).toBe(downloadedPath);
    expect(calls).toEqual([
      {
        command: 'python3',
        args: [path.join(toolDir, 'run.py'), '-u', 'https://www.douyin.com/video/123', '-p', outputDir, '-t', '1'],
      },
    ]);
  });

  it('explains how to clone the jiji downloader when the tool is missing', async () => {
    await expect(
      downloadWithJiji('https://www.douyin.com/video/123', '/tmp/openvideo-output', {
        toolDir: '/missing/jiji262-douyin-downloader',
        pathExists: async () => false,
      }),
    ).rejects.toThrow('jiji262/douyin-downloader is not cloned');
  });
});

describe('defaultJijiToolDir', () => {
  it('uses OPENVIDEO_JIJI_DOWNLOADER_DIR when set', () => {
    const previous = process.env.OPENVIDEO_JIJI_DOWNLOADER_DIR;
    process.env.OPENVIDEO_JIJI_DOWNLOADER_DIR = '/custom/jiji';

    try {
      expect(defaultJijiToolDir('/project')).toBe('/custom/jiji');
    } finally {
      if (previous === undefined) {
        delete process.env.OPENVIDEO_JIJI_DOWNLOADER_DIR;
      } else {
        process.env.OPENVIDEO_JIJI_DOWNLOADER_DIR = previous;
      }
    }
  });
});
