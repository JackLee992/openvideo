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

describe('openvideo cli help', () => {
  it('prints help with the planned command surface', async () => {
    const io = createIO();

    const exitCode = await runCli(['--help'], io);

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Usage: openvideo <command>');
    expect(io.stdout.join('\n')).toContain('doctor');
    expect(io.stdout.join('\n')).toContain('auth douyin');
    expect(io.stdout.join('\n')).toContain('download <url>');
    expect(io.stdout.join('\n')).toContain('analyze <file-or-url>');
    expect(io.stdout.join('\n')).toContain('report <run-dir>');
    expect(io.stdout.join('\n')).toContain('brief <run-dir>');
    expect(io.stdout.join('\n')).toContain('report <run-dir>');
    expect(io.stdout.join('\n')).toContain('render <run-dir>');
  });

  it('returns exit code 2 for unknown commands', async () => {
    const io = createIO();

    const exitCode = await runCli(['wat'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Unknown command: wat');
  });
});
