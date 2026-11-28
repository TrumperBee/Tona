import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.e2e"));

import { seedQaWorld } from "../../src/lib/test-harness/seed-world";

seedQaWorld()
  .then((r) => {
    console.log("QA world seeded.");
    console.table(
      r.users.map((u) => ({ role: u.role, email: u.email, password: u.password, uid: u.uid })),
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
