// GCC - Vitest configuration for emulator-backed integration tests.
//
// Run with `npm run test:integration`, which starts the Firebase Emulator Suite
// (Firestore + Auth) and then executes these tests. They are deliberately NOT
// part of `npm test`, which must stay fast and emulator-free.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // One emulator instance is shared; parallel files would clear each other's data.
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
