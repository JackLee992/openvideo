import { mkdir } from 'node:fs/promises';
import type { RunLayout } from '../project/paths.js';
import { createRunId, createRunLayout } from '../project/paths.js';
import { normalizeSource } from '../sources/source.js';
import { writeAnalysisArtifacts, type AnalysisArtifactResult, type VideoCategory } from './artifacts.js';
import { extractFrames, type ExtractedFrame } from './frames.js';
import { probeVideo, type VideoMetadata } from './probe.js';

export interface AnalyzeInput {
  input: string;
  outDir?: string;
  category?: VideoCategory;
  full?: boolean;
  now?: Date;
}

export interface AnalyzeDeps {
  probe?: (inputPath: string) => Promise<VideoMetadata>;
  extractFrames?: (inputPath: string, framesDir: string) => Promise<ExtractedFrame[]>;
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
  const source = await normalizeSource(input.input, layout);
  const probe = deps.probe ?? probeVideo;
  const frameExtractor = deps.extractFrames ?? ((sourcePath, framesDir) => extractFrames(sourcePath, framesDir));
  const metadata = await probe(source.localPath);
  await mkdir(layout.framesDir, { recursive: true });
  const frames = await frameExtractor(source.localPath, layout.framesDir);
  const artifacts = await writeAnalysisArtifacts({
    layout,
    source,
    category,
    metadata,
    frames,
  });
  return { runId, layout, artifacts };
}
