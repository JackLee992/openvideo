import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RunLayout } from '../project/paths.js';

export type SourceKind = 'local-file' | 'direct-url' | 'downloaded-url';

export interface NormalizedSource {
  kind: SourceKind;
  originalInput: string;
  fileName: string;
  localPath: string;
}

export type FetchLike = (url: string) => Promise<Response>;
export type UrlDownloader = (url: string, outputDir: string) => Promise<string>;

export interface NormalizeSourceOptions {
  fetchImpl?: FetchLike;
  urlDownloader?: UrlDownloader;
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v']);
const CONTENT_TYPE_EXTENSION: Array<[string, string]> = [
  ['video/mp4', '.mp4'],
  ['video/quicktime', '.mov'],
  ['video/webm', '.webm'],
  ['video/x-m4v', '.m4v'],
];

export async function normalizeSource(
  input: string,
  layout: RunLayout,
  options: NormalizeSourceOptions = {},
): Promise<NormalizedSource> {
  await mkdir(layout.inputDir, { recursive: true });
  if (isHttpUrl(input)) {
    return normalizeRemoteSource(input, layout, options);
  }
  return copyLocalFile(input, layout);
}

async function normalizeRemoteSource(
  input: string,
  layout: RunLayout,
  options: NormalizeSourceOptions,
): Promise<NormalizedSource> {
  const url = new URL(input);
  if (options.urlDownloader && shouldUseExternalDownloaderFirst(url)) {
    return downloadExternalUrl(input, layout, options.urlDownloader);
  }

  try {
    return await downloadDirectUrl(input, layout, options.fetchImpl ?? fetch);
  } catch (error) {
    if (!options.urlDownloader) {
      throw error;
    }
    return downloadExternalUrl(input, layout, options.urlDownloader);
  }
}

async function copyLocalFile(input: string, layout: RunLayout): Promise<NormalizedSource> {
  const extension = videoExtensionFromPath(input);
  if (!extension) {
    throw new Error(`Unsupported video extension for "${input}". Supported: .mp4, .mov, .webm, .m4v.`);
  }
  const fileName = `source${extension}`;
  const localPath = path.join(layout.inputDir, fileName);
  await copyFile(input, localPath);
  return {
    kind: 'local-file',
    originalInput: input,
    fileName,
    localPath,
  };
}

async function downloadDirectUrl(
  input: string,
  layout: RunLayout,
  fetchImpl: FetchLike,
): Promise<NormalizedSource> {
  const response = await fetchImpl(input);
  if (!response.ok) {
    throw new Error(`Direct URL request failed (${response.status}) for ${input}`);
  }
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  const extension = extensionFromContentType(contentType) ?? videoExtensionFromPath(new URL(input).pathname);
  if (!extension) {
    throw new Error('Direct URL did not return video content and has no supported video extension.');
  }
  const fileName = `source${extension}`;
  const localPath = path.join(layout.inputDir, fileName);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(localPath, bytes);
  return {
    kind: 'direct-url',
    originalInput: input,
    fileName,
    localPath,
  };
}

async function downloadExternalUrl(
  input: string,
  layout: RunLayout,
  urlDownloader: UrlDownloader,
): Promise<NormalizedSource> {
  const downloadedPath = await urlDownloader(input, layout.inputDir);
  const extension = videoExtensionFromPath(downloadedPath);
  if (!extension) {
    throw new Error(`External downloader returned unsupported video extension for "${downloadedPath}".`);
  }
  const fileName = `source${extension}`;
  const localPath = path.join(layout.inputDir, fileName);
  if (path.resolve(downloadedPath) !== path.resolve(localPath)) {
    await copyFile(downloadedPath, localPath);
  }
  return {
    kind: 'downloaded-url',
    originalInput: input,
    fileName,
    localPath,
  };
}

function isHttpUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function videoExtensionFromPath(input: string): string | null {
  const extension = path.extname(input).toLowerCase();
  return VIDEO_EXTENSIONS.has(extension) ? extension : null;
}

function extensionFromContentType(contentType: string): string | null {
  return CONTENT_TYPE_EXTENSION.find(([type]) => type === contentType)?.[1] ?? null;
}

function shouldUseExternalDownloaderFirst(url: URL): boolean {
  return isKnownVideoPlatform(url.hostname) || !videoExtensionFromPath(url.pathname);
}

function isKnownVideoPlatform(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return ['douyin.com', 'iesdouyin.com', 'tiktok.com'].some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
  );
}
