import { downloadWithBrowser } from './browser.js';
import { downloadWithDouyinApi } from './douyin-api.js';
import { downloadWithJiji } from './jiji.js';
import { downloadWithFallback, type DownloadProvider } from './fallback.js';
import { downloadWithYtDlp } from '../sources/yt-dlp.js';

export type DownloadStrategy = 'auto' | 'yt-dlp' | 'jiji' | 'browser' | 'douyin-api';

export const DOWNLOAD_STRATEGIES = new Set<DownloadStrategy>(['auto', 'yt-dlp', 'jiji', 'browser', 'douyin-api']);

export interface DownloaderAuthOptions {
  cookiesFile?: string;
  cookiesFromBrowser?: string;
  browserStoragePath?: string;
}

export function createDownloadProviders(
  strategy: DownloadStrategy = 'auto',
  authOptions: DownloaderAuthOptions = {},
): DownloadProvider[] {
  const providers: DownloadProvider[] = [];
  if (strategy === 'auto' || strategy === 'yt-dlp') {
    providers.push({
      name: 'yt-dlp',
      download: (url, outputDir) => downloadWithYtDlp(url, outputDir, undefined, authOptions),
    });
  }
  if (strategy === 'auto' || strategy === 'jiji') {
    providers.push({
      name: 'jiji',
      download: (url, outputDir) => downloadWithJiji(url, outputDir, { cookiesFile: authOptions.cookiesFile }),
    });
  }
  if (strategy === 'browser' || (strategy === 'auto' && shouldUseBrowserFallback(authOptions))) {
    providers.push({
      name: 'browser',
      download: (url, outputDir) =>
        downloadWithBrowser(url, outputDir, {
          cookiesFile: authOptions.cookiesFile,
          storageStatePath: authOptions.browserStoragePath,
        }),
    });
  }
  if (strategy === 'auto' || strategy === 'douyin-api') {
    providers.push({
      name: 'douyin-api',
      download: (url, outputDir) => downloadWithDouyinApi(url, outputDir),
    });
  }
  return providers;
}

export { downloadWithFallback };

function shouldUseBrowserFallback(authOptions: DownloaderAuthOptions): boolean {
  return Boolean(
    authOptions.cookiesFile || authOptions.browserStoragePath || process.env.OPENVIDEO_BROWSER_FALLBACK === '1',
  );
}
