import { spawn } from 'node:child_process';

export type SilenceEvent =
  | { type: 'silence-start'; timestampSec: number }
  | { type: 'silence-end'; timestampSec: number; durationSec: number };

export interface AudioCue {
  type: 'sound-start';
  timestampSec: number;
  confidence: 'ffmpeg-silencedetect';
}

export interface AudioDetectionOptions {
  noiseDb?: number;
  minSilenceDurationSec?: number;
}

export interface AudioDetectionResult {
  silenceEvents: SilenceEvent[];
  cues: AudioCue[];
  raw: string;
}

export async function detectAudioCues(
  inputPath: string,
  options: AudioDetectionOptions = {},
): Promise<AudioDetectionResult> {
  const raw = await runSilenceDetect(inputPath, options);
  const silenceEvents = parseSilenceDetectEvents(raw);
  return {
    silenceEvents,
    cues: buildAudioCuesFromSilence(silenceEvents),
    raw,
  };
}

export function parseSilenceDetectEvents(output: string): SilenceEvent[] {
  const events: SilenceEvent[] = [];
  for (const line of output.split(/\r?\n/)) {
    const start = line.match(/silence_start:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (start) {
      events.push({ type: 'silence-start', timestampSec: roundSec(Number(start[1])) });
      continue;
    }

    const end = line.match(/silence_end:\s*([0-9]+(?:\.[0-9]+)?)\s*\|\s*silence_duration:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (end) {
      events.push({
        type: 'silence-end',
        timestampSec: roundSec(Number(end[1])),
        durationSec: roundSec(Number(end[2])),
      });
    }
  }
  return events;
}

export function buildAudioCuesFromSilence(events: SilenceEvent[]): AudioCue[] {
  return events
    .filter((event): event is Extract<SilenceEvent, { type: 'silence-end' }> => event.type === 'silence-end')
    .map((event) => ({
      type: 'sound-start',
      timestampSec: event.timestampSec,
      confidence: 'ffmpeg-silencedetect',
    }));
}

async function runSilenceDetect(inputPath: string, options: AudioDetectionOptions): Promise<string> {
  const noiseDb = options.noiseDb ?? -35;
  const minSilenceDurationSec = options.minSilenceDurationSec ?? 0.15;
  const args = [
    '-hide_banner',
    '-i',
    inputPath,
    '-af',
    `silencedetect=noise=${noiseDb}dB:d=${minSilenceDurationSec}`,
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
      reject(new Error(`ffmpeg audio cue detection failed with code ${code}: ${stderr.trim()}`));
    });
  });
}

function roundSec(value: number): number {
  return Number(value.toFixed(3));
}
