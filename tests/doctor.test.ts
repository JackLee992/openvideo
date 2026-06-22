import { describe, expect, it } from 'vitest';
import {
  createDoctorReport,
  formatDoctorReport,
  type DependencyChecker,
} from '../src/cli/commands/doctor.js';
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

describe('doctor report', () => {
  it('reports required and optional dependency status', async () => {
    const checker: DependencyChecker = async (command) => ({
      command,
      found: command !== 'yt-dlp',
      version: command === 'ffmpeg' ? 'ffmpeg version 8.1.2' : undefined,
    });

    const report = await createDoctorReport(checker);

    expect(report.required.ffmpeg.found).toBe(true);
    expect(report.required.ffprobe.found).toBe(true);
    expect(report.optional.hyperframes.found).toBe(true);
    expect(report.optional['yt-dlp'].found).toBe(false);
    expect(report.readyForAnalyze).toBe(true);
    expect(report.readyForRender).toBe(true);
  });

  it('formats actionable missing dependency guidance', async () => {
    const checker: DependencyChecker = async (command) => ({
      command,
      found: command === 'node',
    });

    const text = formatDoctorReport(await createDoctorReport(checker));

    expect(text).toContain('ffmpeg: missing');
    expect(text).toContain('Install ffmpeg');
    expect(text).toContain('yt-dlp: missing');
    expect(text).toContain('optional');
  });

  it('dispatches doctor from the cli', async () => {
    const io = createIO();

    const exitCode = await runCli(['doctor'], io);

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('OpenVideo Doctor');
  });
});
