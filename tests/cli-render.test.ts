import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runRender } from '../src/cli/commands/render.js';
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

describe('openvideo render cli', () => {
  it('prepares a HyperFrames render project from a run', async () => {
    const io = createIO();

    const exitCode = await runRender(['run-dir', '--prompt', '介绍一个能自动生成设计稿的工具', '--out', 'renders'], io, {
      prepareRender: async (input) => {
        expect(input).toEqual({
          runDir: 'run-dir',
          prompt: '介绍一个能自动生成设计稿的工具',
          outDir: 'renders',
        });
        return {
          projectDir: path.join('renders', 'run-1'),
          indexPath: path.join('renders', 'run-1', 'index.html'),
          notesPath: path.join('renders', 'run-1', 'OPENVIDEO_RENDER.md'),
        };
      },
    });

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Prepared HyperFrames project');
    expect(io.stdout.join('\n')).toContain(path.join('renders', 'run-1'));
  });

  it('returns usage when prompt is missing', async () => {
    const io = createIO();

    const exitCode = await runRender(['run-dir'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Missing --prompt.');
  });

  it('dispatches render from the top-level cli', async () => {
    const io = createIO();

    const exitCode = await runCli(['render'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Usage: openvideo render <run-dir>');
  });
});
