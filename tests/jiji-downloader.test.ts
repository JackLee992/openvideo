import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultJijiPythonCommand,
  defaultJijiToolDir,
  downloadWithJiji,
  type CommandRunner,
} from '../src/downloaders/jiji.js';

describe('downloadWithJiji', () => {
  it('runs the cloned jiji douyin-downloader CLI and returns the downloaded video', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push({ command, args });
      return { code: 0, stdout: 'done', stderr: '' };
    };
    const toolDir = path.join('/tmp', 'openvideo', '.openvideo', 'downloaders', 'jiji262-douyin-downloader');
    const outputDir = path.join('/tmp', 'openvideo-output');
    const configPath = path.join(outputDir, 'openvideo-jiji.config.yml');
    const downloadedPath = path.join(outputDir, 'creator', 'post', 'clip.mp4');

    const result = await downloadWithJiji('https://www.douyin.com/video/123', outputDir, {
      toolDir,
      configPath,
      runner,
      pathExists: async () => true,
      findDownloadedVideo: async () => downloadedPath,
    });

    expect(result).toBe(downloadedPath);
    expect(calls).toEqual([
      {
        command: 'python3',
        args: [
          path.join(toolDir, 'run.py'),
          '-c',
          configPath,
          '-u',
          'https://www.douyin.com/video/123',
          '-p',
          outputDir,
          '-t',
          '1',
          '--show-warnings',
        ],
      },
    ]);
  });

  it('includes jiji output when the CLI exits without producing a video', async () => {
    const runner: CommandRunner = async () => ({
      code: 0,
      stdout: 'Config file not found: config.yml',
      stderr: '',
    });

    await expect(
      downloadWithJiji('https://www.douyin.com/video/123', '/tmp/openvideo-output', {
        toolDir: '/tmp/jiji262-douyin-downloader',
        configPath: '/tmp/openvideo-output/openvideo-jiji.config.yml',
        runner,
        pathExists: async () => true,
        findDownloadedVideo: async () => null,
      }),
    ).rejects.toThrow('Config file not found: config.yml');
  });

  it('writes Netscape cookie files into the generated jiji config', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openvideo-jiji-test-'));
    try {
      const outputDir = path.join(root, 'download');
      const cookiesFile = path.join(root, 'cookies.txt');
      const downloadedPath = path.join(outputDir, 'clip.mp4');
      await writeFile(
        cookiesFile,
        ['# Netscape HTTP Cookie File', '.douyin.com\tTRUE\t/\tTRUE\t1893456000\tttwid\tttwid-value', '.douyin.com\tTRUE\t/\tTRUE\t1893456000\todin_tt\todin-value'].join(
          '\n',
        ),
      );
      const runner: CommandRunner = async () => ({ code: 0, stdout: 'done', stderr: '' });

      await downloadWithJiji('https://www.douyin.com/video/123', outputDir, {
        toolDir: '/tmp/jiji262-douyin-downloader',
        cookiesFile,
        runner,
        pathExists: async () => true,
        findDownloadedVideo: async () => downloadedPath,
      });

      const config = await readFile(path.join(outputDir, 'openvideo-jiji.config.yml'), 'utf8');
      expect(config).toContain('cookie: "ttwid=ttwid-value; odin_tt=odin-value"');
      expect(config).not.toContain('cookies:');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
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

describe('defaultJijiPythonCommand', () => {
  it('uses OPENVIDEO_JIJI_PYTHON_COMMAND when set', () => {
    const previous = process.env.OPENVIDEO_JIJI_PYTHON_COMMAND;
    process.env.OPENVIDEO_JIJI_PYTHON_COMMAND = '/custom/python';

    try {
      expect(defaultJijiPythonCommand()).toBe('/custom/python');
    } finally {
      if (previous === undefined) {
        delete process.env.OPENVIDEO_JIJI_PYTHON_COMMAND;
      } else {
        process.env.OPENVIDEO_JIJI_PYTHON_COMMAND = previous;
      }
    }
  });
});
