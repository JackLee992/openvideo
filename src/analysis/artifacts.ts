import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RunLayout } from '../project/paths.js';
import type { NormalizedSource } from '../sources/source.js';
import type { AudioDetectionResult } from './audio.js';
import type { CaptionDetectionResult } from './captions.js';
import type { ExtractedFrame } from './frames.js';
import { buildSceneMotionProfiles, type VisualMotionDetectionResult } from './motion.js';
import { buildAnalysisPlaybook, renderPlaybookMarkdown } from './playbook.js';
import type { VideoMetadata } from './probe.js';
import type { SceneDetectionResult } from './scenes.js';
import { buildStoryboardAnalysis, type StoryboardAnalysis } from './storyboard.js';
import type { TranscriptDetectionResult } from './transcript.js';

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
  motionDetection?: VisualMotionDetectionResult;
  audioDetection?: AudioDetectionResult;
  captionDetection?: CaptionDetectionResult;
  transcriptDetection?: TranscriptDetectionResult;
}

export interface AnalysisArtifactResult {
  metadataPath: string;
  shotBreakdownPath: string;
  editRhythmPath: string;
  storyboardPath: string;
  transitionAnalysisPath: string;
  motionAnalysisPath: string;
  playbookPath: string;
  playbookNotesPath: string;
  captionsPath: string;
  transcriptPath: string;
  scriptNotesPath: string;
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
    captionObservationCount: input.captionDetection?.observations.length ?? 0,
    transcriptWordCount: input.transcriptDetection?.words.length ?? 0,
    visualMotion: {
      provider: input.motionDetection?.provider ?? 'ffmpeg-raw-gray',
      available: input.motionDetection?.available ?? false,
      cameraMovement: input.motionDetection?.cameraMovement ?? 'unknown',
      motionIntensity: input.motionDetection?.motionIntensity ?? 'low',
      dominantDirection: input.motionDetection?.dominantDirection ?? 'none',
      ...(input.motionDetection?.error ? { error: input.motionDetection.error } : {}),
    },
    captionOcr: {
      provider: input.captionDetection?.provider ?? 'tesseract',
      available: input.captionDetection?.available ?? false,
      language: input.captionDetection?.language ?? 'unknown',
      ...(input.captionDetection?.error ? { error: input.captionDetection.error } : {}),
    },
    transcript: {
      provider: input.transcriptDetection?.provider ?? 'hyperframes-transcribe',
      available: input.transcriptDetection?.available ?? false,
      model: input.transcriptDetection?.model ?? 'small',
      ...(input.transcriptDetection?.language ? { language: input.transcriptDetection.language } : {}),
      ...(input.transcriptDetection?.error ? { error: input.transcriptDetection.error } : {}),
    },
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
  const sceneMotionProfiles = buildSceneMotionProfiles(scenes, input.motionDetection);
  const analysisPlaybook = buildAnalysisPlaybook(input.category, { runId: input.layout.runId });
  const storyboardAnalysis = buildStoryboardAnalysis({
    runId: input.layout.runId,
    category: input.category,
    durationSec: input.metadata.durationSec,
    scenes,
    cuts,
    frames: input.frames,
    audioDetection: input.audioDetection,
    captionDetection: input.captionDetection,
    transcriptDetection: input.transcriptDetection,
  });
  const shotBreakdown = {
    runId: input.layout.runId,
    category: input.category,
    assumptions: input.sceneDetection
      ? [`Scene cuts detected by ffmpeg scene threshold ${input.sceneDetection.threshold}.`]
      : ['No scene cuts detected; using single-scene baseline.'],
    shots: scenes.map((scene) => ({
      ...scene,
      editorialRole: storyboardAnalysis.beats.find((beat) => beat.sceneIndex === scene.index)?.role ?? 'single-scene',
      pacing: storyboardAnalysis.beats.find((beat) => beat.sceneIndex === scene.index)?.pacing ?? 'held',
      shotScale: input.category === 'product-demo' ? 'screen capture / product frame' : 'unknown',
      cameraMovement:
        sceneMotionProfiles.find((profile) => profile.sceneIndex === scene.index)?.cameraMovement ?? 'unknown',
      motionIntensity:
        sceneMotionProfiles.find((profile) => profile.sceneIndex === scene.index)?.motionIntensity ?? 'low',
      dominantMotionDirection:
        sceneMotionProfiles.find((profile) => profile.sceneIndex === scene.index)?.dominantDirection ?? 'none',
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
  const storyboardPath = path.join(input.layout.analysisDir, 'storyboard.json');
  const transitionAnalysisPath = path.join(input.layout.analysisDir, 'transition-analysis.json');
  const motionAnalysisPath = path.join(input.layout.analysisDir, 'motion-analysis.json');
  const playbookPath = path.join(input.layout.analysisDir, 'playbook.json');
  const captionsPath = path.join(input.layout.analysisDir, 'captions.json');
  const transcriptPath = path.join(input.layout.analysisDir, 'transcript.json');
  const directorNotesPath = path.join(input.layout.analysisDir, 'director-notes.md');
  const editorNotesPath = path.join(input.layout.analysisDir, 'editor-notes.md');
  const playbookNotesPath = path.join(input.layout.analysisDir, 'playbook.md');
  const captionStylePath = path.join(input.layout.analysisDir, 'caption-style.md');
  const motionLanguagePath = path.join(input.layout.analysisDir, 'motion-language.md');
  const soundNotesPath = path.join(input.layout.analysisDir, 'sound-notes.md');
  const scriptNotesPath = path.join(input.layout.analysisDir, 'script-notes.md');
  const videoStylePath = path.join(input.layout.runDir, 'VIDEO_STYLE.md');
  const hyperframesBriefPath = path.join(input.layout.runDir, 'hyperframes-brief.md');

  await writeJson(metadataPath, metadataDoc);
  await writeJson(shotBreakdownPath, shotBreakdown);
  await writeJson(editRhythmPath, editRhythm);
  await writeJson(storyboardPath, storyboardAnalysis);
  await writeJson(transitionAnalysisPath, transitionAnalysisDoc(storyboardAnalysis));
  await writeJson(motionAnalysisPath, motionAnalysisDoc(input, sceneMotionProfiles));
  await writeJson(playbookPath, analysisPlaybook);
  await writeJson(captionsPath, captionsDoc(input));
  await writeJson(transcriptPath, transcriptDoc(input));
  await writeFile(directorNotesPath, directorNotes(input, aspectRatio));
  await writeFile(editorNotesPath, editorNotes(storyboardAnalysis));
  await writeFile(playbookNotesPath, renderPlaybookMarkdown(analysisPlaybook));
  await writeFile(captionStylePath, captionStyle(input));
  await writeFile(motionLanguagePath, motionLanguage(input));
  await writeFile(soundNotesPath, soundNotes(input));
  await writeFile(scriptNotesPath, scriptNotes(input));
  await writeFile(videoStylePath, videoStyle(input, aspectRatio));
  await writeFile(hyperframesBriefPath, hyperframesBrief(input, aspectRatio));

  return {
    metadataPath,
    shotBreakdownPath,
    editRhythmPath,
    storyboardPath,
    transitionAnalysisPath,
    motionAnalysisPath,
    playbookPath,
    playbookNotesPath,
    captionsPath,
    transcriptPath,
    scriptNotesPath,
    videoStylePath,
    hyperframesBriefPath,
  };
}

function captionsDoc(input: AnalysisArtifactInput): object {
  return {
    runId: input.layout.runId,
    provider: input.captionDetection?.provider ?? 'tesseract',
    available: input.captionDetection?.available ?? false,
    language: input.captionDetection?.language ?? 'unknown',
    observations: input.captionDetection?.observations ?? [],
    ...(input.captionDetection?.error ? { error: input.captionDetection.error } : {}),
  };
}

function transcriptDoc(input: AnalysisArtifactInput): object {
  return {
    runId: input.layout.runId,
    provider: input.transcriptDetection?.provider ?? 'hyperframes-transcribe',
    available: input.transcriptDetection?.available ?? false,
    model: input.transcriptDetection?.model ?? 'small',
    ...(input.transcriptDetection?.language ? { language: input.transcriptDetection.language } : {}),
    words: input.transcriptDetection?.words ?? [],
    text: input.transcriptDetection?.text ?? '',
    ...(input.transcriptDetection?.error ? { error: input.transcriptDetection.error } : {}),
  };
}

function transitionAnalysisDoc(analysis: StoryboardAnalysis): object {
  return {
    runId: analysis.runId,
    category: analysis.category,
    sceneCount: analysis.sceneCount,
    progressionCurve: analysis.progressionCurve,
    transitions: analysis.transitions,
    editorChecklist: analysis.editorChecklist,
  };
}

function motionAnalysisDoc(
  input: AnalysisArtifactInput,
  sceneMotionProfiles: ReturnType<typeof buildSceneMotionProfiles>,
): object {
  return {
    runId: input.layout.runId,
    provider: input.motionDetection?.provider ?? 'ffmpeg-raw-gray',
    available: input.motionDetection?.available ?? false,
    frameCount: input.motionDetection?.frameCount ?? 0,
    averageFrameDiff: input.motionDetection?.averageFrameDiff ?? 0,
    centroidShift: input.motionDetection?.centroidShift ?? { x: 0, y: 0 },
    motionIntensity: input.motionDetection?.motionIntensity ?? 'low',
    cameraMovement: input.motionDetection?.cameraMovement ?? 'unknown',
    dominantDirection: input.motionDetection?.dominantDirection ?? 'none',
    samples: input.motionDetection?.samples ?? [],
    sceneProfiles: sceneMotionProfiles,
    ...(input.motionDetection?.error ? { error: input.motionDetection.error } : {}),
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

function editorNotes(analysis: StoryboardAnalysis): string {
  const beatLines = analysis.beats
    .map(
      (beat) =>
        `- Scene ${beat.sceneIndex}, ${beat.startSec.toFixed(2)}-${beat.endSec.toFixed(2)}s: ${beat.role}, ${beat.pacing}; captions: ${beat.evidence.captions.join(' / ') || 'none'}; transcript: ${beat.evidence.transcript || 'none'}`,
    )
    .join('\n');
  const transitionLines =
    analysis.transitions.length > 0
      ? analysis.transitions
          .map(
            (transition) =>
              `- ${transition.timestampSec.toFixed(2)}s: ${transition.type} from scene ${transition.fromSceneIndex} to ${transition.toSceneIndex}; transcript: ${transition.nearbyTranscript || 'none'}; caption: ${transition.nearbyCaption || 'none'}`,
          )
          .join('\n')
      : '- No scene transitions detected.';

  return `# Editor Notes

- Scene count: ${analysis.sceneCount}
- Progression curve: ${analysis.progressionCurve}
- Hook window: ${analysis.hookWindowSec.toFixed(2)}s

## Storyboard Beats

${beatLines}

## Transitions

${transitionLines}

## Review Checklist

${analysis.editorChecklist.map((item) => `- ${item}`).join('\n')}
`;
}

function captionStyle(input: AnalysisArtifactInput): string {
  const detection = input.captionDetection;
  const observations = detection?.observations ?? [];
  const status = detection?.available ? (observations.length > 0 ? 'observed' : 'none detected') : 'OCR unavailable';
  const observedLines =
    observations.length > 0
      ? observations
          .map(
            (observation) =>
              `- ${observation.frameName}: "${observation.text}" (${observation.confidence.toFixed(1)} confidence)`,
          )
          .join('\n')
      : '- No readable sampled-frame captions were detected.';
  const unavailableLine =
    detection && !detection.available && detection.error
      ? `\n- OCR note: ${detection.error}\n`
      : '';
  return `# Caption Style

- Caption presence: ${status}.
- OCR provider: ${detection?.provider ?? 'tesseract'} (${detection?.language ?? 'unknown'}).
- Use recognized wording as source evidence only; do not copy exact source wording into generated scripts.${unavailableLine}
## Observed OCR Text

${observedLines}

## Style Review Checklist

- Inspect sampled frames for position, line count, stroke, shadow, highlight words, and safe-area usage.
`;
}

function motionLanguage(input: AnalysisArtifactInput): string {
  const motion = input.motionDetection;
  const cameraMovement = motion?.cameraMovement ?? 'unknown';
  const intensity = motion?.motionIntensity ?? 'low';
  const direction = motion?.dominantDirection ?? 'none';
  return `# Motion Language

- Category: ${input.category}
- Detected camera movement: ${cameraMovement}.
- Motion intensity: ${intensity}.
- Dominant direction: ${direction}.
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

function scriptNotes(input: AnalysisArtifactInput): string {
  const transcript = input.transcriptDetection;
  const status = transcript?.available
    ? transcript.words.length > 0
      ? 'observed'
      : 'no words detected'
    : 'ASR unavailable';
  const preview = transcript?.text ? transcript.text.slice(0, 600) : 'No transcript text available.';
  const unavailableLine =
    transcript && !transcript.available && transcript.error
      ? `\n- ASR note: ${transcript.error}\n`
      : '';

  return `# Script Notes

- Transcript status: ${status}.
- ASR provider: ${transcript?.provider ?? 'hyperframes-transcribe'} (${transcript?.model ?? 'small'}).
- Word count: ${transcript?.words.length ?? 0}.
- Use transcript wording as source evidence only; do not copy exact source script into generated videos.${unavailableLine}
## Transcript Preview

${preview}

## Script Review Checklist

- Identify the first spoken hook, proof beats, objection handling, payoff line, and CTA.
- Compare spoken emphasis with scene cuts, caption emphasis, and sound-start cues.
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
- Transcript words observed: ${input.transcriptDetection?.words.length ?? 0}.

## Director Notes

- Start from the sampled frames in \`frames/\`.
- Describe shot scale, camera movement, subject blocking, and emotional progression before writing a new script.

## Editing Rhythm

- Review \`analysis/storyboard.json\` for hook/proof/payoff progression.
- Review \`analysis/transition-analysis.json\` before mimicking cut timing or transition types.

## Caption System

- OCR caption frames observed: ${input.captionDetection?.observations.length ?? 0}.
- Preserve the idea of caption-led retention, not the original wording.

## Motion Grammar

- Detected camera movement: ${input.motionDetection?.cameraMovement ?? 'unknown'}.
- Motion intensity: ${input.motionDetection?.motionIntensity ?? 'low'}.
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
