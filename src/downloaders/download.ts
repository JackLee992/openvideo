import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { probeVideo } from '../analysis/probe.js';
import { createRunId } from '../project/paths.js';
import { detectLikelyPreview, readDownloadDiagnostics, videoSummary, writeDownloadDiagnostics } from './diagnostics.js';
import { downloadWithFallback, type DownloadAttempt, type DownloadProviderName } from './fallback.js';
import { createDownloadProviders, type DownloaderAuthOptions, type DownloadStrategy } from './providers.js';

export interface DownloadInput extends DownloaderAuthOptions {
  url: string;
  outDir?: string;
  downloader?: DownloadStrategy;
  minDurationSec?: number;
  now?: Date;
}

export interface DownloadResult {
  downloadId: string;
  outputDir: string;
  provider: DownloadProviderName;
  path: string;
  attempts: DownloadAttempt[];
  diagnosticsPath: string;
}

export async function downloadVideo(input: DownloadInput): Promise<DownloadResult> {
  const downloadId = createRunId(input.url, input.now);
  const outputDir = path.join(input.outDir ?? 'downloads', downloadId);
  await mkdir(outputDir, { recursive: true });
  const providers = createDownloadProviders(input.downloader ?? 'auto', {
    cookiesFile: input.cookiesFile,
    cookiesFromBrowser: input.cookiesFromBrowser,
    browserStoragePath: input.browserStoragePath,
  });
  const result = await downloadWithFallback(input.url, outputDir, providers);
  const metadata = await probeVideo(result.path);
  const previewCheck = detectLikelyPreview({
    actualDurationSec: metadata.durationSec,
    minDurationSec: input.minDurationSec,
  });
  const priorDiagnostics = await readDownloadDiagnostics(outputDir);
  const diagnosticsPath = await writeDownloadDiagnostics(outputDir, {
    url: input.url,
    createdAt: new Date().toISOString(),
    provider: result.provider,
    outputPath: result.path,
    attempts: result.attempts,
    video: videoSummary(metadata),
    ...(priorDiagnostics?.browser ? { browser: priorDiagnostics.browser } : {}),
    previewCheck,
  });
  if (previewCheck.likelyPreview) {
    throw new Error(
      `Downloaded media looks like a preview: ${previewCheck.reason}. Diagnostics: ${diagnosticsPath}`,
    );
  }
  return {
    downloadId,
    outputDir,
    provider: result.provider,
    path: result.path,
    attempts: result.attempts,
    diagnosticsPath,
  };
}
