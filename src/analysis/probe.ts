import { spawn } from 'node:child_process';

export interface VideoMetadata {
  durationSec: number;
  width: number;
  height: number;
  frameRate: number;
  videoCodec: string | null;
  audioCodec: string | null;
  hasAudio: boolean;
  raw: unknown;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
}

interface FfprobeJson {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
  };
}

export async function probeVideo(inputPath: string): Promise<VideoMetadata> {
  const raw = await runFfprobe(inputPath);
  const parsed = JSON.parse(raw) as FfprobeJson;
  const video = parsed.streams?.find((stream) => stream.codec_type === 'video');
  const audio = parsed.streams?.find((stream) => stream.codec_type === 'audio');
  return {
    durationSec: Number(parsed.format?.duration ?? 0),
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
    frameRate: parseFrameRate(video?.avg_frame_rate || video?.r_frame_rate),
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    hasAudio: Boolean(audio),
    raw: parsed,
  };
}

function parseFrameRate(value: string | undefined): number {
  if (!value || value === '0/0') return 0;
  const [num, den] = value.split('/').map(Number);
  if (!den) return Number(value) || 0;
  return Number((num / den).toFixed(3));
}

async function runFfprobe(inputPath: string): Promise<string> {
  const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputPath];
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
      reject(new Error(`ffprobe failed with code ${code}: ${stderr.trim()}`));
    });
  });
}
