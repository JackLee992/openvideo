import type { CliIO } from '../index.js';
import { downloadVideo, type DownloadInput, type DownloadResult } from '../../downloaders/download.js';
import { DOWNLOAD_STRATEGIES, type DownloadStrategy } from '../../downloaders/providers.js';

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

export interface DownloadCommandDeps {
  download?: (input: DownloadInput) => Promise<DownloadResult>;
}

export async function runDownload(
  argv: string[],
  io: CliIO = DEFAULT_IO,
  deps: DownloadCommandDeps = {},
): Promise<number> {
  const parsed = parseDownloadArgs(argv);
  if (!parsed.ok) {
    io.writeErr(parsed.error);
    io.writeErr(downloadUsage());
    return 2;
  }

  try {
    const download = deps.download ?? downloadVideo;
    const result = await download(parsed.value);
    io.writeOut(`Download folder: ${result.outputDir}`);
    io.writeOut(`Provider: ${result.provider}`);
    io.writeOut(`Video: ${result.path}`);
    return 0;
  } catch (error) {
    io.writeErr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

type ParseResult = { ok: true; value: DownloadInput } | { ok: false; error: string };

function parseDownloadArgs(argv: string[]): ParseResult {
  const [url, ...rest] = argv;
  if (!url) return { ok: false, error: 'Missing URL.' };
  const value: DownloadInput = { url };

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--out') {
      const outDir = rest[++i];
      if (!outDir) return { ok: false, error: 'Missing value for --out.' };
      value.outDir = outDir;
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
    return { ok: false, error: `Unknown download option: ${arg}` };
  }

  return { ok: true, value };
}

function downloadUsage(): string {
  return [
    'Usage: openvideo download <url> [--out downloads] [--downloader auto|yt-dlp|jiji|browser|douyin-api] [--cookies <file>] [--cookies-from-browser <browser>] [--storage <playwright-storage.json>]',
    'Downloader strategies: auto, yt-dlp, jiji, browser, douyin-api',
  ].join('\n');
}
