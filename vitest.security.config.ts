// GCC - Vitest configuration for filesystem-based security checks.
//
// These tests only read source files; they need no Firebase emulators and are
// deliberately separate from the fast unit suite and the integration suite.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/security/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.git/**"],
    passWithNoTests: false,
    testTimeout: 30000,
    fileParallelism: false,
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
