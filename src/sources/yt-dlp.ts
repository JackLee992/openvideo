import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface YtDlpDownloadOptions {
  cookiesFile?: string;
  cookiesFromBrowser?: string;
}

export async function downloadWithYtDlp(
  url: string,
  outputDir: string,
  runner: CommandRunner = runCommand,
  options: YtDlpDownloadOptions = {},
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const args = [
    '--no-playlist',
    '--merge-output-format',
    'mp4',
    '--paths',
    outputDir,
    '--output',
    'source.%(ext)s',
    '--print',
    'after_move:filepath',
    ...cookieArgs(options),
    url,
  ];

  let result: CommandResult;
  try {
    result = await runner('yt-dlp', args);
  } catch (error) {
    if (isMissingCommandError(error)) {
      throw new Error('yt-dlp is required for platform video URLs. Install it with: brew install yt-dlp');
    }
    throw error;
  }

  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`;
    throw new Error(`yt-dlp failed to download the video: ${detail}`);
  }

  const downloadedPath = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (!downloadedPath) {
    throw new Error('yt-dlp finished without reporting a downloaded file path.');
  }
  return downloadedPath;
}

function cookieArgs(options: YtDlpDownloadOptions): string[] {
  return [
    ...(options.cookiesFile ? ['--cookies', options.cookiesFile] : []),
    ...(options.cookiesFromBrowser ? ['--cookies-from-browser', options.cookiesFromBrowser] : []),
  ];
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function isMissingCommandError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
