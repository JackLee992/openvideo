import type { CliIO } from '../index.js';
import { checkCommand, type CommandStatus } from '../../utils/exec.js';

export type DependencyChecker = (command: string, args?: string[]) => Promise<CommandStatus>;

export interface DoctorReport {
  required: {
    node: CommandStatus;
    ffmpeg: CommandStatus;
    ffprobe: CommandStatus;
  };
  optional: {
    hyperframes: CommandStatus;
    'yt-dlp': CommandStatus;
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
  const [ffmpeg, ffprobe, hyperframes, ytdlp] = await Promise.all([
    checker('ffmpeg', ['-version']),
    checker('ffprobe', ['-version']),
    checker('hyperframes', ['--version']),
    checker('yt-dlp', ['--version']),
  ]);
  const required = {
    node: nodeStatus(),
    ffmpeg,
    ffprobe,
  };
  const optional = {
    hyperframes,
    'yt-dlp': ytdlp,
  };
  return {
    required,
    optional,
    readyForAnalyze: required.node.found && required.ffmpeg.found && required.ffprobe.found,
    readyForRender: hyperframes.found,
  };
}

function lineFor(label: string, status: CommandStatus, required: boolean): string {
  const state = status.found ? 'ok' : 'missing';
  const suffix = status.version ? ` - ${status.version}` : '';
  const kind = required ? 'required' : 'optional';
  return `- ${label}: ${state} (${kind})${suffix}`;
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
    '',
    `Analyze ready: ${report.readyForAnalyze ? 'yes' : 'no'}`,
    `Render ready: ${report.readyForRender ? 'yes' : 'no'}`,
  ];

  const guidance: string[] = [];
  if (!report.required.ffmpeg.found || !report.required.ffprobe.found) {
    guidance.push('Install ffmpeg to enable metadata probing and frame extraction.');
  }
  if (!report.optional.hyperframes.found) {
    guidance.push('Install HyperFrames to enable `openvideo render`; analysis and brief generation can still run.');
  }
  if (!report.optional['yt-dlp'].found) {
    guidance.push('yt-dlp is optional and only needed for supported public link adapters.');
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
