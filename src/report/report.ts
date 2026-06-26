import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ReportInput {
  runDir: string;
  outPath?: string;
}

export interface ReportResult {
  reportPath: string;
  transcriptReadablePath: string;
}

interface MetadataDoc {
  runId?: string;
  category?: string;
  source?: {
    kind?: string;
    originalInput?: string;
    fileName?: string;
  };
  video?: {
    durationSec?: number;
    width?: number;
    height?: number;
    aspectRatio?: string;
    frameRate?: number;
    videoCodec?: string | null;
    audioCodec?: string | null;
    hasAudio?: boolean;
  };
  audioCueCount?: number;
  captionObservationCount?: number;
  transcriptWordCount?: number;
  visualMotion?: {
    available?: boolean;
    cameraMovement?: string;
    motionIntensity?: string;
    dominantDirection?: string;
  };
  captionOcr?: {
    available?: boolean;
    language?: string;
    error?: string;
  };
  transcript?: {
    available?: boolean;
    model?: string;
    language?: string;
    error?: string;
  };
}

interface EditRhythmDoc {
  estimatedSceneCount?: number;
  averageSceneDurationSec?: number;
  hookWindowSec?: number;
  pacingCurve?: string;
  cuts?: Array<{ timestampSec?: number }>;
  audioCues?: Array<{ timestampSec?: number; type?: string }>;
}

interface StoryboardDoc {
  sceneCount?: number;
  progressionCurve?: string;
  beats?: Array<{
    sceneIndex?: number;
    startSec?: number;
    endSec?: number;
    role?: string;
    pacing?: string;
    evidence?: {
      captions?: string[];
      transcript?: string;
    };
  }>;
}

interface CaptionsDoc {
  available?: boolean;
  language?: string;
  observations?: Array<{
    frameName?: string;
    text?: string;
    confidence?: number;
  }>;
  error?: string;
}

interface TranscriptDoc {
  available?: boolean;
  provider?: string;
  model?: string;
  language?: string;
  words?: Array<{ text?: string; start?: number; end?: number }>;
  text?: string;
  error?: string;
}

export async function generateReport(input: ReportInput): Promise<ReportResult> {
  const runDir = path.resolve(input.runDir);
  const analysisDir = path.join(runDir, 'analysis');
  const [metadata, editRhythm, storyboard, captions, transcript] = await Promise.all([
    readJson<MetadataDoc>(path.join(analysisDir, 'metadata.json')),
    readJson<EditRhythmDoc>(path.join(analysisDir, 'edit-rhythm.json')),
    readJson<StoryboardDoc>(path.join(analysisDir, 'storyboard.json')),
    readJson<CaptionsDoc>(path.join(analysisDir, 'captions.json')),
    readJson<TranscriptDoc>(path.join(analysisDir, 'transcript.json')),
  ]);

  const transcriptSegments = segmentTranscript(transcript);
  const reportPath = path.resolve(input.outPath ?? path.join(analysisDir, 'report.md'));
  const transcriptReadablePath = path.join(analysisDir, 'transcript-readable.md');
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(transcriptReadablePath), { recursive: true });
  await writeFile(transcriptReadablePath, transcriptReadableDoc(transcript, transcriptSegments), 'utf8');
  await writeFile(reportPath, reportDoc(metadata, editRhythm, storyboard, captions, transcript, transcriptSegments), 'utf8');
  return { reportPath, transcriptReadablePath };
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

function segmentTranscript(transcript: TranscriptDoc): string[] {
  const text = normalizeSpace(transcript.text ?? transcript.words?.map((word) => word.text).join(' ') ?? '');
  if (!text) return [];
  const punctuationSegments = text
    .split(/(?<=[。！？!?；;])\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);
  if (punctuationSegments.length > 1) return punctuationSegments.flatMap((segment) => splitLongText(segment, 120));
  return splitLongText(text, 90);
}

function splitLongText(text: string, maxChars: number): string[] {
  const segments: string[] = [];
  for (let index = 0; index < text.length; index += maxChars) {
    segments.push(text.slice(index, index + maxChars).trim());
  }
  return segments.filter(Boolean);
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function transcriptReadableDoc(transcript: TranscriptDoc, segments: string[]): string {
  const segmentLines =
    segments.length > 0
      ? segments.map((segment, index) => `${index + 1}. ${segment}`).join('\n')
      : 'No transcript text is available.';
  return `# Transcript Readable

- Provider: ${transcript.provider ?? 'unknown'}
- Model: ${transcript.model ?? 'unknown'}
- Language: ${transcript.language ?? 'unknown'}
- Available: ${transcript.available ? 'yes' : 'no'}
- Segment count: ${segments.length}
${transcript.error ? `- Error: ${transcript.error}\n` : ''}
## Segments

${segmentLines}
`;
}

function reportDoc(
  metadata: MetadataDoc,
  editRhythm: EditRhythmDoc,
  storyboard: StoryboardDoc,
  captions: CaptionsDoc,
  transcript: TranscriptDoc,
  transcriptSegments: string[],
): string {
  const video = metadata.video ?? {};
  const firstSegment = transcriptSegments[0] ?? '';
  const format = `${video.aspectRatio ?? 'unknown'} ${video.width ?? 0}x${video.height ?? 0}`;
  const cutCount = editRhythm.cuts?.length ?? 0;
  const audioCueCount = editRhythm.audioCues?.length ?? metadata.audioCueCount ?? 0;
  const captionCount = captions.observations?.length ?? metadata.captionObservationCount ?? 0;
  const sceneCount = storyboard.sceneCount ?? editRhythm.estimatedSceneCount ?? 0;

  return `# OpenVideo Analysis Report

## One-Sentence Read

This ${metadata.category ?? 'auto'} video is a ${durationLabel(video.durationSec)} ${format} source. Its opening hook should be reviewed through the first ${formatSeconds(editRhythm.hookWindowSec ?? 3)}, and its main spoken/topic signal begins with: ${firstSegment ? `"${truncate(firstSegment, 180)}"` : 'no readable transcript text'}.

## Source And Media

- Run ID: ${metadata.runId ?? 'unknown'}
- Source: ${metadata.source?.originalInput ?? 'unknown'}
- Source kind: ${metadata.source?.kind ?? 'unknown'}
- Duration: ${formatSeconds(video.durationSec)}
- Format: ${format}
- Frame rate: ${video.frameRate ?? 0} fps
- Codecs: ${video.videoCodec ?? 'unknown'} video, ${video.audioCodec ?? 'no'} audio
- Audio present: ${video.hasAudio ? 'yes' : 'no'}

## Pipeline Signals

- Scenes detected: ${sceneCount}
- Average scene duration: ${formatSeconds(editRhythm.averageSceneDurationSec)}
- Pacing curve: ${editRhythm.pacingCurve ?? storyboard.progressionCurve ?? 'unknown'}
- Scene cuts: ${cutCount}
- Audio cues: ${audioCueCount}
- Caption OCR observations: ${captionCount}
- Transcript provider: ${metadata.transcript?.model ?? transcript.model ?? 'unknown'} (${metadata.transcript?.language ?? transcript.language ?? 'unknown'})
- Transcript segments: ${transcriptSegments.length}

## Narrative Structure

${narrativeStructure(storyboard, transcriptSegments)}

## Editing And Visual Rhythm

${editingRead(metadata, editRhythm, sceneCount)}

## Caption System

${captionRead(captions)}

## Transcript Read

${transcriptRead(transcript, transcriptSegments)}

## Reusable Creative Pattern

1. Start with the most legible hook from the first 1-3 seconds.
2. Keep the next beat anchored to proof: a frame, number, screen, example, or contradiction.
3. Use scene cuts and caption emphasis to separate claim, proof, and payoff.
4. Preserve the abstract pacing and caption density, not the source creator identity or exact wording.
5. End with a payoff, CTA, or viewer-choice question that fits the new original topic.

## Review Notes

- This report is generated from deterministic OpenVideo artifacts and should be treated as a first-pass analyst draft.
- Verify factual claims before reuse in publication-grade content.
- Chinese OCR and ASR may contain segmentation, punctuation, or homophone errors.
- Do not copy the original script, watermark, face, distinctive frames, or creator identity.
`;
}

function narrativeStructure(storyboard: StoryboardDoc, transcriptSegments: string[]): string {
  const beats = storyboard.beats ?? [];
  if (beats.length === 0) {
    return transcriptSegments.length > 0
      ? transcriptSegments.slice(0, 5).map((segment, index) => `- Beat ${index + 1}: ${truncate(segment, 160)}`).join('\n')
      : '- No storyboard beats or transcript segments are available.';
  }
  return beats
    .slice(0, 8)
    .map((beat, index) => {
      const transcript = beat.evidence?.transcript || transcriptSegments[index] || '';
      return `- Scene ${beat.sceneIndex ?? index + 1}, ${formatSeconds(beat.startSec)}-${formatSeconds(beat.endSec)}: ${beat.role ?? 'beat'} / ${beat.pacing ?? 'held'}${transcript ? `; transcript signal: ${truncate(transcript, 120)}` : ''}`;
    })
    .join('\n');
}

function editingRead(metadata: MetadataDoc, editRhythm: EditRhythmDoc, sceneCount: number): string {
  const motion = metadata.visualMotion;
  const density =
    sceneCount >= 60
      ? 'high-cut-density montage'
      : sceneCount >= 12
        ? 'moderate scene-driven explainer'
        : 'slow hold-led structure';
  return [
    `- Editing mode: ${density}.`,
    `- Camera/motion: ${motion?.cameraMovement ?? 'unknown'}, ${motion?.motionIntensity ?? 'unknown'} intensity, dominant direction ${motion?.dominantDirection ?? 'none'}.`,
    `- Hook window: ${formatSeconds(editRhythm.hookWindowSec ?? 3)}.`,
    '- Review sampled frames before imitating shot scale, layout, or caption placement.',
  ].join('\n');
}

function captionRead(captions: CaptionsDoc): string {
  if (!captions.available) {
    return `- OCR unavailable or unreliable.${captions.error ? ` ${captions.error}` : ''}`;
  }
  const observations = captions.observations ?? [];
  if (observations.length === 0) return '- OCR ran, but sampled frames did not yield readable captions.';
  const examples = observations
    .slice(0, 5)
    .map((item) => `- ${item.frameName ?? 'frame'}: ${truncate(item.text ?? '', 120)} (${Math.round(item.confidence ?? 0)} confidence)`)
    .join('\n');
  return `${examples}\n\nUse OCR as layout and emphasis evidence first; exact wording still needs review.`;
}

function transcriptRead(transcript: TranscriptDoc, segments: string[]): string {
  if (!transcript.available) {
    return `ASR unavailable.${transcript.error ? ` ${transcript.error}` : ''}`;
  }
  if (segments.length === 0) return 'ASR ran, but no readable transcript text was found.';
  return segments
    .slice(0, 6)
    .map((segment, index) => `${index + 1}. ${truncate(segment, 180)}`)
    .join('\n');
}

function durationLabel(durationSec: number | undefined): string {
  if (!durationSec) return 'unknown-duration';
  if (durationSec < 45) return 'short-form';
  if (durationSec < 180) return 'mid-length';
  return 'long-form';
}

function formatSeconds(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}s` : 'unknown';
}

function truncate(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value;
}
