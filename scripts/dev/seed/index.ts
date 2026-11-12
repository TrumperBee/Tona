// GCC - local test-player seeder entry point.
//
// Only this file loads `.env.local` (Node's built-in loader, no `dotenv`). The
// CLI and all server modules are imported dynamically afterwards so Firebase
// Admin sees the credentials and emulator hosts at initialisation time.
import { existsSync } from "node:fs";
import process from "node:process";

const envFile = ".env.local";

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const { runCli } = await import("./cli");

await runCli(process.argv.slice(2));
