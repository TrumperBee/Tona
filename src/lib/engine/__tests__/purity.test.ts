import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ENGINE_FILES = ["index.ts", "pots.ts", "random.ts", "types.ts"] as const;

function source(file: string): string {
  return readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), "utf8");
}

describe("engine purity", () => {
  it("never calls Math.random", () => {
    const forbidden = new RegExp(`${["Math", "random"].join("\\s*\\.\\s*")}\\s*\\(`);

    for (const file of ENGINE_FILES) {
      expect(forbidden.test(source(file)), file).toBe(false);
    }
  });

  it("never imports Firebase, Next.js, Node built-ins or server-only", () => {
    const forbiddenImports = /from\s+["'](firebase|firebase-admin|next|node:|server-only)/;

    for (const file of ENGINE_FILES) {
      expect(forbiddenImports.test(source(file)), file).toBe(false);
    }
  });
});
