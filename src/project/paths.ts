import path from 'node:path';

export interface RunLayout {
  runId: string;
  runDir: string;
  inputDir: string;
  framesDir: string;
  analysisDir: string;
}

export function slugify(input: string): string {
  const base = path.basename(input).replace(/\.[^.]+$/, '');
  const slug = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'video';
}

export function createRunId(input: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `${stamp}-${slugify(input)}`;
}

export function createRunLayout(outDir: string, runId: string): RunLayout {
  const runDir = path.resolve(outDir, runId);
  return {
    runId,
    runDir,
    inputDir: path.join(runDir, 'input'),
    framesDir: path.join(runDir, 'frames'),
    analysisDir: path.join(runDir, 'analysis'),
  };
}
