import type { AudioDetectionResult, AudioCue } from './audio.js';
import type { CaptionDetectionResult, CaptionObservation } from './captions.js';
import type { ExtractedFrame } from './frames.js';
import type { DetectedScene, SceneCut } from './scenes.js';
import type { TranscriptDetectionResult, TranscriptWord } from './transcript.js';
import type { VideoCategory } from './artifacts.js';

export type StoryboardRole = 'single-scene' | 'hook' | 'setup' | 'proof' | 'build' | 'payoff';
export type StoryboardPacing = 'snap' | 'quick' | 'held' | 'long-hold';
export type TransitionType = 'hard-cut' | 'audio-led-cut' | 'speech-led-cut' | 'caption-led-cut';

export interface StoryboardBeat {
  sceneIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  role: StoryboardRole;
  pacing: StoryboardPacing;
  sampledFrames: string[];
  evidence: {
    captions: string[];
    transcript: string;
    audioCueCount: number;
  };
  directorFocus: string[];
}

export interface TransitionAnalysis {
  timestampSec: number;
  fromSceneIndex: number;
  toSceneIndex: number;
  type: TransitionType;
  confidence: 'ffmpeg-scene-detect';
  nearbyAudioCueSec?: number;
  nearbyTranscript: string;
  nearbyCaption: string;
}

export interface StoryboardAnalysisInput {
  runId: string;
  category: VideoCategory;
  durationSec: number;
  scenes: DetectedScene[];
  cuts: SceneCut[];
  frames: ExtractedFrame[];
  audioDetection?: AudioDetectionResult;
  captionDetection?: CaptionDetectionResult;
  transcriptDetection?: TranscriptDetectionResult;
}

export interface StoryboardAnalysis {
  runId: string;
  category: VideoCategory;
  durationSec: number;
  sceneCount: number;
  hookWindowSec: number;
  progressionCurve: string;
  beats: StoryboardBeat[];
  transitions: TransitionAnalysis[];
  editorChecklist: string[];
}

export function buildStoryboardAnalysis(input: StoryboardAnalysisInput): StoryboardAnalysis {
  const scenes = input.scenes.length > 0 ? input.scenes : [singleScene(input.durationSec)];
  const transcriptWords = input.transcriptDetection?.words ?? [];
  const captions = input.captionDetection?.observations ?? [];
  const audioCues = input.audioDetection?.cues ?? [];
  const beats = scenes.map((scene, index) => {
    const sceneCaptions = captionsForScene(captions, scene, scenes);
    const sceneTranscript = transcriptForRange(transcriptWords, scene.startSec, scene.endSec);
    const sceneAudioCues = audioCues.filter((cue) => cue.timestampSec >= scene.startSec && cue.timestampSec <= scene.endSec);
    return {
      sceneIndex: scene.index,
      startSec: scene.startSec,
      endSec: scene.endSec,
      durationSec: scene.durationSec,
      role: roleForScene(index, scenes.length, scene),
      pacing: pacingForDuration(scene.durationSec),
      sampledFrames: input.frames.map((frame) => frame.fileName),
      evidence: {
        captions: sceneCaptions.map((caption) => caption.text),
        transcript: sceneTranscript,
        audioCueCount: sceneAudioCues.length,
      },
      directorFocus: directorFocusFor(input.category, index, scenes.length),
    };
  });

  return {
    runId: input.runId,
    category: input.category,
    durationSec: input.durationSec,
    sceneCount: scenes.length,
    hookWindowSec: Math.min(3, input.durationSec),
    progressionCurve: pacingCurveFor(scenes.map((scene) => scene.durationSec)),
    beats,
    transitions: input.cuts.map((cut) => transitionForCut(cut, scenes, audioCues, captions, transcriptWords)),
    editorChecklist: [
      'Verify whether each cut advances the hook, proof, payoff, or CTA.',
      'Check if captions change on the same beat as cuts or speech emphasis.',
      'Review camera movement and subject blocking manually when sampled frames are ambiguous.',
    ],
  };
}

function transitionForCut(
  cut: SceneCut,
  scenes: DetectedScene[],
  audioCues: AudioCue[],
  captions: CaptionObservation[],
  transcriptWords: TranscriptWord[],
): TransitionAnalysis {
  const toScene = scenes.find((scene) => scene.startSec === cut.timestampSec);
  const fromScene = toScene ? scenes[toScene.index - 2] : undefined;
  const nearbyAudio = nearestAudioCue(cut.timestampSec, audioCues);
  const nearbyTranscript = transcriptForRange(transcriptWords, cut.timestampSec, cut.timestampSec + 1);
  const nearbyCaption = captionsForScene(captions, toScene, scenes)[0]?.text ?? '';
  const type: TransitionType = nearbyAudio
    ? 'audio-led-cut'
    : nearbyTranscript
      ? 'speech-led-cut'
      : nearbyCaption
        ? 'caption-led-cut'
        : 'hard-cut';

  return {
    timestampSec: cut.timestampSec,
    fromSceneIndex: fromScene?.index ?? Math.max(1, (toScene?.index ?? 2) - 1),
    toSceneIndex: toScene?.index ?? Math.min(scenes.length, (fromScene?.index ?? 1) + 1),
    type,
    confidence: 'ffmpeg-scene-detect',
    ...(nearbyAudio ? { nearbyAudioCueSec: nearbyAudio.timestampSec } : {}),
    nearbyTranscript,
    nearbyCaption,
  };
}

function captionsForScene(
  captions: CaptionObservation[],
  scene: DetectedScene | undefined,
  scenes: DetectedScene[],
): CaptionObservation[] {
  if (!scene) return [];
  return captions.filter((caption) => sceneIndexForCaption(caption, scenes) === scene.index);
}

function sceneIndexForCaption(caption: CaptionObservation, scenes: DetectedScene[]): number {
  if (scenes.length <= 1) return 1;
  const maxSceneOffset = scenes.length - 1;
  const sceneOffset = Math.min(maxSceneOffset, Math.max(0, caption.frameIndex - 1));
  return scenes[sceneOffset]?.index ?? scenes[scenes.length - 1]?.index ?? 1;
}

function nearestAudioCue(timestampSec: number, cues: AudioCue[]): AudioCue | undefined {
  return cues.find((cue) => Math.abs(cue.timestampSec - timestampSec) <= 0.35);
}

function transcriptForRange(words: TranscriptWord[], startSec: number, endSec: number): string {
  return words
    .filter((word) => word.start >= startSec && word.start <= endSec)
    .map((word) => word.text)
    .join(' ');
}

function roleForScene(index: number, totalScenes: number, scene: DetectedScene): StoryboardRole {
  if (totalScenes === 1) return 'single-scene';
  if (index === 0) return 'hook';
  if (index === totalScenes - 1) return 'payoff';
  if (totalScenes <= 3) return 'proof';
  if (scene.startSec < 3) return 'setup';
  return 'build';
}

function pacingForDuration(durationSec: number): StoryboardPacing {
  if (durationSec <= 0.8) return 'snap';
  if (durationSec <= 2) return 'quick';
  if (durationSec <= 5) return 'held';
  return 'long-hold';
}

function directorFocusFor(category: VideoCategory, index: number, totalScenes: number): string[] {
  if (totalScenes === 1) {
    return ['sustain attention inside one held setup', 'find internal caption or speech beats'];
  }
  if (index === 0) {
    return ['pattern interrupt', 'opening promise', 'first readable proof'];
  }
  if (index === totalScenes - 1) {
    return ['payoff clarity', 'CTA or loop-back line', 'final caption hold'];
  }
  if (category === 'product-demo') {
    return ['workflow proof', 'screen or product evidence', 'step clarity'];
  }
  return ['proof beat', 'pacing bridge', 'caption or speech emphasis'];
}

function pacingCurveFor(durations: number[]): string {
  if (durations.length <= 1) return 'single-scene';
  const first = durations[0] ?? 0;
  const last = durations[durations.length - 1] ?? 0;
  if (first > last * 1.5) return 'accelerating';
  if (last > first * 1.5) return 'slow-build';
  return 'pulsed';
}

function singleScene(durationSec: number): DetectedScene {
  return {
    index: 1,
    startSec: 0,
    endSec: Number(durationSec.toFixed(3)),
    durationSec: Number(durationSec.toFixed(3)),
  };
}
