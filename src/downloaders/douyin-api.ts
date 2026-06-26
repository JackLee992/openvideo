import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type FetchLike = (url: string) => Promise<Response>;

export interface DouyinApiDownloaderOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export function defaultDouyinApiBaseUrl(): string {
  return process.env.OPENVIDEO_DOUYIN_API_BASE_URL ?? 'http://127.0.0.1:80';
}

export async function downloadWithDouyinApi(
  url: string,
  outputDir: string,
  options: DouyinApiDownloaderOptions = {},
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const baseUrl = trimTrailingSlash(options.baseUrl ?? defaultDouyinApiBaseUrl());
  const endpoint = new URL(`${baseUrl}/api/download`);
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('prefix', 'false');
  endpoint.searchParams.set('with_watermark', 'false');

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(endpoint.toString());
  } catch (error) {
    throw new Error(`Douyin API downloader failed. Is the service running at ${baseUrl}? ${errorMessage(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Douyin API downloader failed (${response.status}). Is the service running at ${baseUrl}?`);
  }

  const localPath = path.join(outputDir, 'source.mp4');
  await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
  return localPath;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
