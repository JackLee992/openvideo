import { describe, expect, it } from 'vitest';
import { buildScenesFromCuts, parseSceneCutTimes } from '../src/analysis/scenes.js';

describe('parseSceneCutTimes', () => {
  it('extracts sorted unique cut timestamps from ffmpeg showinfo output', () => {
    const stderr = [
      "[Parsed_showinfo_1 @ 0x123] n: 0 pts: 12288 pts_time:1.2 pos: -1 fmt:yuv420p",
      "[Parsed_showinfo_1 @ 0x123] n: 1 pts: 34816 pts_time:3.4 pos: -1 fmt:yuv420p",
      "[Parsed_showinfo_1 @ 0x123] n: 2 pts: 34816 pts_time:3.4 pos: -1 fmt:yuv420p",
    ].join('\n');

    expect(parseSceneCutTimes(stderr)).toEqual([1.2, 3.4]);
  });
});

describe('buildScenesFromCuts', () => {
  it('turns cut timestamps into contiguous shot ranges', () => {
    expect(buildScenesFromCuts([1.2, 3.4], 5)).toEqual([
      { index: 1, startSec: 0, endSec: 1.2, durationSec: 1.2 },
      { index: 2, startSec: 1.2, endSec: 3.4, durationSec: 2.2 },
      { index: 3, startSec: 3.4, endSec: 5, durationSec: 1.6 },
    ]);
  });

  it('keeps a single full-duration scene when there are no cuts', () => {
    expect(buildScenesFromCuts([], 8)).toEqual([{ index: 1, startSec: 0, endSec: 8, durationSec: 8 }]);
  });
});
