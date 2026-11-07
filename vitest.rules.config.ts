// GCC - Vitest configuration for Firestore Security Rules tests.
// Run with `npm run test:rules`, which starts the Firebase Emulator Suite.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    // Rules tests share one emulator instance; running files in parallel would
    // make clearFirestore() race between files.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
