// GCC - Vitest configuration for unit tests.
// Firebase Rules tests need the Firestore emulator and use vitest.rules.config.ts
// instead, so they never run during a plain `npm test`.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.git/**", "tests/rules/**"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server modules import `server-only`, which throws outside a React
      // Server Component bundle. Unit tests exercise that logic directly.
      "server-only": fileURLToPath(
        new URL("./tests/integration/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
