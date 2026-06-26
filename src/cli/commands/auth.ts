import { authenticateDouyin, type DouyinAuthInput, type DouyinAuthResult } from '../../auth/douyin.js';
import type { CliIO } from '../index.js';

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

export interface AuthCommandDeps {
  authenticate?: (input: DouyinAuthInput) => Promise<DouyinAuthResult>;
}

export async function runAuth(
  argv: string[],
  io: CliIO = DEFAULT_IO,
  deps: AuthCommandDeps = {},
): Promise<number> {
  const parsed = parseAuthArgs(argv);
  if (!parsed.ok) {
    io.writeErr(parsed.error);
    io.writeErr(authUsage());
    return 2;
  }

  try {
    io.writeOut('Opening Douyin login in Chromium. Scan the QR code and keep the browser open until cookies are captured.');
    const authenticate = deps.authenticate ?? authenticateDouyin;
    const result = await authenticate(parsed.value);
    io.writeOut(`Wrote cookies: ${result.cookiesPath}`);
    if (result.storagePath) {
      io.writeOut(`Wrote browser storage: ${result.storagePath}`);
    }
    io.writeOut(`Captured ${result.cookieCount} cookies (${result.detectedCookies.join(', ')})`);
    return 0;
  } catch (error) {
    io.writeErr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

type ParseResult = { ok: true; value: DouyinAuthInput } | { ok: false; error: string };

function parseAuthArgs(argv: string[]): ParseResult {
  const [provider, ...rest] = argv;
  if (!provider) return { ok: false, error: 'Missing auth provider.' };
  if (provider !== 'douyin') return { ok: false, error: `Unknown auth provider: ${provider}` };

  const value: DouyinAuthInput = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--out') {
      const outPath = rest[++i];
      if (!outPath) return { ok: false, error: 'Missing value for --out.' };
      value.outPath = outPath;
      continue;
    }
    if (arg === '--storage') {
      const storagePath = rest[++i];
      if (!storagePath) return { ok: false, error: 'Missing value for --storage.' };
      value.storagePath = storagePath;
      continue;
    }
    if (arg === '--url') {
      const url = rest[++i];
      if (!url) return { ok: false, error: 'Missing value for --url.' };
      value.url = url;
      continue;
    }
    if (arg === '--timeout') {
      const timeout = Number(rest[++i]);
      if (!Number.isFinite(timeout) || timeout <= 0) return { ok: false, error: 'Invalid value for --timeout.' };
      value.timeoutSec = timeout;
      continue;
    }
    if (arg === '--headless') {
      value.headless = true;
      continue;
    }
    return { ok: false, error: `Unknown auth option: ${arg}` };
  }

  return { ok: true, value };
}

function authUsage(): string {
  return [
    'Usage: openvideo auth douyin [--out .openvideo/cookies/douyin-cookies.txt] [--storage .openvideo/cookies/douyin-storage.json] [--timeout 300] [--url https://www.douyin.com/]',
    'This opens a local Chromium browser for QR-code login and exports cookies for `openvideo download/analyze --cookies`.',
  ].join('\n');
}
