// GCC — ESLint flat configuration (Next.js core web vitals + TypeScript rules).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The competition engine must stay reproducible: every random draw comes
    // from an explicit, auditable seed rather than the ambient Math.random.
    files: ["src/lib/engine/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message:
            "Use createSeededRandom() from src/lib/engine/random.ts so every draw is reproducible.",
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
