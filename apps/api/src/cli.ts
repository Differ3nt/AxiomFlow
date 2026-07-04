import { readFileSync } from 'fs';

export interface CliArgs {
  /** Problem statement, resolved from --file or positional args. Undefined means "use the built-in default". */
  problem: string | undefined;
  /** Print the raw ReasoningReport as JSON instead of the human-readable report. */
  json: boolean;
  /** Print usage and exit without running the pipeline. */
  help: boolean;
}

export const USAGE = `Usage: npm run solve -- [options] ["problem statement"]

Options:
  -f, --file <path>  Read the problem statement from a text file instead of argv
      --json          Print the raw ReasoningReport as JSON instead of the formatted report
  -h, --help          Show this help text

A problem statement is required: either a positional argument or --file.`;

/** Pure argv parser, kept separate from main.ts so it can be unit tested without booting Nest. */
export function parseCliArgs(argv: string[]): CliArgs {
  const rest: string[] = [];
  let file: string | undefined;
  let json = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      help = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '-f' || arg === '--file') {
      file = argv[++i];
      if (!file) {
        throw new Error(`${arg} requires a path argument`);
      }
    } else {
      rest.push(arg);
    }
  }

  const problem = file ? readFileSync(file, 'utf-8').trim() : rest.join(' ').trim() || undefined;

  return { problem, json, help };
}
