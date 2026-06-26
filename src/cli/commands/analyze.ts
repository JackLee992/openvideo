import type { CliIO } from '../index.js';
import { analyzeVideo, type AnalyzeInput, type AnalyzeResult } from '../../analysis/analyze.js';
import type { VideoCategory } from '../../analysis/artifacts.js';
import { DOWNLOAD_STRATEGIES, type DownloadStrategy } from '../../downloaders/providers.js';

const CATEGORY_VALUES = new Set<VideoCategory>([
  'auto',
  'product-demo',
  'talking-head',
  'knowledge',
  'commerce',
  'lifestyle',
  'story',
  'cinematic-ad',
  'motion-graphic',
]);

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

export interface AnalyzeCommandDeps {
  analyze?: (input: AnalyzeInput) => Promise<AnalyzeResult>;
}

export async function runAnalyze(
  argv: string[],
  io: CliIO = DEFAULT_IO,
  deps: AnalyzeCommandDeps = {},
): Promise<number> {
  const parsed = parseAnalyzeArgs(argv);
  if (!parsed.ok) {
    io.writeErr(parsed.error);
    io.writeErr(analyzeUsage());
    return 2;
  }
  try {
    const analyze = deps.analyze ?? analyzeVideo;
    const result = await analyze(parsed.value);
    io.writeOut(`Created run: ${result.layout.runDir}`);
    io.writeOut('Wrote VIDEO_STYLE.md');
    io.writeOut('Wrote hyperframes-brief.md');
    return 0;
  } catch (err) {
    io.writeErr(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

type ParseResult =
  | {
      ok: true;
      value: {
        input: string;
        outDir?: string;
        full?: boolean;
        category?: VideoCategory;
        downloader?: DownloadStrategy;
        cookiesFile?: string;
        cookiesFromBrowser?: string;
        browserStoragePath?: string;
        minDurationSec?: number;
      };
    }
  | { ok: false; error: string };

function parseAnalyzeArgs(argv: string[]): ParseResult {
  const [input, ...rest] = argv;
  if (!input) return { ok: false, error: 'Missing input.' };
  const value: {
    input: string;
    outDir?: string;
    full?: boolean;
    category?: VideoCategory;
    downloader?: DownloadStrategy;
    cookiesFile?: string;
    cookiesFromBrowser?: string;
    browserStoragePath?: string;
    minDurationSec?: number;
  } = { input };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--full') {
      value.full = true;
      continue;
    }
    if (arg === '--out') {
      const outDir = rest[++i];
      if (!outDir) return { ok: false, error: 'Missing value for --out.' };
      value.outDir = outDir;
      continue;
    }
    if (arg === '--category') {
      const category = rest[++i] as VideoCategory | undefined;
      if (!category) return { ok: false, error: 'Missing value for --category.' };
      if (!CATEGORY_VALUES.has(category)) return { ok: false, error: `Unknown category: ${category}` };
      value.category = category;
      continue;
    }
    if (arg === '--downloader') {
      const downloader = rest[++i] as DownloadStrategy | undefined;
      if (!downloader) return { ok: false, error: 'Missing value for --downloader.' };
      if (!DOWNLOAD_STRATEGIES.has(downloader)) return { ok: false, error: `Unknown downloader: ${downloader}` };
      value.downloader = downloader;
      continue;
    }
    if (arg === '--cookies') {
      const cookiesFile = rest[++i];
      if (!cookiesFile) return { ok: false, error: 'Missing value for --cookies.' };
      value.cookiesFile = cookiesFile;
      continue;
    }
    if (arg === '--cookies-from-browser') {
      const cookiesFromBrowser = rest[++i];
      if (!cookiesFromBrowser) return { ok: false, error: 'Missing value for --cookies-from-browser.' };
      value.cookiesFromBrowser = cookiesFromBrowser;
      continue;
    }
    if (arg === '--storage') {
      const browserStoragePath = rest[++i];
      if (!browserStoragePath) return { ok: false, error: 'Missing value for --storage.' };
      value.browserStoragePath = browserStoragePath;
      continue;
    }
    if (arg === '--min-duration') {
      const minDurationSec = Number(rest[++i]);
      if (!Number.isFinite(minDurationSec) || minDurationSec <= 0) {
        return { ok: false, error: 'Invalid value for --min-duration.' };
      }
      value.minDurationSec = minDurationSec;
      continue;
    }
    return { ok: false, error: `Unknown analyze option: ${arg}` };
  }
  return { ok: true, value };
}

function analyzeUsage(): string {
  return [
    'Usage: openvideo analyze <file-or-url> [--out runs] [--full] [--category <category>] [--downloader auto|yt-dlp|jiji|browser|douyin-api] [--cookies <file>] [--cookies-from-browser <browser>] [--storage <playwright-storage.json>]',
    '       [--min-duration <seconds>]',
    'Categories: auto, product-demo, talking-head, knowledge, commerce, lifestyle, story, cinematic-ad, motion-graphic',
    'Downloader strategies: auto, yt-dlp, jiji, browser, douyin-api',
  ].join('\n');
}
