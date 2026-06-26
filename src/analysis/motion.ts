import { spawn } from 'node:child_process';
import type { DetectedScene } from './scenes.js';

export type CameraMovement =
  | 'unknown'
  | 'locked-off'
  | 'subtle-movement'
  | 'pan-or-reframe'
  | 'push-in-or-graphic-motion'
  | 'high-motion';

export type MotionIntensity = 'low' | 'medium' | 'high';
export type DominantDirection = 'none' | 'left' | 'right' | 'up' | 'down';

export interface GrayFrameSample {
  index: number;
  timestampSec: number;
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface MotionSample {
  index: number;
  timestampSec: number;
  centroidX: number;
  centroidY: number;
  brightness: number;
}

export interface VisualMotionDetectionResult {
  available: boolean;
  provider: 'ffmpeg-raw-gray';
  frameCount: number;
  averageFrameDiff: number;
  centroidShift: { x: number; y: number };
  motionIntensity: MotionIntensity;
  cameraMovement: CameraMovement;
  dominantDirection: DominantDirection;
  samples: MotionSample[];
  error?: string;
}

export interface SceneMotionProfile {
  sceneIndex: number;
  cameraMovement: CameraMovement;
  motionIntensity: MotionIntensity;
  dominantDirection: DominantDirection;
  sampleCount: number;
}

export interface VisualMotionOptions {
  fps?: number;
  width?: number;
  height?: number;
  maxFrames?: number;
}

export async function detectVisualMotion(
  inputPath: string,
  _durationSec: number,
  options: VisualMotionOptions = {},
): Promise<VisualMotionDetectionResult> {
  try {
    return analyzeGrayFrameMotion(await extractGrayFrames(inputPath, options));
  } catch (error) {
    return unavailableMotion(error instanceof Error ? error.message : String(error));
  }
}

export function analyzeGrayFrameMotion(frames: GrayFrameSample[]): VisualMotionDetectionResult {
  if (frames.length === 0) {
    return unavailableMotion('No frames available for motion analysis.');
  }
  const samples = frames.map(frameSample);
  const averageFrameDiff = averageFrameDifference(frames);
  const first = samples[0] ?? { centroidX: 0.5, centroidY: 0.5 };
  const last = samples[samples.length - 1] ?? first;
  const centroidShift = {
    x: round3(last.centroidX - first.centroidX),
    y: round3(last.centroidY - first.centroidY),
  };
  const motionIntensity = intensityFor(averageFrameDiff, centroidShift);
  const dominantDirection = directionFor(centroidShift);

  return {
    available: true,
    provider: 'ffmpeg-raw-gray',
    frameCount: frames.length,
    averageFrameDiff,
    centroidShift,
    motionIntensity,
    cameraMovement: cameraMovementFor(averageFrameDiff, centroidShift, motionIntensity),
    dominantDirection,
    samples,
  };
}

export function buildSceneMotionProfiles(
  scenes: DetectedScene[],
  motion: VisualMotionDetectionResult | undefined,
): SceneMotionProfile[] {
  return scenes.map((scene) => {
    const sampleCount = (motion?.samples ?? []).filter(
      (sample) => sample.timestampSec >= scene.startSec && sample.timestampSec <= scene.endSec,
    ).length;
    return {
      sceneIndex: scene.index,
      cameraMovement: motion?.cameraMovement ?? 'unknown',
      motionIntensity: motion?.motionIntensity ?? 'low',
      dominantDirection: motion?.dominantDirection ?? 'none',
      sampleCount,
    };
  });
}

export function unavailableMotion(error: string): VisualMotionDetectionResult {
  return {
    available: false,
    provider: 'ffmpeg-raw-gray',
    frameCount: 0,
    averageFrameDiff: 0,
    centroidShift: { x: 0, y: 0 },
    motionIntensity: 'low',
    cameraMovement: 'unknown',
    dominantDirection: 'none',
    samples: [],
    error,
  };
}

async function extractGrayFrames(inputPath: string, options: VisualMotionOptions): Promise<GrayFrameSample[]> {
  const fps = options.fps ?? 2;
  const width = options.width ?? 32;
  const height = options.height ?? 32;
  const maxFrames = options.maxFrames ?? 24;
  const frameSize = width * height;
  const args = [
    '-hide_banner',
    '-i',
    inputPath,
    '-vf',
    `fps=${fps},scale=${width}:${height}:flags=area,format=gray`,
    '-frames:v',
    String(maxFrames),
    '-f',
    'rawvideo',
    'pipe:1',
  ];
  const output = await runFfmpegRaw(args);
  const frameCount = Math.floor(output.length / frameSize);
  return Array.from({ length: frameCount }, (_, index) => {
    const start = index * frameSize;
    return {
      index: index + 1,
      timestampSec: round3(index / fps),
      width,
      height,
      pixels: output.subarray(start, start + frameSize),
    };
  });
}

function frameSample(frame: GrayFrameSample): MotionSample {
  let total = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const value = frame.pixels[y * frame.width + x] ?? 0;
      total += value;
      weightedX += value * x;
      weightedY += value * y;
    }
  }
  const centroidX = total > 0 ? weightedX / total / Math.max(1, frame.width - 1) : 0.5;
  const centroidY = total > 0 ? weightedY / total / Math.max(1, frame.height - 1) : 0.5;
  const brightness = total / Math.max(1, frame.pixels.length) / 255;
  return {
    index: frame.index,
    timestampSec: frame.timestampSec,
    centroidX: round3(centroidX),
    centroidY: round3(centroidY),
    brightness: round3(brightness),
  };
}

function averageFrameDifference(frames: GrayFrameSample[]): number {
  if (frames.length < 2) return 0;
  const diffs: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    const previous = frames[i - 1];
    const current = frames[i];
    if (!previous || !current || previous.pixels.length !== current.pixels.length) continue;
    let sum = 0;
    for (let pixel = 0; pixel < current.pixels.length; pixel++) {
      sum += Math.abs((current.pixels[pixel] ?? 0) - (previous.pixels[pixel] ?? 0));
    }
    diffs.push(sum / current.pixels.length / 255);
  }
  return round3(average(diffs));
}

function cameraMovementFor(
  averageFrameDiff: number,
  centroidShift: { x: number; y: number },
  motionIntensity: MotionIntensity,
): CameraMovement {
  const shiftMagnitude = Math.hypot(centroidShift.x, centroidShift.y);
  if (averageFrameDiff < 0.02 && shiftMagnitude < 0.04) return 'locked-off';
  if (shiftMagnitude >= 0.18) return 'pan-or-reframe';
  if (averageFrameDiff >= 0.18 && shiftMagnitude < 0.18) return 'push-in-or-graphic-motion';
  if (motionIntensity === 'high') return 'high-motion';
  return 'subtle-movement';
}

function intensityFor(averageFrameDiff: number, centroidShift: { x: number; y: number }): MotionIntensity {
  const shiftMagnitude = Math.hypot(centroidShift.x, centroidShift.y);
  if (averageFrameDiff >= 0.25 || shiftMagnitude >= 0.35) return 'high';
  if (averageFrameDiff >= 0.08 || shiftMagnitude >= 0.12) return 'medium';
  return 'low';
}

function directionFor(centroidShift: { x: number; y: number }): DominantDirection {
  const absX = Math.abs(centroidShift.x);
  const absY = Math.abs(centroidShift.y);
  if (Math.max(absX, absY) < 0.12) return 'none';
  if (absX >= absY) return centroidShift.x > 0 ? 'right' : 'left';
  return centroidShift.y > 0 ? 'down' : 'up';
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

async function runFfmpegRaw(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
        return;
      }
      reject(new Error(`ffmpeg visual motion analysis failed with code ${code}: ${stderr.trim()}`));
    });
  });
}
