import { spawn } from 'node:child_process';

export interface DetectedScene {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface SceneCut {
  timestampSec: number;
}

export interface SceneDetectionOptions {
  threshold?: number;
  minSceneDurationSec?: number;
}

export interface SceneDetectionResult {
  threshold: number;
  cuts: SceneCut[];
  scenes: DetectedScene[];
  raw: string;
}

export async function detectScenes(
  inputPath: string,
  durationSec: number,
  options: SceneDetectionOptions = {},
): Promise<SceneDetectionResult> {
  const threshold = options.threshold ?? 0.32;
  const raw = await runFfmpegSceneDetection(inputPath, threshold);
  const cutTimes = parseSceneCutTimes(raw);
  const scenes = buildScenesFromCuts(cutTimes, durationSec, {
    minSceneDurationSec: options.minSceneDurationSec ?? 0.25,
  });
  return {
    threshold,
    cuts: scenes.slice(1).map((scene) => ({ timestampSec: scene.startSec })),
    scenes,
    raw,
  };
}

export function parseSceneCutTimes(output: string): number[] {
  const times = new Set<number>();
  for (const match of output.matchAll(/pts_time:([0-9]+(?:\.[0-9]+)?)/g)) {
    times.add(roundSec(Number(match[1])));
  }
  return [...times].filter((time) => Number.isFinite(time) && time > 0).sort((a, b) => a - b);
}

export function buildScenesFromCuts(
  cutTimes: number[],
  durationSec: number,
  options: Pick<SceneDetectionOptions, 'minSceneDurationSec'> = {},
): DetectedScene[] {
  const duration = roundSec(Math.max(0, durationSec));
  const minSceneDurationSec = options.minSceneDurationSec ?? 0;
  const validCuts = [...new Set(cutTimes.map(roundSec))]
    .filter((time) => time > 0 && time < duration)
    .sort((a, b) => a - b);
  const boundaries = [0, ...validCuts, duration];
  const scenes: DetectedScene[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startSec = boundaries[i] ?? 0;
    const endSec = boundaries[i + 1] ?? duration;
    const sceneDuration = roundSec(endSec - startSec);
    if (sceneDuration < minSceneDurationSec) {
      continue;
    }
    scenes.push({
      index: scenes.length + 1,
      startSec,
      endSec,
      durationSec: sceneDuration,
    });
  }

  return scenes.length > 0 ? scenes : [{ index: 1, startSec: 0, endSec: duration, durationSec: duration }];
}

async function runFfmpegSceneDetection(inputPath: string, threshold: number): Promise<string> {
  const args = [
    '-hide_banner',
    '-i',
    inputPath,
    '-vf',
    `select='gt(scene,${threshold})',showinfo`,
    '-f',
    'null',
    '-',
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stderr);
        return;
      }
      reject(new Error(`ffmpeg scene detection failed with code ${code}: ${stderr.trim()}`));
    });
  });
}

function roundSec(value: number): number {
  return Number(value.toFixed(3));
}
