import { describe, expect, it } from 'vitest';
import { createDownloadProviders, DOWNLOAD_STRATEGIES } from '../src/downloaders/providers.js';

describe('download provider strategies', () => {
  it('includes douyin-api as the last auto fallback provider', () => {
    expect(createDownloadProviders('auto').map((provider) => provider.name)).toEqual(['yt-dlp', 'jiji', 'douyin-api']);
  });

  it('allows selecting douyin-api explicitly', () => {
    expect(DOWNLOAD_STRATEGIES.has('douyin-api')).toBe(true);
    expect(createDownloadProviders('douyin-api').map((provider) => provider.name)).toEqual(['douyin-api']);
  });
});
