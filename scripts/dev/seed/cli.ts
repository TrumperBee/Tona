// GCC - seeder command-line interface.
//
// Parsing and prompting live here; every decision that touches Firebase lives
// in service.ts. No flag can bypass the typed project-id confirmation.
import { createInterface } from "node:readline";
import process from "node:process";

import { SeedError } from "./manifest";
import {
  cleanupSeed,
  MAX_TEST_ACCOUNTS,
  seedPlayers,
  showStatus,
  showTournaments,
  type SeedIo,
} from "./service";

const USAGE = `GCC test-player seeder (local only)

Commands:
  npm run dev:seed -- list
  npm run dev:seed -- players --tournament <slug> --fill
  npm run dev:seed -- players --tournament <slug> --count <1-${MAX_TEST_ACCOUNTS}>
  npm run dev:seed -- status
  npm run dev:seed -- cleanup [--tournament <slug>] [--delete-tournament] [--execute]

Writing commands print a plan and require typing the Firebase project id.
cleanup without --execute is a dry run. --delete-tournament also requires
typing the tournament slug. See docs/DEV-TOOLS.md.`;

interface ParsedArguments {
  readonly command: string | undefined;
  readonly tournament: string | undefined;
  readonly count: number | undefined;
  readonly fill: boolean;
  readonly execute: boolean;
  readonly deleteTournament: boolean;
  readonly help: boolean;
}

function parseArguments(argv: readonly string[]): ParsedArguments {
  let command: string | undefined;
  let tournament: string | undefined;
  let count: number | undefined;
  let fill = false;
  let execute = false;
  let deleteTournament = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument) {
      continue;
    }

    if (!argument.startsWith("--")) {
      if (command) {
        throw new SeedError(`Unexpected argument "${argument}".`);
      }

      command = argument;
      continue;
    }

    switch (argument) {
      case "--tournament": {
        const value = argv[index + 1];

        if (!value || value.startsWith("--")) {
          throw new SeedError("--tournament needs a slug.");
        }

        tournament = value;
        index += 1;
        break;
      }
      case "--count": {
        const value = argv[index + 1];
        const parsed = Number(value);

        if (!value || !Number.isInteger(parsed)) {
          throw new SeedError("--count needs a whole number.");
        }

        count = parsed;
        index += 1;
        break;
      }
      case "--fill":
        fill = true;
        break;
      case "--execute":
        execute = true;
        break;
      case "--delete-tournament":
        deleteTournament = true;
        break;
      case "--help":
      case "-h":
        help = true;
        break;
      default:
        throw new SeedError(`Unknown flag "${argument}".\n\n${USAGE}`);
    }
  }

  return {
    command,
    tournament,
    count,
    fill,
    execute,
    deleteTournament,
    help,
  };
}

function ask(question: string): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (answer: string) => {
      if (!settled) {
        settled = true;
        readline.off("close", onClose);
        readline.close();
        resolve(answer);
      }
    };
    const onClose = () => finish("");

    readline.once("close", onClose);
    readline.question(question, (answer) => {
      readline.off("close", onClose);
      finish(answer.trim());
    });
  });
}

const io: SeedIo = {
  info: (message) => {
    console.log(message);
  },
  warn: (message) => {
    console.warn(message);
  },
  confirm: async (question) => ask(question),
};

export async function runCli(argv: readonly string[]): Promise<void> {
  try {
    const arguments_ = parseArguments(argv);

    if (arguments_.help) {
      console.log(USAGE);
      return;
    }

    switch (arguments_.command) {
      case "list":
        await showTournaments(io);
        return;
      case "status":
        await showStatus(io);
        return;
      case "players": {
        if (!arguments_.tournament) {
          throw new SeedError(`players requires --tournament <slug>.\n\n${USAGE}`);
        }

        await seedPlayers(
          {
            slug: arguments_.tournament,
            fill: arguments_.fill,
            count: arguments_.count,
          },
          io,
        );
        return;
      }
      case "cleanup":
        if (arguments_.deleteTournament && !arguments_.tournament) {
          throw new SeedError("--delete-tournament requires --tournament <slug>.");
        }

        if (arguments_.fill || arguments_.count !== undefined) {
          throw new SeedError("cleanup does not accept --fill or --count.");
        }

        await cleanupSeed(
          {
            slug: arguments_.tournament,
            deleteTournament: arguments_.deleteTournament,
            execute: arguments_.execute,
          },
          io,
        );
        return;
      case undefined:
        console.log(USAGE);
        return;
      default:
        throw new SeedError(`Unknown command "${arguments_.command}".\n\n${USAGE}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${message}`);
    process.exitCode = 1;
  }
}
