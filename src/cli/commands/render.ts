import type { CliIO } from '../index.js';
import {
  prepareHyperFramesRender,
  type RenderPrepareInput,
  type RenderPrepareResult,
} from '../../render/render.js';

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

export interface RenderCommandDeps {
  prepareRender?: (input: RenderPrepareInput) => Promise<RenderPrepareResult>;
}

export async function runRender(
  argv: string[],
  io: CliIO = DEFAULT_IO,
  deps: RenderCommandDeps = {},
): Promise<number> {
  const parsed = parseRenderArgs(argv);
  if (!parsed.ok) {
    io.writeErr(parsed.error);
    io.writeErr(renderUsage());
    return 2;
  }

  try {
    const prepareRender = deps.prepareRender ?? prepareHyperFramesRender;
    const result = await prepareRender(parsed.value);
    io.writeOut(`Prepared HyperFrames project: ${result.projectDir}`);
    io.writeOut(`Composition: ${result.indexPath}`);
    io.writeOut(`Next steps: cd ${result.projectDir} && npx hyperframes lint && npx hyperframes validate && npx hyperframes preview`);
    return 0;
  } catch (error) {
    io.writeErr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

type ParseResult = { ok: true; value: RenderPrepareInput } | { ok: false; error: string };

function parseRenderArgs(argv: string[]): ParseResult {
  const [runDir, ...rest] = argv;
  if (!runDir) return { ok: false, error: 'Missing run directory.' };
  const value: RenderPrepareInput = { runDir, prompt: '' };

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--prompt') {
      const prompt = rest[++i];
      if (!prompt) return { ok: false, error: 'Missing value for --prompt.' };
      value.prompt = prompt;
      continue;
    }
    if (arg === '--out') {
      const outDir = rest[++i];
      if (!outDir) return { ok: false, error: 'Missing value for --out.' };
      value.outDir = outDir;
      continue;
    }
    return { ok: false, error: `Unknown render option: ${arg}` };
  }

  if (!value.prompt.trim()) return { ok: false, error: 'Missing --prompt.' };
  return { ok: true, value };
}

function renderUsage(): string {
  return 'Usage: openvideo render <run-dir> --prompt <new-video-prompt> [--out renders]';
}
