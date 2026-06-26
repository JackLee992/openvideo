import { generateReport, type ReportInput, type ReportResult } from '../../report/report.js';
import type { CliIO } from '../index.js';

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

export interface ReportCommandDeps {
  report?: (input: ReportInput) => Promise<ReportResult>;
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
    const report = deps.report ?? generateReport;
    const result = await report(parsed.value);
    io.writeOut(`Wrote report: ${result.reportPath}`);
    io.writeOut(`Wrote transcript: ${result.transcriptReadablePath}`);
    return 0;
  } catch (error) {
    io.writeErr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

type ParseResult = { ok: true; value: ReportInput } | { ok: false; error: string };

function parseReportArgs(argv: string[]): ParseResult {
  const [runDir, ...rest] = argv;
  if (!runDir) return { ok: false, error: 'Missing run directory.' };
  const value: ReportInput = { runDir };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--out') {
      const outPath = rest[++i];
      if (!outPath) return { ok: false, error: 'Missing value for --out.' };
      value.outPath = outPath;
      continue;
    }
    return { ok: false, error: `Unknown report option: ${arg}` };
  }
  return { ok: true, value };
}

function reportUsage(): string {
  return 'Usage: openvideo report <run-dir> [--out analysis/report.md]';
}
