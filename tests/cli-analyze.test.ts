import { describe, expect, it } from 'vitest';
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

describe('openvideo analyze cli', () => {
  it('returns usage when input is missing', async () => {
    const io = createIO();

    const exitCode = await runCli(['analyze'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Usage: openvideo analyze <file-or-url>');
  });

  it('rejects unknown downloader strategies', async () => {
    const io = createIO();

    const exitCode = await runCli(['analyze', 'https://www.douyin.com/video/123', '--downloader', 'unknown'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Unknown downloader: unknown');
  });
});
