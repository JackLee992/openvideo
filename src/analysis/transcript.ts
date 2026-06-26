import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

export interface TranscriptWord {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface TranscriptDetectionResult {
  available: boolean;
  provider: 'hyperframes-transcribe';
  model: string;
  language?: string;
  words: TranscriptWord[];
  text: string;
  error?: string;
}

export interface HyperframesTranscribeRunResult {
  stdout: string;
  stderr: string;
  code: number;
}

export type HyperframesTranscribeRunner = (
  inputPath: string,
  args: string[],
) => Promise<HyperframesTranscribeRunResult>;

export interface TranscriptDetectionOptions {
  model?: string;
  language?: string;
  runner?: HyperframesTranscribeRunner;
}

export async function detectTranscript(
  inputPath: string,
  options: TranscriptDetectionOptions = {},
): Promise<TranscriptDetectionResult> {
  const model = options.model ?? process.env.OPENVIDEO_TRANSCRIBE_MODEL ?? 'small';
  const language = options.language ?? process.env.OPENVIDEO_TRANSCRIBE_LANGUAGE;
  const args = [
    'hyperframes',
    'transcribe',
    '--json',
    '--optional',
    '--model',
    model,
    ...(language ? ['--language', language] : []),
    inputPath,
  ];
  const runner = options.runner ?? runHyperframesTranscribe;

  try {
    const result = await runner(inputPath, args);
    if (result.code !== 0) {
      return unavailableTranscript(model, language, result.stderr || `hyperframes transcribe exited with code ${result.code}`);
    }
    const words = await readHyperframesTranscriptWords(result.stdout);
    return {
      available: true,
      provider: 'hyperframes-transcribe',
      model,
      ...(language ? { language } : {}),
      words,
      text: words.map((word) => word.text).join(' '),
    };
  } catch (error) {
    return unavailableTranscript(model, language, transcriptErrorMessage(error));
  }
}

export function transcriptUnavailable(
  error: string,
  options: Pick<TranscriptDetectionResult, 'model' | 'language'> = { model: 'small' },
): TranscriptDetectionResult {
  return unavailableTranscript(options.model, options.language, error);
}

export function parseHyperframesTranscriptJson(output: string): TranscriptWord[] {
  const jsonText = extractJson(output);
  if (!jsonText) {
    throw new Error('No transcript JSON emitted by HyperFrames transcribe.');
  }
  const data = JSON.parse(jsonText) as unknown;
  return normalizeTranscriptWords(data);
}

async function readHyperframesTranscriptWords(output: string): Promise<TranscriptWord[]> {
  const jsonText = extractJson(output);
  if (!jsonText) {
    throw new Error('No transcript JSON emitted by HyperFrames transcribe.');
  }
  const data = JSON.parse(jsonText) as unknown;
  const directWords = normalizeTranscriptWords(data);
  if (directWords.length > 0) {
    return directWords;
  }
  if (isRecord(data) && typeof data.transcriptPath === 'string' && data.transcriptPath.length > 0) {
    return parseHyperframesTranscriptJson(await readFile(data.transcriptPath, 'utf8'));
  }
  return [];
}

function normalizeTranscriptWords(data: unknown): TranscriptWord[] {
  const rawWords = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.words)
      ? data.words
      : [];

  return rawWords
    .map((word, index) => normalizeWord(word, index))
    .filter((word): word is TranscriptWord => Boolean(word));
}

async function runHyperframesTranscribe(
  _inputPath: string,
  args: string[],
): Promise<HyperframesTranscribeRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

function normalizeWord(value: unknown, index: number): TranscriptWord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  const start = numberField(value, 'start', 'start_s');
  const end = numberField(value, 'end', 'end_s');
  if (text.length === 0 || start === undefined || end === undefined) {
    return undefined;
  }
  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : `w${index}`,
    text,
    start: roundSec(start),
    end: roundSec(end),
  };
}

function extractJson(output: string): string | undefined {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const firstArray = trimmed.indexOf('[');
  const firstObject = trimmed.indexOf('{');
  const first =
    firstArray === -1
      ? firstObject
      : firstObject === -1
        ? firstArray
        : Math.min(firstArray, firstObject);
  if (first === -1) {
    return undefined;
  }
  return trimmed.slice(first);
}

function numberField(record: Record<string, unknown>, primary: string, fallback: string): number | undefined {
  const value = record[primary] ?? record[fallback];
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function unavailableTranscript(
  model: string,
  language: string | undefined,
  error: string,
): TranscriptDetectionResult {
  return {
    available: false,
    provider: 'hyperframes-transcribe',
    model,
    ...(language ? { language } : {}),
    words: [],
    text: '',
    error,
  };
}

function transcriptErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
    return 'npx or hyperframes is not installed or not on PATH. Install HyperFrames to enable ASR transcript extraction.';
  }
  return message;
}

function roundSec(value: number): number {
  return Number(value.toFixed(3));
}
