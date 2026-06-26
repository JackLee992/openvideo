import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { VideoMetadata } from '../analysis/probe.js';
import type { DownloadAttempt, DownloadProviderName } from './fallback.js';

export interface DownloadPreviewCheck {
  minDurationSec?: number;
  pageDurationSec?: number | null;
  actualDurationSec: number;
}

export interface DownloadPreviewResult {
  minDurationSec?: number;
  pageDurationSec?: number | null;
  actualDurationSec: number;
  likelyPreview: boolean;
  reason?: string;
}

export interface DownloadDiagnostics {
  url: string;
  createdAt: string;
  provider?: DownloadProviderName;
  outputPath?: string;
  attempts: DownloadAttempt[];
  video?: {
    durationSec: number;
    width: number;
    height: number;
    frameRate: number;
    videoCodec: string | null;
    audioCodec: string | null;
    hasAudio: boolean;
  };
  browser?: {
    playbackMode: 'direct-video' | 'blob-mse';
    pageVideo?: {
      durationSec?: number | null;
      width?: number;
      height?: number;
    };
    mediaResourceTypes?: string[];
  };
  previewCheck?: DownloadPreviewResult;
  error?: string;
}

export function detectLikelyPreview(check: DownloadPreviewCheck): DownloadPreviewResult {
  const reasons: string[] = [];
  if (typeof check.minDurationSec === 'number' && check.actualDurationSec < check.minDurationSec) {
    reasons.push(`downloaded duration is below required minimum ${check.minDurationSec}s`);
  }
  if (
    typeof check.pageDurationSec === 'number' &&
    Number.isFinite(check.pageDurationSec) &&
    check.pageDurationSec > 0 &&
    check.actualDurationSec < check.pageDurationSec * 0.8
  ) {
    reasons.push(`downloaded duration is much shorter than page video duration ${check.pageDurationSec.toFixed(2)}s`);
  }

  return {
    ...(typeof check.minDurationSec === 'number' ? { minDurationSec: check.minDurationSec } : {}),
    ...(typeof check.pageDurationSec === 'number' ? { pageDurationSec: check.pageDurationSec } : {}),
    actualDurationSec: check.actualDurationSec,
    likelyPreview: reasons.length > 0,
    ...(reasons.length > 0 ? { reason: reasons.join('; ') } : {}),
  };
}

export function videoSummary(metadata: VideoMetadata): NonNullable<DownloadDiagnostics['video']> {
  return {
    durationSec: metadata.durationSec,
    width: metadata.width,
    height: metadata.height,
    frameRate: metadata.frameRate,
    videoCodec: metadata.videoCodec,
    audioCodec: metadata.audioCodec,
    hasAudio: metadata.hasAudio,
  };
}

export async function writeDownloadDiagnostics(outputDir: string, diagnostics: DownloadDiagnostics): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const diagnosticsPath = path.join(outputDir, 'download-diagnostics.json');
  await writeFile(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
  return diagnosticsPath;
}

export async function readDownloadDiagnostics(outputDir: string): Promise<DownloadDiagnostics | null> {
  try {
    return JSON.parse(await readFile(path.join(outputDir, 'download-diagnostics.json'), 'utf8')) as DownloadDiagnostics;
  } catch {
    return null;
  }
}
