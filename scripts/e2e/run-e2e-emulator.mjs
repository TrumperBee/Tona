import { spawn } from "node:child_process";
import process from "node:process";

const extra = process.argv
  .slice(2)
  .map((a) => `"${a.replace(/"/g, '\\"')}"`)
  .join(" ");
const inner = `node scripts/e2e/run-e2e.mjs${extra ? ` ${extra}` : ""}`.trim();
const cmd = `npx firebase emulators:exec --only firestore,auth --project demo-gcc "${inner.replace(/"/g, '\\"')}"`;

const child = spawn(cmd, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
