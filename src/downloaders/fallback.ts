export type DownloadProviderName = 'yt-dlp' | 'jiji' | 'douyin-api';

export interface DownloadProvider {
  name: DownloadProviderName;
  download: (url: string, outputDir: string) => Promise<string>;
}

export type DownloadAttempt =
  | { provider: DownloadProviderName; ok: true; path: string }
  | { provider: DownloadProviderName; ok: false; error: string };

export interface DownloadFallbackResult {
  provider: DownloadProviderName;
  path: string;
  attempts: DownloadAttempt[];
}

export async function downloadWithFallback(
  url: string,
  outputDir: string,
  providers: DownloadProvider[],
): Promise<DownloadFallbackResult> {
  const attempts: DownloadAttempt[] = [];
  for (const provider of providers) {
    try {
      const path = await provider.download(url, outputDir);
      attempts.push({ provider: provider.name, ok: true, path });
      return { provider: provider.name, path, attempts };
    } catch (error) {
      attempts.push({ provider: provider.name, ok: false, error: errorMessage(error) });
    }
  }

  const details = attempts.map((attempt) => `${attempt.provider}: ${attempt.ok ? attempt.path : attempt.error}`);
  throw new Error(`All download providers failed: ${details.join('; ')}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
