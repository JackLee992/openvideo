import { describe, expect, it } from 'vitest';
import { buildAudioCuesFromSilence, parseSilenceDetectEvents } from '../src/analysis/audio.js';

describe('parseSilenceDetectEvents', () => {
  it('extracts silence start and end timestamps from ffmpeg output', () => {
    const output = [
      '[silencedetect @ 0x1] silence_start: 0',
      '[silencedetect @ 0x1] silence_end: 0.52 | silence_duration: 0.52',
      '[silencedetect @ 0x1] silence_start: 2.1',
    ].join('\n');

    expect(parseSilenceDetectEvents(output)).toEqual([
      { type: 'silence-start', timestampSec: 0 },
      { type: 'silence-end', timestampSec: 0.52, durationSec: 0.52 },
      { type: 'silence-start', timestampSec: 2.1 },
    ]);
  });
});

describe('buildAudioCuesFromSilence', () => {
  it('converts silence endings into sound-start cues', () => {
    expect(
      buildAudioCuesFromSilence([
        { type: 'silence-start', timestampSec: 0 },
        { type: 'silence-end', timestampSec: 0.52, durationSec: 0.52 },
        { type: 'silence-start', timestampSec: 2.1 },
      ]),
    ).toEqual([{ type: 'sound-start', timestampSec: 0.52, confidence: 'ffmpeg-silencedetect' }]);
  });
});
