import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface GenerationBriefInput {
  runDir: string;
  goal: string;
  outputPath?: string;
}

export interface GenerationBriefResult {
  outputPath: string;
}

interface MetadataDoc {
  runId?: string;
  category?: string;
  video?: {
    durationSec?: number;
    aspectRatio?: string;
    width?: number;
    height?: number;
    hasAudio?: boolean;
  };
}

export async function createGenerationBrief(input: GenerationBriefInput): Promise<GenerationBriefResult> {
  const runDir = path.resolve(input.runDir);
  const metadataPath = path.join(runDir, 'analysis', 'metadata.json');
  const videoStylePath = path.join(runDir, 'VIDEO_STYLE.md');
  const hyperframesBriefPath = path.join(runDir, 'hyperframes-brief.md');
  const outputPath = path.resolve(input.outputPath ?? path.join(runDir, 'generation-brief.md'));

  const [metadata, videoStyle, hyperframesBrief] = await Promise.all([
    readRequiredJson<MetadataDoc>(metadataPath),
    readRequiredFile(videoStylePath),
    readRequiredFile(hyperframesBriefPath),
  ]);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderGenerationBrief({ goal: input.goal, runDir, metadata, videoStyle, hyperframesBrief }));
  return { outputPath };
}

async function readRequiredFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    throw missingRunFileError(filePath, error);
  }
}

async function readRequiredJson<T>(filePath: string): Promise<T> {
  const text = await readRequiredFile(filePath);
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Invalid analyzed run JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function missingRunFileError(filePath: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Missing analyzed run file: ${filePath}. Run \`openvideo analyze\` first. ${detail}`);
}

function renderGenerationBrief(input: {
  goal: string;
  runDir: string;
  metadata: MetadataDoc;
  videoStyle: string;
  hyperframesBrief: string;
}): string {
  const video = input.metadata.video ?? {};
  const duration = typeof video.durationSec === 'number' ? `${video.durationSec.toFixed(2)}s` : 'unknown';
  const aspectRatio = video.aspectRatio ?? 'unknown';
  const category = input.metadata.category ?? 'auto';

  return `# OpenVideo Generation Brief

## Goal

${input.goal}

## Source Run

- Run directory: ${input.runDir}
- Run id: ${input.metadata.runId ?? path.basename(input.runDir)}
- Category: ${category}
- Format: ${aspectRatio}
- Source duration: ${duration}
- Audio present: ${video.hasAudio === undefined ? 'unknown' : video.hasAudio ? 'yes' : 'no'}

## Style Contract To Reuse

Use the source as abstract craft guidance only:

${excerptSection(input.videoStyle, 'VIDEO_STYLE')}

## HyperFrames Starting Point

${excerptSection(input.hyperframesBrief, 'HyperFrames Brief')}

## Target Scene Plan

1. Hook, 0-3s: open with a clear promise or pattern interrupt for the new goal.
2. Proof: show the new product, workflow, or idea with original UI, captions, and evidence.
3. Payoff: land a result, CTA, or loop-back line that belongs to the new video.

## Production Constraints

- Keep the output original to the new goal.
- Preserve only reusable rhythm, caption hierarchy, transition grammar, and pacing ideas.
- Do not copy exact source wording, identity, watermark, logos, faces, or distinctive frames.
- Prefer vertical-safe layouts and readable captions for Douyin-style viewing.
`;
}

function excerptSection(text: string, fallbackTitle: string): string {
  const trimmed = text.trim();
  if (!trimmed) return `- ${fallbackTitle}: unavailable.`;
  const lines = trimmed.split(/\r?\n/).slice(0, 80);
  return lines.join('\n');
}
