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
  it('returns usage when run directory is missing', async () => {
    const io = createIO();

    const exitCode = await runCli(['report'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Usage: openvideo report <run-dir>');
  });

  it('runs report generation and reports output paths', async () => {
    const io = createIO();

    const exitCode = await runReport(['runs/demo', '--out', 'runs/demo/analysis/custom.md'], io, {
      report: async (input) => {
        expect(input).toEqual({ runDir: 'runs/demo', outPath: 'runs/demo/analysis/custom.md' });
        return {
          reportPath: '/tmp/openvideo/report.md',
          transcriptReadablePath: '/tmp/openvideo/transcript-readable.md',
        };
      },
    });

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Wrote report: /tmp/openvideo/report.md');
    expect(io.stdout.join('\n')).toContain('Wrote transcript: /tmp/openvideo/transcript-readable.md');
  });
});
