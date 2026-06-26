import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  detectCaptionsInFrames,
  parseTesseractTsv,
  type TesseractRunner,
} from '../src/analysis/captions.js';

describe('parseTesseractTsv', () => {
  it('extracts visible caption text from high-confidence OCR rows', () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t40\t900\t180\t60\t92\tAI',
      '5\t1\t1\t1\t1\t2\t235\t900\t260\t60\t89\t工具',
      '5\t1\t1\t1\t2\t1\t80\t980\t220\t55\t22\tnoise',
      '5\t1\t1\t1\t2\t2\t330\t980\t220\t55\t-1\t',
    ].join('\n');

    const observation = parseTesseractTsv(tsv, {
      frameIndex: 1,
      frameName: 'frame-0001.jpg',
      language: 'chi_sim+eng',
      minConfidence: 35,
    });

    expect(observation).toEqual({
      frameIndex: 1,
      frameName: 'frame-0001.jpg',
      text: 'AI 工具',
      confidence: 90.5,
      language: 'chi_sim+eng',
      source: 'tesseract',
    });
  });
});

describe('detectCaptionsInFrames', () => {
  it('returns an unavailable result when the OCR command is missing', async () => {
    const runner: TesseractRunner = async () => {
      const error = new Error('spawn tesseract ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    };

    const result = await detectCaptionsInFrames(
      [{ index: 1, fileName: 'frame-0001.jpg', path: path.join('/tmp', 'frame-0001.jpg') }],
      { runner },
    );

    expect(result.available).toBe(false);
    expect(result.observations).toEqual([]);
    expect(result.error).toContain('tesseract');
  });

  it('runs OCR on sampled frames and keeps readable observations', async () => {
    const runner: TesseractRunner = async () =>
      [
        'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
        '5\t1\t1\t1\t1\t1\t30\t820\t160\t64\t88\t开场',
        '5\t1\t1\t1\t1\t2\t210\t820\t240\t64\t91\t钩子',
      ].join('\n');

    const result = await detectCaptionsInFrames(
      [{ index: 2, fileName: 'frame-0002.jpg', path: path.join('/tmp', 'frame-0002.jpg') }],
      { language: 'chi_sim+eng', runner },
    );

    expect(result).toMatchObject({
      available: true,
      provider: 'tesseract',
      language: 'chi_sim+eng',
      observations: [
        {
          frameIndex: 2,
          frameName: 'frame-0002.jpg',
          text: '开场 钩子',
          confidence: 89.5,
        },
      ],
    });
  });
});
