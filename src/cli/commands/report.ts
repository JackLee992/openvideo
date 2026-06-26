import type { CliIO } from '../index.js';
import { createAnalysisReport, type AnalysisReportInput, type AnalysisReportResult } from '../../report/report.js';

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

export interface ReportCommandDeps {
  createReport?: (input: AnalysisReportInput) => Promise<AnalysisReportResult>;
}

export async function runReport(
  argv: string[],
  io: CliIO = DEFAULT_IO,
  deps: ReportCommandDeps = {},
): Promise<number> {
  const parsed = parseReportArgs(argv);
  if (!parsed.ok) {
    io.writeErr(parsed.error);
    io.writeErr(reportUsage());
    return 2;
  }

  try {
    const createReport = deps.createReport ?? createAnalysisReport;
    const result = await createReport(parsed.value);
    io.writeOut(`Created OpenVideo workbench: ${result.indexPath}`);
    return 0;
  } catch (error) {
    io.writeErr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

type ParseResult = { ok: true; value: AnalysisReportInput } | { ok: false; error: string };

function parseReportArgs(argv: string[]): ParseResult {
  const [runDir, ...rest] = argv;
  if (!runDir) return { ok: false, error: 'Missing run directory.' };
  const value: AnalysisReportInput = { runDir };

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--out') {
      const outDir = rest[++i];
      if (!outDir) return { ok: false, error: 'Missing value for --out.' };
      value.outDir = outDir;
      continue;
    }
    return { ok: false, error: `Unknown report option: ${arg}` };
  }

  return { ok: true, value };
}

function reportUsage(): string {
  return 'Usage: openvideo report <run-dir> [--out report-dir]';
}
