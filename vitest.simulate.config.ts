// GCC - Vitest configuration for `npm run simulate`.
//
// The simulator needs the Auth and Firestore emulators, exactly like the
// integration suite, but only runs the one full-tournament case and prints a
// readable summary instead of the whole emulator test suite.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/simulate.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    testTimeout: 240_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    // The summary is written with console.log; the verbose reporter prints it
    // even when the single test passes.
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/integration/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
