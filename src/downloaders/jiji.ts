import { spawn } from 'node:child_process';
import { chmod, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface JijiDownloaderOptions {
  toolDir?: string;
  configPath?: string;
  cookiesFile?: string;
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

export function defaultJijiPythonCommand(): string {
  return process.env.OPENVIDEO_JIJI_PYTHON_COMMAND ?? 'python3';
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

  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });
  const configPath = options.configPath ?? (await writeOpenVideoJijiConfig(resolvedOutputDir, options.cookiesFile));
  const runner = options.runner ?? runCommand;
  const result = await runner(options.pythonCommand ?? defaultJijiPythonCommand(), [
    runPy,
    '-c',
    configPath,
    '-u',
    url,
    '-p',
    resolvedOutputDir,
    '-t',
    '1',
    '--show-warnings',
  ]);
  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`;
    throw new Error(`jiji douyin-downloader failed: ${detail}`);
  }

  const findDownloadedVideo = options.findDownloadedVideo ?? findNewestVideoFile;
  const downloadedPath = await findDownloadedVideo(resolvedOutputDir);
  if (!downloadedPath) {
    const detail = summarizeCommandOutput(result);
    throw new Error(
      `jiji douyin-downloader finished but no supported video file was found under ${resolvedOutputDir}.${detail}`,
    );
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

async function writeOpenVideoJijiConfig(outputDir: string, cookiesFile?: string): Promise<string> {
  const configPath = path.join(outputDir, 'openvideo-jiji.config.yml');
  const databasePath = path.join(outputDir, 'dy_downloader.db');
  const cookieHeader = cookiesFile ? await readCookieHeader(cookiesFile) : '';
  await writeFile(
    configPath,
    [
      'link: []',
      `path: ${yamlString(outputDir)}`,
      'music: false',
      'cover: false',
      'avatar: false',
      'json: true',
      'database: true',
      `database_path: ${yamlString(databasePath)}`,
      'progress:',
      '  quiet_logs: true',
      ...(cookieHeader
        ? [`cookie: ${yamlString(cookieHeader)}`]
        : [
            'cookies:',
            '  msToken: ""',
            '  ttwid: ""',
            '  odin_tt: ""',
            '  passport_csrf_token: ""',
            '  sid_guard: ""',
          ]),
      '',
    ].join('\n'),
    'utf8',
  );
  await chmod(configPath, 0o600).catch(() => undefined);
  return configPath;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

async function readCookieHeader(cookiesFile: string): Promise<string> {
  const text = await readFile(cookiesFile, 'utf8');
  const fromJson = parseJsonCookies(text);
  if (fromJson) return fromJson;
  return parseNetscapeCookies(text);
}

function parseJsonCookies(text: string): string | null {
  try {
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const pairs = Object.entries(data)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([name, value]) => `${name}=${value}`);
    return pairs.length > 0 ? pairs.join('; ') : null;
  } catch {
    return null;
  }
}

function parseNetscapeCookies(text: string): string {
  const pairs: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || (line.startsWith('#') && !line.startsWith('#HttpOnly_'))) continue;
    const fields = line.replace(/^#HttpOnly_/, '').split(/\t+/);
    if (fields.length < 7) continue;
    const name = fields[5]?.trim();
    const value = fields.slice(6).join('\t').trim();
    if (!name || !value) continue;
    pairs.push(`${name}=${value}`);
  }
  return pairs.join('; ');
}

function summarizeCommandOutput(result: CommandResult): string {
  const output = `${result.stderr}\n${result.stdout}`.replace(/\u001b\[[0-9;]*m/g, '').trim();
  if (!output) return '';
  const compact = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
  const maxLength = 2000;
  const summary = compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
  return ` Output:\n${summary}`;
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
