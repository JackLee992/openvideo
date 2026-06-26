import { describe, expect, it } from 'vitest';
import { runAnalyze } from '../src/cli/commands/analyze.js';
import { runCli, type CliIO } from '../src/cli/index.js';

function createIO(): CliIO & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    writeOut: (line) => stdout.push(line),
    writeErr: (line) => stderr.push(line),
  };
}

describe('openvideo analyze cli', () => {
  it('returns usage when input is missing', async () => {
    const io = createIO();

    const exitCode = await runCli(['analyze'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Usage: openvideo analyze <file-or-url>');
  });

  it('rejects unknown downloader strategies', async () => {
    const io = createIO();

    const exitCode = await runCli(['analyze', 'https://www.douyin.com/video/123', '--downloader', 'unknown'], io);

    expect(exitCode).toBe(2);
    expect(io.stderr.join('\n')).toContain('Unknown downloader: unknown');
  });

  it('passes cookie options to URL analysis downloads', async () => {
    const io = createIO();

    const exitCode = await runAnalyze(
      [
        'https://www.douyin.com/video/123',
        '--downloader',
        'yt-dlp',
        '--cookies-from-browser',
        'chrome',
        '--cookies',
        '/tmp/cookies.txt',
      ],
      io,
      {
        analyze: async (input) => {
          expect(input).toMatchObject({
            input: 'https://www.douyin.com/video/123',
            downloader: 'yt-dlp',
            cookiesFromBrowser: 'chrome',
            cookiesFile: '/tmp/cookies.txt',
          });
          return {
            runId: 'run-1',
            layout: {
              runId: 'run-1',
              runDir: '/tmp/openvideo/run-1',
              inputDir: '/tmp/openvideo/run-1/input',
              framesDir: '/tmp/openvideo/run-1/frames',
              analysisDir: '/tmp/openvideo/run-1/analysis',
            },
            artifacts: {
              metadataPath: '/tmp/openvideo/run-1/analysis/metadata.json',
              shotBreakdownPath: '/tmp/openvideo/run-1/analysis/shot-breakdown.json',
              editRhythmPath: '/tmp/openvideo/run-1/analysis/edit-rhythm.json',
              storyboardPath: '/tmp/openvideo/run-1/analysis/storyboard.json',
              transitionAnalysisPath: '/tmp/openvideo/run-1/analysis/transition-analysis.json',
              motionAnalysisPath: '/tmp/openvideo/run-1/analysis/motion-analysis.json',
              captionsPath: '/tmp/openvideo/run-1/analysis/captions.json',
              transcriptPath: '/tmp/openvideo/run-1/analysis/transcript.json',
              scriptNotesPath: '/tmp/openvideo/run-1/analysis/script-notes.md',
              videoStylePath: '/tmp/openvideo/run-1/VIDEO_STYLE.md',
              hyperframesBriefPath: '/tmp/openvideo/run-1/hyperframes-brief.md',
            },
          };
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(io.stdout.join('\n')).toContain('Created run: /tmp/openvideo/run-1');
  });
});
