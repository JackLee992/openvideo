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
  it('returns usage when run directory is missing', async () => {
    const io = createIO();

    const exitCode = await runCli(['report'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Usage: openvideo report <run-dir>');
  });

  it('runs markdown report and browser workbench generation', async () => {
    const io = createIO();

    const exitCode = await runReport(
      ['runs/demo', '--out', 'runs/demo/analysis/custom.md', '--html-out', 'reports/demo'],
      io,
      {
        report: async (input) => {
          expect(input).toEqual({ runDir: 'runs/demo', outPath: 'runs/demo/analysis/custom.md' });
          return {
            reportPath: '/tmp/openvideo/report.md',
            transcriptReadablePath: '/tmp/openvideo/transcript-readable.md',
          };
        },
        workbench: async (input) => {
          expect(input).toEqual({ runDir: 'runs/demo', outDir: 'reports/demo' });
          return {
            reportDir: 'reports/demo',
            indexPath: path.join('reports', 'demo', 'index.html'),
          };
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Wrote report: /tmp/openvideo/report.md');
    expect(io.stdout.join('\n')).toContain('Wrote transcript: /tmp/openvideo/transcript-readable.md');
    expect(io.stdout.join('\n')).toContain(`Created OpenVideo workbench: ${path.join('reports', 'demo', 'index.html')}`);
  });
});
