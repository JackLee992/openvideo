import type { CliIO } from '../index.js';
import { analyzeVideo } from '../../analysis/analyze.js';
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

export async function runAnalyze(argv: string[], io: CliIO = DEFAULT_IO): Promise<number> {
  const parsed = parseAnalyzeArgs(argv);
  if (!parsed.ok) {
    io.writeErr(parsed.error);
    io.writeErr(analyzeUsage());
    return 2;
  }
  try {
    const result = await analyzeVideo(parsed.value);
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
    return { ok: false, error: `Unknown analyze option: ${arg}` };
  }
  return { ok: true, value };
}

function analyzeUsage(): string {
  return [
    'Usage: openvideo analyze <file-or-url> [--out runs] [--full] [--category <category>] [--downloader auto|yt-dlp|jiji|douyin-api]',
    'Categories: auto, product-demo, talking-head, knowledge, commerce, lifestyle, story, cinematic-ad, motion-graphic',
    'Downloader strategies: auto, yt-dlp, jiji, douyin-api',
  ].join('\n');
}
