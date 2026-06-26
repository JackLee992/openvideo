import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runReport } from '../src/cli/commands/report.js';
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

describe('openvideo report cli', () => {
  it('creates an analysis workbench for a run', async () => {
    const io = createIO();

    const exitCode = await runReport(['run-dir', '--out', 'reports/run-1'], io, {
      createReport: async (input) => {
        expect(input).toEqual({ runDir: 'run-dir', outDir: 'reports/run-1' });
        return {
          reportDir: path.join('reports', 'run-1'),
          indexPath: path.join('reports', 'run-1', 'index.html'),
        };
      },
    });

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Created OpenVideo workbench');
    expect(io.stdout.join('\n')).toContain(path.join('reports', 'run-1', 'index.html'));
  });

  it('returns usage when run dir is missing', async () => {
    const io = createIO();

    const exitCode = await runReport([], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Usage: openvideo report <run-dir>');
  });

  it('dispatches report from the top-level cli', async () => {
    const io = createIO();

    const exitCode = await runCli(['report'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Usage: openvideo report <run-dir>');
  });
});
