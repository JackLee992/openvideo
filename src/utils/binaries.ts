import { existsSync } from 'node:fs';
import path from 'node:path';

export function resolveCommand(command: string): string {
  const override = commandOverride(command);
  if (override) return override;
  const localCommand = path.join(process.cwd(), 'node_modules', '.bin', command);
  return existsSync(localCommand) ? localCommand : command;
}

function commandOverride(command: string): string | undefined {
  if (command === 'hyperframes') return process.env.OPENVIDEO_HYPERFRAMES_COMMAND;
  return undefined;
}
