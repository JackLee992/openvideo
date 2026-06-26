import { spawn } from 'node:child_process';
import type { ExtractedFrame } from './frames.js';

export interface CaptionObservation {
  frameIndex: number;
  frameName: string;
  text: string;
  confidence: number;
  language: string;
  source: 'tesseract';
}

export interface CaptionDetectionResult {
  available: boolean;
  provider: 'tesseract';
  language: string;
  observations: CaptionObservation[];
  error?: string;
}

export interface TesseractRunOptions {
  command: string;
  language: string;
  psm: string;
}

export type TesseractRunner = (imagePath: string, options: TesseractRunOptions) => Promise<string>;

export interface CaptionDetectionOptions {
  language?: string;
  minConfidence?: number;
  psm?: string;
  tesseractCommand?: string;
  runner?: TesseractRunner;
}

interface ParseTesseractOptions {
  frameIndex: number;
  frameName: string;
  language: string;
  minConfidence?: number;
}

export async function detectCaptionsInFrames(
  frames: ExtractedFrame[],
  options: CaptionDetectionOptions = {},
): Promise<CaptionDetectionResult> {
  const language = options.language ?? process.env.OPENVIDEO_OCR_LANG ?? 'chi_sim+eng';
  const provider = 'tesseract';
  const runner = options.runner ?? runTesseract;
  const runOptions = {
    command: options.tesseractCommand ?? 'tesseract',
    language,
    psm: options.psm ?? '6',
  };
  const observations: CaptionObservation[] = [];

  for (const frame of frames) {
    try {
      const tsv = await runner(frame.path, runOptions);
      const observation = parseTesseractTsv(tsv, {
        frameIndex: frame.index,
        frameName: frame.fileName,
        language,
        minConfidence: options.minConfidence,
      });
      if (observation) {
        observations.push(observation);
      }
    } catch (error) {
      return {
        available: false,
        provider,
        language,
        observations: [],
        error: tesseractErrorMessage(error, runOptions.command),
      };
    }
  }

  return {
    available: true,
    provider,
    language,
    observations,
  };
}

export function parseTesseractTsv(
  tsv: string,
  options: ParseTesseractOptions,
): CaptionObservation | undefined {
  const lines = tsv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines.shift()?.split('\t') ?? [];
  const confIndex = header.indexOf('conf');
  const textIndex = header.indexOf('text');
  if (confIndex === -1 || textIndex === -1) {
    return undefined;
  }

  const minConfidence = options.minConfidence ?? 35;
  const words: string[] = [];
  const confidences: number[] = [];
  for (const line of lines) {
    const cells = line.split('\t');
    const confidence = Number(cells[confIndex]);
    const text = cells.slice(textIndex).join('\t').trim();
    if (!Number.isFinite(confidence) || confidence < minConfidence || text.length === 0) {
      continue;
    }
    words.push(text);
    confidences.push(confidence);
  }

  if (words.length === 0) {
    return undefined;
  }

  return {
    frameIndex: options.frameIndex,
    frameName: options.frameName,
    text: words.join(' '),
    confidence: roundOne(average(confidences)),
    language: options.language,
    source: 'tesseract',
  };
}

async function runTesseract(imagePath: string, options: TesseractRunOptions): Promise<string> {
  const args = [imagePath, 'stdout', '-l', options.language, '--psm', options.psm, 'tsv'];
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${options.command} failed with code ${code}: ${stderr.trim()}`));
    });
  });
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function roundOne(value: number): number {
  return Number(value.toFixed(1));
}

function tesseractErrorMessage(error: unknown, command: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
    return `${command} is not installed or not on PATH. Install Tesseract OCR to enable caption extraction.`;
  }
  return message;
}
