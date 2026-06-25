import { mkdir, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

export interface ExtractFramesOptions {
  fps?: string;
  maxFrames?: number;
}

export interface ExtractedFrame {
  index: number;
  fileName: string;
  path: string;
}

export async function extractFrames(
  inputPath: string,
  framesDir: string,
  options: ExtractFramesOptions = {},
): Promise<ExtractedFrame[]> {
  await mkdir(framesDir, { recursive: true });
  const fps = options.fps ?? '1/2';
  const maxFrames = options.maxFrames ?? 12;
  const outputPattern = path.join(framesDir, 'frame-%04d.jpg');
  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-vf',
    `fps=${fps}`,
    '-frames:v',
    String(maxFrames),
    outputPattern,
  ]);
  const files = (await readdir(framesDir)).filter((file) => /^frame-\d+\.jpg$/.test(file)).sort();
  return files.map((fileName, index) => ({
    index: index + 1,
    fileName,
    path: path.join(framesDir, fileName),
  }));
}

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg failed with code ${code}: ${stderr.trim()}`));
    });
  });
}
