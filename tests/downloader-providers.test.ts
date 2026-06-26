import { describe, expect, it } from 'vitest';
import { createDownloadProviders, DOWNLOAD_STRATEGIES } from '../src/downloaders/providers.js';

describe('download provider strategies', () => {
  it('includes douyin-api as the last auto fallback provider', () => {
    expect(createDownloadProviders('auto').map((provider) => provider.name)).toEqual(['yt-dlp', 'jiji', 'douyin-api']);
  });

  it('adds the browser fallback to auto only when browser auth state is provided', () => {
    expect(createDownloadProviders('auto', { cookiesFile: '/tmp/douyin-cookies.txt' }).map((provider) => provider.name)).toEqual([
      'yt-dlp',
      'jiji',
      'browser',
      'douyin-api',
    ]);
  });

  it('allows selecting douyin-api explicitly', () => {
    expect(DOWNLOAD_STRATEGIES.has('douyin-api')).toBe(true);
    expect(createDownloadProviders('douyin-api').map((provider) => provider.name)).toEqual(['douyin-api']);
  });

  it('allows selecting browser explicitly', () => {
    expect(DOWNLOAD_STRATEGIES.has('browser')).toBe(true);
    expect(createDownloadProviders('browser').map((provider) => provider.name)).toEqual(['browser']);
  });
});
