import type { CliIO } from '../index.js';
import { createGenerationBrief, type GenerationBriefInput, type GenerationBriefResult } from '../../brief/brief.js';

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

export interface BriefCommandDeps {
  createBrief?: (input: GenerationBriefInput) => Promise<GenerationBriefResult>;
}

export async function runBrief(
  argv: string[],
  io: CliIO = DEFAULT_IO,
  deps: BriefCommandDeps = {},
): Promise<number> {
  const parsed = parseBriefArgs(argv);
  if (!parsed.ok) {
    io.writeErr(parsed.error);
    io.writeErr(briefUsage());
    return 2;
  }

  try {
    const createBrief = deps.createBrief ?? createGenerationBrief;
    const result = await createBrief(parsed.value);
    io.writeOut(`Wrote generation brief: ${result.outputPath}`);
    return 0;
  } catch (error) {
    io.writeErr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

type ParseResult = { ok: true; value: GenerationBriefInput } | { ok: false; error: string };

function parseBriefArgs(argv: string[]): ParseResult {
  const [runDir, ...rest] = argv;
  if (!runDir) return { ok: false, error: 'Missing run directory.' };
  const value: GenerationBriefInput = { runDir, goal: '' };

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--goal') {
      const goal = rest[++i];
      if (!goal) return { ok: false, error: 'Missing value for --goal.' };
      value.goal = goal;
      continue;
    }
    if (arg === '--out') {
      const outputPath = rest[++i];
      if (!outputPath) return { ok: false, error: 'Missing value for --out.' };
      value.outputPath = outputPath;
      continue;
    }
    return { ok: false, error: `Unknown brief option: ${arg}` };
  }

  if (!value.goal.trim()) return { ok: false, error: 'Missing --goal.' };
  return { ok: true, value };
}

function briefUsage(): string {
  return 'Usage: openvideo brief <run-dir> --goal <new-video-goal> [--out generation-brief.md]';
}
