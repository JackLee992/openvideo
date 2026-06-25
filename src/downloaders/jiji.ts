import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface JijiDownloaderOptions {
  toolDir?: string;
  pythonCommand?: string;
  runner?: CommandRunner;
  pathExists?: (targetPath: string) => Promise<boolean>;
  findDownloadedVideo?: (outputDir: string) => Promise<string | null>;
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v']);

export function defaultDownloadersDir(cwd = process.cwd()): string {
  return process.env.OPENVIDEO_DOWNLOADERS_DIR ?? path.join(cwd, '.openvideo', 'downloaders');
}

export function defaultJijiToolDir(cwd = process.cwd()): string {
  return process.env.OPENVIDEO_JIJI_DOWNLOADER_DIR ?? path.join(defaultDownloadersDir(cwd), 'jiji262-douyin-downloader');
}

export async function downloadWithJiji(
  url: string,
  outputDir: string,
  options: JijiDownloaderOptions = {},
): Promise<string> {
  const toolDir = options.toolDir ?? defaultJijiToolDir();
  const runPy = path.join(toolDir, 'run.py');
  const pathExists = options.pathExists ?? exists;
  if (!(await pathExists(runPy))) {
    throw new Error(
      `jiji262/douyin-downloader is not cloned at ${toolDir}. Run scripts/downloaders/clone-downloaders.sh first, or set OPENVIDEO_JIJI_DOWNLOADER_DIR.`,
    );
  }

  const runner = options.runner ?? runCommand;
  const result = await runner(options.pythonCommand ?? 'python3', [runPy, '-u', url, '-p', outputDir, '-t', '1']);
  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`;
    throw new Error(`jiji douyin-downloader failed: ${detail}`);
  }

  const findDownloadedVideo = options.findDownloadedVideo ?? findNewestVideoFile;
  const downloadedPath = await findDownloadedVideo(outputDir);
  if (!downloadedPath) {
    throw new Error(`jiji douyin-downloader finished but no supported video file was found under ${outputDir}.`);
  }
  return downloadedPath;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findNewestVideoFile(rootDir: string): Promise<string | null> {
  const candidates: Array<{ path: string; mtimeMs: number }> = [];
  await collectVideoFiles(rootDir, candidates);
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
  return candidates[0]?.path ?? null;
}

async function collectVideoFiles(rootDir: string, candidates: Array<{ path: string; mtimeMs: number }>): Promise<void> {
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await collectVideoFiles(entryPath, candidates);
      continue;
    }
    if (!entry.isFile() || !VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    const info = await stat(entryPath);
    candidates.push({ path: entryPath, mtimeMs: info.mtimeMs });
  }
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
