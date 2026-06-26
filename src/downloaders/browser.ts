import { spawn } from 'node:child_process';
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { probeVideo, type VideoMetadata } from '../analysis/probe.js';
import { detectLikelyPreview, videoSummary, writeDownloadDiagnostics } from './diagnostics.js';

interface BrowserVideoElement {
  currentSrc: string;
  duration: number;
  readyState: number;
  videoHeight: number;
  videoWidth: number;
}

declare const document: {
  querySelectorAll: (selector: string) => ArrayLike<BrowserVideoElement>;
};

declare const performance:
  | {
      getEntriesByType: (type: string) => ArrayLike<{ name?: string }>;
    }
  | undefined;

export interface BrowserVideoInfo {
  src: string;
  duration?: number | null;
  width?: number;
  height?: number;
}

export interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface BrowserDownloadPage {
  goto: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<unknown>;
  evaluate: <T>(pageFunction: () => T | Promise<T>) => Promise<T>;
  waitForTimeout: (ms: number) => Promise<void>;
}

export interface BrowserDownloadContext {
  newPage: () => Promise<BrowserDownloadPage>;
  addCookies?: (cookies: BrowserCookie[]) => Promise<void>;
  close?: () => Promise<void>;
}

export interface BrowserDownloadInstance {
  newContext: (options?: { storageState?: string }) => Promise<BrowserDownloadContext>;
  close: () => Promise<void>;
}

export interface BrowserLaunchOptions {
  headless: boolean;
  channel?: string;
}

export type ChromiumLauncher = (options: BrowserLaunchOptions) => Promise<BrowserDownloadInstance>;
export type MediaFetcher = (url: string, outputPath: string, referer: string) => Promise<void>;
export type MediaMerger = (videoPath: string, audioPath: string, outputPath: string) => Promise<void>;
export type MediaProber = (inputPath: string) => Promise<VideoMetadata>;

export interface BrowserMediaResource {
  type: 'video' | 'audio';
  url: string;
}

export interface BrowserDownloaderOptions {
  cookiesFile?: string;
  storageStatePath?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  headless?: boolean;
  launchChromium?: ChromiumLauncher;
  fetchMedia?: MediaFetcher;
  mergeMedia?: MediaMerger;
  probeMedia?: MediaProber;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 500;

export async function downloadWithBrowser(
  url: string,
  outputDir: string,
  options: BrowserDownloaderOptions = {},
): Promise<string> {
  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });

  const launchChromium = options.launchChromium ?? (await loadPlaywrightChromium());
  const browser = await launchChromium({ headless: options.headless ?? defaultHeadless() });
  let context: BrowserDownloadContext | undefined;

  try {
    context = await browser.newContext(
      options.storageStatePath ? { storageState: path.resolve(options.storageStatePath) } : undefined,
    );
    if (options.cookiesFile) {
      if (!context.addCookies) {
        throw new Error('Browser context does not support cookie injection.');
      }
      await context.addCookies(filterCookiesForUrl(await readBrowserCookies(options.cookiesFile), url));
    }

    const page = await context.newPage();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const video = await waitForPlayableVideo(page, timeoutMs, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    const outputPath = path.join(resolvedOutputDir, 'source.mp4');
    let mediaResources: BrowserMediaResource[] = [];
    if (video.src.startsWith('blob:')) {
      mediaResources = await downloadBlobBackedMedia(page, resolvedOutputDir, outputPath, url, {
        fetchMedia: options.fetchMedia ?? fetchMedia,
        mergeMedia: options.mergeMedia ?? mergeMedia,
        pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
        timeoutMs,
      });
    } else {
      await (options.fetchMedia ?? fetchMedia)(video.src, outputPath, url);
    }
    await chmod(outputPath, 0o600).catch(() => undefined);
    await assertDownloaded(outputPath);
    const metadata = await (options.probeMedia ?? probeVideo)(outputPath);
    const previewCheck = detectLikelyPreview({
      actualDurationSec: metadata.durationSec,
      pageDurationSec: video.duration,
    });
    const diagnosticsPath = await writeDownloadDiagnostics(resolvedOutputDir, {
      url,
      createdAt: new Date().toISOString(),
      provider: 'browser',
      outputPath,
      attempts: [{ provider: 'browser', ok: true, path: outputPath }],
      video: videoSummary(metadata),
      browser: {
        playbackMode: video.src.startsWith('blob:') ? 'blob-mse' : 'direct-video',
        pageVideo: {
          durationSec: video.duration,
          width: video.width,
          height: video.height,
        },
        mediaResourceTypes: mediaResources.map((resource) => resource.type),
      },
      previewCheck,
    });
    if (previewCheck.likelyPreview) {
      throw new Error(
        `Browser downloader captured likely preview media: ${previewCheck.reason}. Diagnostics: ${diagnosticsPath}`,
      );
    }
    return outputPath;
  } finally {
    await context?.close?.().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function downloadBlobBackedMedia(
  page: BrowserDownloadPage,
  outputDir: string,
  outputPath: string,
  referer: string,
  options: {
    fetchMedia: MediaFetcher;
    mergeMedia: MediaMerger;
    pollIntervalMs: number;
    timeoutMs: number;
  },
): Promise<BrowserMediaResource[]> {
  const resources = await waitForMediaResources(page, options.timeoutMs, options.pollIntervalMs);
  const videoResource = resources.find((resource) => resource.type === 'video');
  const audioResource = resources.find((resource) => resource.type === 'audio');
  if (!videoResource) {
    throw new Error('Browser page uses blob video playback, but no media-video resource was observed.');
  }

  if (!audioResource) {
    await options.fetchMedia(videoResource.url, outputPath, referer);
    return resources;
  }

  const videoPath = path.join(outputDir, 'source.video.mp4');
  const audioPath = path.join(outputDir, 'source.audio.m4a');
  await options.fetchMedia(videoResource.url, videoPath, referer);
  await options.fetchMedia(audioResource.url, audioPath, referer);
  await options.mergeMedia(videoPath, audioPath, outputPath);
  return resources;
}

async function waitForMediaResources(
  page: BrowserDownloadPage,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<BrowserMediaResource[]> {
  const deadline = Date.now() + timeoutMs;
  let lastResources: BrowserMediaResource[] = [];
  while (Date.now() <= deadline) {
    lastResources = await page.evaluate<BrowserMediaResource[]>(() => {
      const entries = Array.from(performance?.getEntriesByType('resource') ?? []);
      return entries
        .map((entry) => String(entry.name || ''))
        .map((url): BrowserMediaResource | null => {
          if (!url) return null;
          if (/\/media-video-[^/?]+/i.test(url)) return { type: 'video', url };
          if (/\/media-audio-[^/?]+/i.test(url)) return { type: 'audio', url };
          return null;
        })
        .filter((resource): resource is BrowserMediaResource => Boolean(resource));
    });
    if (lastResources.some((resource) => resource.type === 'video')) {
      return preferRecentMediaResources(lastResources);
    }
    await page.waitForTimeout(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
  }
  return preferRecentMediaResources(lastResources);
}

function preferRecentMediaResources(resources: BrowserMediaResource[]): BrowserMediaResource[] {
  const byType = new Map<BrowserMediaResource['type'], BrowserMediaResource>();
  for (const resource of resources) {
    byType.set(resource.type, resource);
  }
  return [byType.get('video'), byType.get('audio')].filter((resource): resource is BrowserMediaResource =>
    Boolean(resource),
  );
}

async function waitForPlayableVideo(
  page: BrowserDownloadPage,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<BrowserVideoInfo> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const video = await page.evaluate<BrowserVideoInfo | null>(() => {
      const candidates = Array.from(document.querySelectorAll('video'));
      const playable = candidates.find((item) => item.currentSrc && item.readyState >= 2) ?? candidates.find((item) => item.currentSrc);
      if (!playable?.currentSrc) return null;
      return {
        src: playable.currentSrc,
        duration: Number.isFinite(playable.duration) ? playable.duration : null,
        width: playable.videoWidth,
        height: playable.videoHeight,
      };
    });
    if (video?.src) return video;
    await page.waitForTimeout(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
  }
  throw new Error('Timed out waiting for a playable <video> source in the browser page.');
}

async function fetchMedia(url: string, outputPath: string, referer: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      referer,
    },
  });
  if (!response.ok) {
    throw new Error(`Browser media download failed (${response.status} ${response.statusText}).`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, data);
}

function mergeMedia(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', '-i', videoPath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', outputPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg failed to merge browser media resources: ${stderr.trim() || `exit code ${code}`}`));
      }
    });
  });
}

async function assertDownloaded(outputPath: string): Promise<void> {
  const info = await stat(outputPath);
  if (!info.isFile() || info.size <= 0) {
    throw new Error(`Browser downloader did not create a non-empty video at ${outputPath}.`);
  }
}

function defaultHeadless(): boolean {
  const value = process.env.OPENVIDEO_BROWSER_HEADLESS;
  return value === '1' || value === 'true';
}

export async function readBrowserCookies(cookiesFile: string): Promise<BrowserCookie[]> {
  const text = await readFile(cookiesFile, 'utf8');
  const jsonCookies = parseJsonCookies(text);
  if (jsonCookies.length > 0) return jsonCookies;
  return parseNetscapeCookies(text);
}

function parseJsonCookies(text: string): BrowserCookie[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    const cookies = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { cookies?: unknown }).cookies)
        ? (parsed as { cookies: unknown[] }).cookies
        : null;
    if (cookies) return cookies.map(normalizeJsonCookie).filter((cookie): cookie is BrowserCookie => Boolean(cookie));
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([name, value]) => ({ name, value, domain: '.douyin.com', path: '/' }));
    }
    return [];
  } catch {
    return [];
  }
}

function normalizeJsonCookie(value: unknown): BrowserCookie | null {
  if (!value || typeof value !== 'object') return null;
  const cookie = value as Partial<BrowserCookie>;
  if (!cookie.name || !cookie.value || !cookie.domain) return null;
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    expires: normalizeCookieExpires(cookie.expires),
    ...(typeof cookie.httpOnly === 'boolean' ? { httpOnly: cookie.httpOnly } : {}),
    ...(typeof cookie.secure === 'boolean' ? { secure: cookie.secure } : {}),
    ...(cookie.sameSite ? { sameSite: cookie.sameSite } : {}),
  };
}

function parseNetscapeCookies(text: string): BrowserCookie[] {
  const cookies: BrowserCookie[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || (line.startsWith('#') && !line.startsWith('#HttpOnly_'))) continue;
    const httpOnly = line.startsWith('#HttpOnly_');
    const fields = line.replace(/^#HttpOnly_/, '').split(/\t+/);
    if (fields.length < 7) continue;
    const [domain, , cookiePath, secure, expires, name, ...valueParts] = fields;
    const value = valueParts.join('\t');
    if (!domain || !name || !value) continue;
    cookies.push({
      name,
      value,
      domain,
      path: cookiePath || '/',
      expires: normalizeCookieExpires(Number(expires)),
      httpOnly,
      secure: secure === 'TRUE',
    });
  }
  return cookies;
}

function normalizeCookieExpires(expires: unknown): number {
  const value = typeof expires === 'number' ? expires : typeof expires === 'string' ? Number(expires) : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) return -1;
  const unixSeconds = value > 10_000_000_000 ? Math.floor(value / 1_000_000 - 11_644_473_600) : value;
  return unixSeconds > 0 ? unixSeconds : -1;
}

export function filterCookiesForUrl(cookies: BrowserCookie[], url: string): BrowserCookie[] {
  const hostname = new URL(url).hostname.toLowerCase();
  const siteDomain = registrableDomain(hostname);
  return cookies.filter((cookie) => {
    const cookieDomain = cookie.domain.replace(/^\./, '').toLowerCase();
    return cookieDomain === siteDomain || cookieDomain.endsWith(`.${siteDomain}`);
  });
}

function registrableDomain(hostname: string): string {
  const parts = hostname.split('.').filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
}

interface PlaywrightModule {
  chromium: {
    launch: (options: BrowserLaunchOptions) => Promise<BrowserDownloadInstance>;
  };
}

async function loadPlaywrightChromium(): Promise<ChromiumLauncher> {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<unknown>;
    const playwright = (await dynamicImport('playwright')) as PlaywrightModule;
    return (options) => playwright.chromium.launch(withDefaultChromeChannel(options));
  } catch (error) {
    throw new Error(
      [
        'Playwright is required for the browser downloader.',
        'Install it with:',
        '  npm install --save-dev playwright',
        '  npx playwright install chromium',
        error instanceof Error ? `Original error: ${error.message}` : String(error),
      ].join('\n'),
    );
  }
}

function withDefaultChromeChannel(options: BrowserLaunchOptions): BrowserLaunchOptions {
  if (process.env.OPENVIDEO_PLAYWRIGHT_CHANNEL === 'bundled') {
    return options;
  }
  return {
    ...options,
    channel: process.env.OPENVIDEO_PLAYWRIGHT_CHANNEL || 'chrome',
  };
}
