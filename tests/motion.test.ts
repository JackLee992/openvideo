import { describe, expect, it } from 'vitest';
import {
  analyzeGrayFrameMotion,
  buildSceneMotionProfiles,
  type GrayFrameSample,
} from '../src/analysis/motion.js';

function sample(index: number, pixels: number[], width = 4, height = 4): GrayFrameSample {
  return {
    index,
    timestampSec: index - 1,
    width,
    height,
    pixels: Uint8Array.from(pixels),
  };
}

describe('analyzeGrayFrameMotion', () => {
  it('classifies repeated frames as locked-off camera motion', () => {
    const pixels = [
      0, 0, 0, 0,
      0, 120, 120, 0,
      0, 120, 120, 0,
      0, 0, 0, 0,
    ];

    const result = analyzeGrayFrameMotion([sample(1, pixels), sample(2, pixels)]);

    expect(result.available).toBe(true);
    expect(result.cameraMovement).toBe('locked-off');
    expect(result.motionIntensity).toBe('low');
    expect(result.dominantDirection).toBe('none');
    expect(result.averageFrameDiff).toBe(0);
  });

  it('classifies consistent centroid movement as pan or reframe', () => {
    const leftBlock = [
      0, 0, 0, 0,
      160, 160, 0, 0,
      160, 160, 0, 0,
      0, 0, 0, 0,
    ];
    const rightBlock = [
      0, 0, 0, 0,
      0, 0, 160, 160,
      0, 0, 160, 160,
      0, 0, 0, 0,
    ];

    const result = analyzeGrayFrameMotion([sample(1, leftBlock), sample(2, rightBlock)]);

    expect(result.cameraMovement).toBe('pan-or-reframe');
    expect(result.motionIntensity).toBe('high');
    expect(result.dominantDirection).toBe('right');
    expect(result.centroidShift.x).toBeGreaterThan(0.4);
  });

  it('builds per-scene motion profiles from sampled timestamps', () => {
    const result = analyzeGrayFrameMotion([
      sample(1, [
        0, 0, 0, 0,
        160, 160, 0, 0,
        160, 160, 0, 0,
        0, 0, 0, 0,
      ]),
      sample(2, [
        0, 0, 0, 0,
        0, 0, 160, 160,
        0, 0, 160, 160,
        0, 0, 0, 0,
      ]),
    ]);

    const profiles = buildSceneMotionProfiles(
      [
        { index: 1, startSec: 0, endSec: 0.5, durationSec: 0.5 },
        { index: 2, startSec: 0.5, endSec: 2, durationSec: 1.5 },
      ],
      result,
    );

    expect(profiles).toEqual([
      {
        sceneIndex: 1,
        cameraMovement: 'pan-or-reframe',
        motionIntensity: 'high',
        dominantDirection: 'right',
        sampleCount: 1,
      },
      {
        sceneIndex: 2,
        cameraMovement: 'pan-or-reframe',
        motionIntensity: 'high',
        dominantDirection: 'right',
        sampleCount: 1,
      },
    ]);
  });
});
