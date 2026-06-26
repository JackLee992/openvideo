import { describe, expect, it } from 'vitest';
import { buildStoryboardAnalysis } from '../src/analysis/storyboard.js';

describe('buildStoryboardAnalysis', () => {
  it('turns scenes, transcript, OCR, and audio cues into storyboard beats and transitions', () => {
    const analysis = buildStoryboardAnalysis({
      runId: 'run-1',
      category: 'knowledge',
      durationSec: 12,
      scenes: [
        { index: 1, startSec: 0, endSec: 1.4, durationSec: 1.4 },
        { index: 2, startSec: 1.4, endSec: 4.2, durationSec: 2.8 },
        { index: 3, startSec: 4.2, endSec: 12, durationSec: 7.8 },
      ],
      cuts: [{ timestampSec: 1.4 }, { timestampSec: 4.2 }],
      frames: [
        { index: 1, fileName: 'frame-0001.jpg', path: '/tmp/frame-0001.jpg' },
        { index: 2, fileName: 'frame-0002.jpg', path: '/tmp/frame-0002.jpg' },
        { index: 3, fileName: 'frame-0003.jpg', path: '/tmp/frame-0003.jpg' },
      ],
      audioDetection: {
        raw: '',
        silenceEvents: [],
        cues: [{ type: 'sound-start', timestampSec: 1.42, confidence: 'ffmpeg-silencedetect' }],
      },
      captionDetection: {
        available: true,
        provider: 'tesseract',
        language: 'chi_sim+eng',
        observations: [
          {
            frameIndex: 1,
            frameName: 'frame-0001.jpg',
            text: '三秒看懂',
            confidence: 91,
            language: 'chi_sim+eng',
            source: 'tesseract',
          },
          {
            frameIndex: 2,
            frameName: 'frame-0002.jpg',
            text: '核心步骤',
            confidence: 88,
            language: 'chi_sim+eng',
            source: 'tesseract',
          },
        ],
      },
      transcriptDetection: {
        available: true,
        provider: 'hyperframes-transcribe',
        model: 'small',
        language: 'zh',
        words: [
          { id: 'w0', text: '先', start: 0.2, end: 0.4 },
          { id: 'w1', text: '看', start: 0.42, end: 0.7 },
          { id: 'w2', text: '结果', start: 1.5, end: 2.2 },
          { id: 'w3', text: '最后', start: 9.2, end: 9.6 },
          { id: 'w4', text: '行动', start: 9.8, end: 10.4 },
        ],
        text: '先 看 结果 最后 行动',
      },
    });

    expect(analysis.progressionCurve).toBe('slow-build');
    expect(analysis.beats.map((beat) => beat.role)).toEqual(['hook', 'proof', 'payoff']);
    expect(analysis.beats[0]).toMatchObject({
      sceneIndex: 1,
      pacing: 'quick',
      evidence: {
        captions: ['三秒看懂'],
        transcript: '先 看',
      },
    });
    expect(analysis.beats[1].evidence.transcript).toBe('结果');
    expect(analysis.transitions).toEqual([
      {
        timestampSec: 1.4,
        fromSceneIndex: 1,
        toSceneIndex: 2,
        type: 'audio-led-cut',
        confidence: 'ffmpeg-scene-detect',
        nearbyAudioCueSec: 1.42,
        nearbyTranscript: '结果',
        nearbyCaption: '核心步骤',
      },
      {
        timestampSec: 4.2,
        fromSceneIndex: 2,
        toSceneIndex: 3,
        type: 'hard-cut',
        confidence: 'ffmpeg-scene-detect',
        nearbyTranscript: '',
        nearbyCaption: '',
      },
    ]);
  });

  it('creates a single-scene storyboard when no cuts are detected', () => {
    const analysis = buildStoryboardAnalysis({
      runId: 'run-2',
      category: 'talking-head',
      durationSec: 8,
      scenes: [{ index: 1, startSec: 0, endSec: 8, durationSec: 8 }],
      cuts: [],
      frames: [],
    });

    expect(analysis.beats).toHaveLength(1);
    expect(analysis.beats[0].role).toBe('single-scene');
    expect(analysis.transitions).toEqual([]);
  });
});
