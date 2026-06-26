import { spawn } from 'node:child_process';
import { resolveCommand } from './binaries.js';

export interface CommandStatus {
  command: string;
  found: boolean;
  version?: string;
  output?: string;
  error?: string;
}

export async function checkCommand(command: string, args: string[] = ['--version']): Promise<CommandStatus> {
  return new Promise((resolve) => {
    const child = spawn(resolveCommand(command), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      resolve({ command, found: false, error: err.message });
    });
    child.on('close', (code) => {
      const output = `${stdout}\n${stderr}`.trim();
      const firstLine = output.split(/\r?\n/).find((line) => line.trim().length > 0);
      resolve({
        command,
        found: code === 0,
        ...(firstLine ? { version: firstLine.trim() } : {}),
        ...(output ? { output } : {}),
        ...(code === 0 ? {} : { error: `exited with code ${code}` }),
      });
    });
  });
}
