#!/usr/bin/env node

export interface CliIO {
  writeOut: (line: string) => void;
  writeErr: (line: string) => void;
}

const DEFAULT_IO: CliIO = {
  writeOut: (line) => console.log(line),
  writeErr: (line) => console.error(line),
};

const HELP_TEXT = `Usage: openvideo <command> [options]

Commands:
  doctor                         Check local dependencies
  analyze <file-or-url>           Analyze a local video file or direct video URL
  brief <run-dir>                 Generate a HyperFrames-ready brief from a run
  render <run-dir>                Render an original video from a run brief

Examples:
  openvideo doctor
  openvideo analyze ./reference.mp4
  openvideo brief runs/2026-06-23-demo --goal "做一个 AI 工具教程类抖音短视频"
  openvideo render runs/2026-06-23-demo --prompt "介绍一个能自动生成设计稿的工具"
`;

export function printHelp(io: CliIO = DEFAULT_IO): void {
  io.writeOut(HELP_TEXT);
}

export async function runCli(argv: string[], io: CliIO = DEFAULT_IO): Promise<number> {
  const [command] = argv;
  if (!command || command === '--help' || command === '-h') {
    printHelp(io);
    return 0;
  }

  if (command === 'doctor') {
    const { runDoctor } = await import('./commands/doctor.js');
    return runDoctor(io);
  }

  if (command === 'analyze' || command === 'brief' || command === 'render') {
    io.writeErr(`The ${command} command is planned but not implemented in Phase 1.`);
    return 2;
  }

  io.writeErr(`Unknown command: ${command}`);
  io.writeErr('Run `openvideo --help` for usage.');
  return 2;
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href;
if (isDirectRun) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
