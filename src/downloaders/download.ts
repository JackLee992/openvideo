import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRunId } from '../project/paths.js';
import { downloadWithFallback, type DownloadAttempt, type DownloadProviderName } from './fallback.js';
import { createDownloadProviders, type DownloadStrategy } from './providers.js';

export interface DownloadInput {
  url: string;
  outDir?: string;
  downloader?: DownloadStrategy;
  now?: Date;
}

export interface DownloadResult {
  downloadId: string;
  outputDir: string;
  provider: DownloadProviderName;
  path: string;
  attempts: DownloadAttempt[];
}

export async function downloadVideo(input: DownloadInput): Promise<DownloadResult> {
  const downloadId = createRunId(input.url, input.now);
  const outputDir = path.join(input.outDir ?? 'downloads', downloadId);
  await mkdir(outputDir, { recursive: true });
  const providers = createDownloadProviders(input.downloader ?? 'auto');
  const result = await downloadWithFallback(input.url, outputDir, providers);
  return {
    downloadId,
    outputDir,
    provider: result.provider,
    path: result.path,
    attempts: result.attempts,
  };
}
