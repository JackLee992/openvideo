import { downloadWithJiji } from './jiji.js';
import { downloadWithFallback, type DownloadProvider } from './fallback.js';
import { downloadWithYtDlp } from '../sources/yt-dlp.js';

export type DownloadStrategy = 'auto' | 'yt-dlp' | 'jiji';

export const DOWNLOAD_STRATEGIES = new Set<DownloadStrategy>(['auto', 'yt-dlp', 'jiji']);

export function createDownloadProviders(strategy: DownloadStrategy = 'auto'): DownloadProvider[] {
  const providers: DownloadProvider[] = [];
  if (strategy === 'auto' || strategy === 'yt-dlp') {
    providers.push({
      name: 'yt-dlp',
      download: (url, outputDir) => downloadWithYtDlp(url, outputDir),
    });
  }
  if (strategy === 'auto' || strategy === 'jiji') {
    providers.push({
      name: 'jiji',
      download: (url, outputDir) => downloadWithJiji(url, outputDir),
    });
  }
  return providers;
}

export { downloadWithFallback };
