import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RunLayout } from '../project/paths.js';
import type { NormalizedSource } from '../sources/source.js';
import type { AudioDetectionResult } from './audio.js';
import type { ExtractedFrame } from './frames.js';
import type { VideoMetadata } from './probe.js';
import type { SceneDetectionResult } from './scenes.js';

export type VideoCategory =
  | 'auto'
  | 'product-demo'
  | 'talking-head'
  | 'knowledge'
  | 'commerce'
  | 'lifestyle'
  | 'story'
  | 'cinematic-ad'
  | 'motion-graphic';

export interface AnalysisArtifactInput {
  layout: RunLayout;
  source: NormalizedSource;
  category: VideoCategory;
  metadata: VideoMetadata;
  frames: ExtractedFrame[];
  sceneDetection?: SceneDetectionResult;
  audioDetection?: AudioDetectionResult;
}

export interface AnalysisArtifactResult {
  metadataPath: string;
  shotBreakdownPath: string;
  editRhythmPath: string;
  videoStylePath: string;
  hyperframesBriefPath: string;
}

export async function writeAnalysisArtifacts(input: AnalysisArtifactInput): Promise<AnalysisArtifactResult> {
  await mkdir(input.layout.analysisDir, { recursive: true });
  await mkdir(input.layout.runDir, { recursive: true });

  const aspectRatio = aspectRatioFor(input.metadata.width, input.metadata.height);
  const metadataDoc = {
    runId: input.layout.runId,
    category: input.category,
    source: {
      kind: input.source.kind,
      originalInput: input.source.originalInput,
      fileName: input.source.fileName,
    },
    video: {
      durationSec: input.metadata.durationSec,
      width: input.metadata.width,
      height: input.metadata.height,
      aspectRatio,
      frameRate: input.metadata.frameRate,
      videoCodec: input.metadata.videoCodec,
      audioCodec: input.metadata.audioCodec,
      hasAudio: input.metadata.hasAudio,
    },
    frameSample: input.frames.map((frame) => frame.fileName),
    audioCueCount: input.audioDetection?.cues.length ?? 0,
    raw: input.metadata.raw,
  };

  const scenes = input.sceneDetection?.scenes ?? [
    {
      index: 1,
      startSec: 0,
      endSec: Number(input.metadata.durationSec.toFixed(3)),
      durationSec: Number(input.metadata.durationSec.toFixed(3)),
    },
  ];
  const cuts = input.sceneDetection?.cuts ?? [];
  const shotBreakdown = {
    runId: input.layout.runId,
    category: input.category,
    assumptions: input.sceneDetection
      ? [`Scene cuts detected by ffmpeg scene threshold ${input.sceneDetection.threshold}.`]
      : ['No scene cuts detected; using single-scene baseline.'],
    shots: scenes.map((scene) => ({
      ...scene,
      shotScale: input.category === 'product-demo' ? 'screen capture / product frame' : 'unknown',
      cameraMovement: 'unknown',
      cutIn: scene.index === 1 ? 'opening' : 'scene-cut',
      sampledFrames: input.frames.map((frame) => frame.fileName),
    })),
  };

  const editRhythm = {
    runId: input.layout.runId,
    durationSec: input.metadata.durationSec,
    estimatedSceneCount: scenes.length,
    averageSceneDurationSec: Number((input.metadata.durationSec / Math.max(1, scenes.length)).toFixed(3)),
    hookWindowSec: Math.min(3, input.metadata.durationSec),
    pacingCurve: scenes.length > 1 ? pacingCurveFor(scenes.map((scene) => scene.durationSec)) : 'single-scene',
    cuts: cuts.map((cut) => ({
      timestampSec: cut.timestampSec,
      type: 'scene-cut',
      confidence: 'ffmpeg-scene-detect',
    })),
    audioCues: (input.audioDetection?.cues ?? []).map((cue) => ({
      timestampSec: cue.timestampSec,
      type: cue.type,
      confidence: cue.confidence,
    })),
    retentionBeats: ['Opening 1-3 seconds should be reviewed for hook mechanics.'],
  };

  const metadataPath = path.join(input.layout.analysisDir, 'metadata.json');
  const shotBreakdownPath = path.join(input.layout.analysisDir, 'shot-breakdown.json');
  const editRhythmPath = path.join(input.layout.analysisDir, 'edit-rhythm.json');
  const directorNotesPath = path.join(input.layout.analysisDir, 'director-notes.md');
  const captionStylePath = path.join(input.layout.analysisDir, 'caption-style.md');
  const motionLanguagePath = path.join(input.layout.analysisDir, 'motion-language.md');
  const soundNotesPath = path.join(input.layout.analysisDir, 'sound-notes.md');
  const videoStylePath = path.join(input.layout.runDir, 'VIDEO_STYLE.md');
  const hyperframesBriefPath = path.join(input.layout.runDir, 'hyperframes-brief.md');

  await writeJson(metadataPath, metadataDoc);
  await writeJson(shotBreakdownPath, shotBreakdown);
  await writeJson(editRhythmPath, editRhythm);
  await writeFile(directorNotesPath, directorNotes(input, aspectRatio));
  await writeFile(captionStylePath, captionStyle(input));
  await writeFile(motionLanguagePath, motionLanguage(input));
  await writeFile(soundNotesPath, soundNotes(input));
  await writeFile(videoStylePath, videoStyle(input, aspectRatio));
  await writeFile(hyperframesBriefPath, hyperframesBrief(input, aspectRatio));

  return {
    metadataPath,
    shotBreakdownPath,
    editRhythmPath,
    videoStylePath,
    hyperframesBriefPath,
  };
}

function aspectRatioFor(width: number, height: number): string {
  if (!width || !height) return 'unknown';
  const gcd = greatestCommonDivisor(width, height);
  return `${width / gcd}:${height / gcd}`;
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function pacingCurveFor(durations: number[]): string {
  if (durations.length <= 1) return 'single-scene';
  const first = durations[0] ?? 0;
  const last = durations[durations.length - 1] ?? 0;
  if (first > last * 1.5) return 'accelerating';
  if (last > first * 1.5) return 'slow-build';
  return 'pulsed';
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function directorNotes(input: AnalysisArtifactInput, aspectRatio: string): string {
  return `# Director Notes

- Category: ${input.category}
- Aspect ratio: ${aspectRatio}
- Duration: ${input.metadata.durationSec.toFixed(2)}s
- V1 read: review sampled frames for shot scale, camera movement, subject blocking, and emotional progression.
`;
}

function captionStyle(_input: AnalysisArtifactInput): string {
  return `# Caption Style

- Caption presence: unknown in deterministic V1.
- Inspect sampled frames for position, line count, stroke, shadow, highlight words, and safe-area usage.
`;
}

function motionLanguage(input: AnalysisArtifactInput): string {
  return `# Motion Language

- Category: ${input.category}
- Start with Douyin-safe vertical pacing: fast hook, clear holds, snap transitions, and caption-led emphasis.
- Convert observed text entrances and graphic movements into HyperFrames timing rules.
`;
}

function soundNotes(input: AnalysisArtifactInput): string {
  const cues = input.audioDetection?.cues ?? [];
  const cueLines =
    cues.length > 0
      ? cues.map((cue) => `- ${cue.type} at ${cue.timestampSec.toFixed(2)}s (${cue.confidence})`).join('\n')
      : '- No sound-start cues detected in deterministic V1.';
  return `# Sound Notes

- Audio present: ${input.metadata.hasAudio ? 'yes' : 'no'}
- Speech/music split: unknown in deterministic V1.
- Review cut-to-beat relationship in the first 3 seconds and around visible transitions.

## Audio Cues

${cueLines}
`;
}

function videoStyle(input: AnalysisArtifactInput, aspectRatio: string): string {
  return `# VIDEO_STYLE

## Category And Format

- Category: ${input.category}
- Aspect ratio: ${aspectRatio}
- Duration: ${input.metadata.durationSec.toFixed(2)}s

## Hook Formula

- Treat the first ${Math.min(3, input.metadata.durationSec).toFixed(2)} seconds as the hook window.
- Identify the opening promise, visual proof, or pattern interrupt before generating a new video.

## Director Notes

- Start from the sampled frames in \`frames/\`.
- Describe shot scale, camera movement, subject blocking, and emotional progression before writing a new script.

## Editing Rhythm

- Deterministic V1 detected a baseline single-scene structure.
- Add richer cut and beat analysis before mimicking pacing closely.

## Caption System

- Preserve the idea of caption-led retention, not the original wording.

## Motion Grammar

- Prefer vertical-safe kinetic type, snap transitions, mask reveals, and short hold times.

## Sound Guidance

- Audio present: ${input.metadata.hasAudio ? 'yes' : 'no'}.
- Align future cuts to obvious beat or emphasis points.

## Things Not To Copy

- Do not copy exact source wording.
- Do not reuse source creator identity, logo, watermark, face, or distinctive frames.
- Do not reproduce the video frame-for-frame.
- Use this as abstract style guidance for original work.
`;
}

function hyperframesBrief(input: AnalysisArtifactInput, aspectRatio: string): string {
  return `# HyperFrames Brief

## Target

- Format: ${aspectRatio}
- Source category: ${input.category}
- Suggested duration: ${Math.min(Math.max(input.metadata.durationSec, 8), 30).toFixed(0)}s

## Scene Plan

1. Hook scene, 0-3s: introduce the claim or pattern interrupt with large vertical-safe captions.
2. Proof scene: show the product, workflow, or key evidence with a clear center-weighted layout.
3. Payoff scene: land the result, CTA, or loop-back line.

## Motion Notes

- Use mask reveals or snap-in kinetic type for key phrases.
- Keep transitions quick and readable for Douyin-style vertical viewing.
- Do not copy source frames; generate original layouts and copy.
`;
}
