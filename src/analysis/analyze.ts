import { mkdir } from 'node:fs/promises';
import type { RunLayout } from '../project/paths.js';
import { createRunId, createRunLayout } from '../project/paths.js';
import { normalizeSource, type UrlDownloader } from '../sources/source.js';
import { createDownloadProviders, downloadWithFallback, type DownloadStrategy } from '../downloaders/providers.js';
import { writeAnalysisArtifacts, type AnalysisArtifactResult, type VideoCategory } from './artifacts.js';
import { extractFrames, type ExtractedFrame } from './frames.js';
import { probeVideo, type VideoMetadata } from './probe.js';
import { detectScenes, type SceneDetectionResult } from './scenes.js';

export interface AnalyzeInput {
  input: string;
  outDir?: string;
  category?: VideoCategory;
  downloader?: DownloadStrategy;
  full?: boolean;
  now?: Date;
}

export interface AnalyzeDeps {
  probe?: (inputPath: string) => Promise<VideoMetadata>;
  extractFrames?: (inputPath: string, framesDir: string) => Promise<ExtractedFrame[]>;
  detectScenes?: (inputPath: string, durationSec: number) => Promise<SceneDetectionResult>;
  urlDownloader?: UrlDownloader;
}

export interface AnalyzeResult {
  runId: string;
  layout: RunLayout;
  artifacts: AnalysisArtifactResult;
}

export async function analyzeVideo(input: AnalyzeInput, deps: AnalyzeDeps = {}): Promise<AnalyzeResult> {
  const category = input.category ?? 'auto';
  const runId = createRunId(input.input, input.now);
  const layout = createRunLayout(input.outDir ?? 'runs', runId);
  const source = await normalizeSource(input.input, layout, {
    urlDownloader: deps.urlDownloader ?? createUrlDownloader(input.downloader ?? 'auto'),
  });
  const probe = deps.probe ?? probeVideo;
  const frameExtractor = deps.extractFrames ?? ((sourcePath, framesDir) => extractFrames(sourcePath, framesDir));
  const sceneDetector = deps.detectScenes ?? ((sourcePath, durationSec) => detectScenes(sourcePath, durationSec));
  const metadata = await probe(source.localPath);
  await mkdir(layout.framesDir, { recursive: true });
  const frames = await frameExtractor(source.localPath, layout.framesDir);
  const sceneDetection = await sceneDetector(source.localPath, metadata.durationSec);
  const artifacts = await writeAnalysisArtifacts({
    layout,
    source,
    category,
    metadata,
    frames,
    sceneDetection,
  });
  return { runId, layout, artifacts };
}

function createUrlDownloader(strategy: DownloadStrategy): UrlDownloader {
  return async (url, outputDir) => {
    const result = await downloadWithFallback(url, outputDir, createDownloadProviders(strategy));
    return result.path;
  };
}
