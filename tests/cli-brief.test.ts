import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runBrief } from '../src/cli/commands/brief.js';
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

describe('openvideo brief cli', () => {
  it('creates a generation brief with the requested goal', async () => {
    const io = createIO();
    const runDir = path.join('/tmp', 'openvideo-run');

    const exitCode = await runBrief(['run-dir', '--goal', '做一个 AI 工具教程类抖音短视频'], io, {
      createBrief: async (input) => {
        expect(input).toEqual({
          runDir: 'run-dir',
          goal: '做一个 AI 工具教程类抖音短视频',
        });
        return { outputPath: path.join(runDir, 'generation-brief.md') };
      },
    });

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Wrote generation brief');
    expect(io.stdout.join('\n')).toContain(path.join(runDir, 'generation-brief.md'));
  });

  it('returns usage when goal is missing', async () => {
    const io = createIO();

    const exitCode = await runBrief(['run-dir'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Missing --goal.');
  });

  it('dispatches brief from the top-level cli', async () => {
    const io = createIO();

    const exitCode = await runCli(['brief'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Usage: openvideo brief <run-dir>');
  });
});
