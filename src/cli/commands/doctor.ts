import type { CliIO } from '../index.js';
import { checkCommand, type CommandStatus } from '../../utils/exec.js';

export type DependencyChecker = (command: string, args?: string[]) => Promise<CommandStatus>;

export interface OcrLanguageStatus {
  language: string;
  ready: boolean;
  missing: string[];
  available: string[];
}

export interface DoctorReport {
  required: {
    node: CommandStatus;
    ffmpeg: CommandStatus;
    ffprobe: CommandStatus;
  };
  optional: {
    hyperframes: CommandStatus;
    'yt-dlp': CommandStatus;
    tesseract: CommandStatus;
    ocrLanguages: OcrLanguageStatus;
  };
  readyForAnalyze: boolean;
  readyForRender: boolean;
}

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

function nodeStatus(): CommandStatus {
  return {
    command: 'node',
    found: true,
    version: `node ${process.version}`,
  };
}

export async function createDoctorReport(
  checker: DependencyChecker = (command, args) => checkCommand(command, args),
): Promise<DoctorReport> {
  const [ffmpeg, ffprobe, hyperframes, ytdlp, tesseract] = await Promise.all([
    checker('ffmpeg', ['-version']),
    checker('ffprobe', ['-version']),
    checker('hyperframes', ['--version']),
    checker('yt-dlp', ['--version']),
    checker('tesseract', ['--version']),
  ]);
  const required = {
    node: nodeStatus(),
    ffmpeg,
    ffprobe,
  };
  const ocrLanguages = await checkOcrLanguages(checker, tesseract.found);
  const optional = {
    hyperframes,
    'yt-dlp': ytdlp,
    tesseract,
    ocrLanguages,
  };
  return {
    required,
    optional,
    readyForAnalyze: required.node.found && required.ffmpeg.found && required.ffprobe.found,
    readyForRender: hyperframes.found,
  };
}

async function checkOcrLanguages(checker: DependencyChecker, tesseractFound: boolean): Promise<OcrLanguageStatus> {
  const language = process.env.OPENVIDEO_OCR_LANG ?? 'chi_sim+eng';
  const required = splitTesseractLanguages(language);
  if (!tesseractFound) {
    return { language, ready: false, missing: required, available: [] };
  }

  const status = await checker('tesseract', ['--list-langs']);
  const available = parseTesseractLanguages(status.output ?? status.version ?? '');
  const missing = required.filter((lang) => !available.includes(lang));
  return {
    language,
    ready: missing.length === 0,
    missing,
    available,
  };
}

function splitTesseractLanguages(language: string): string[] {
  return language
    .split('+')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTesseractLanguages(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith('list of available languages'));
}

function lineFor(label: string, status: CommandStatus, required: boolean): string {
  const state = status.found ? 'ok' : 'missing';
  const suffix = status.version ? ` - ${status.version}` : '';
  const kind = required ? 'required' : 'optional';
  return `- ${label}: ${state} (${kind})${suffix}`;
}

function ocrLanguageLine(status: OcrLanguageStatus): string {
  const state = status.ready ? 'ok' : 'missing';
  const suffix = status.ready ? status.language : `missing ${status.missing.join(', ') || status.language}`;
  return `- tesseract languages: ${state} (optional) - ${suffix}`;
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    'OpenVideo Doctor',
    '',
    'Required:',
    lineFor('node', report.required.node, true),
    lineFor('ffmpeg', report.required.ffmpeg, true),
    lineFor('ffprobe', report.required.ffprobe, true),
    '',
    'Optional:',
    lineFor('hyperframes', report.optional.hyperframes, false),
    lineFor('yt-dlp', report.optional['yt-dlp'], false),
    lineFor('tesseract', report.optional.tesseract, false),
    ocrLanguageLine(report.optional.ocrLanguages),
    '',
    `Analyze ready: ${report.readyForAnalyze ? 'yes' : 'no'}`,
    `Render ready: ${report.readyForRender ? 'yes' : 'no'}`,
  ];

  const guidance: string[] = [];
  if (!report.required.ffmpeg.found || !report.required.ffprobe.found) {
    guidance.push('Install ffmpeg to enable metadata probing and frame extraction.');
  }
  if (!report.optional.hyperframes.found) {
    guidance.push('Install HyperFrames to enable `openvideo render` and ASR transcript extraction; core analysis and brief generation can still run.');
  }
  if (!report.optional['yt-dlp'].found) {
    guidance.push('yt-dlp is optional for local files, but required for supported public platform URLs.');
  }
  if (!report.optional.tesseract.found) {
    guidance.push('Install Tesseract OCR, plus Chinese language data when needed, to enable caption text extraction.');
  }
  if (report.optional.tesseract.found && !report.optional.ocrLanguages.ready) {
    guidance.push(
      `Install Tesseract language data for ${report.optional.ocrLanguages.missing.join(', ')}, or set OPENVIDEO_OCR_LANG to an installed language.`,
    );
  }
  if (guidance.length > 0) {
    lines.push('', 'Guidance:', ...guidance.map((item) => `- ${item}`));
  }

  return lines.join('\n');
}

export async function runDoctor(io: CliIO = DEFAULT_IO): Promise<number> {
  const report = await createDoctorReport();
  io.writeOut(formatDoctorReport(report));
  return 0;
}
