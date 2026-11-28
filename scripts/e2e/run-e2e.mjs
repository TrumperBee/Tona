import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();
const envFile = path.join(root, ".env.e2e");

function parseEnvFile(filePath) {
  const out = {};
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
    out[key] = value;
  }
  return out;
}

const fileEnv = parseEnvFile(envFile);
const env = { ...process.env, ...fileEnv };

const FORBIDDEN_PROJECTS = new Set(["tona-d6f56", "gcc-prod", "production", "prod"]);
const projectId = env.FIREBASE_ADMIN_PROJECT_ID || "";
const publicProjectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
if (!projectId.startsWith("demo-")) {
  console.error(`Refusing E2E: FIREBASE_ADMIN_PROJECT_ID must start with demo-. Got ${projectId}`);
  process.exit(1);
}
if (FORBIDDEN_PROJECTS.has(projectId) || FORBIDDEN_PROJECTS.has(publicProjectId)) {
  console.error("Refusing E2E: env points at a real/forbidden Firebase project.");
  process.exit(1);
}
if (!env.FIRESTORE_EMULATOR_HOST || !env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing E2E: emulator hosts must be configured.");
  process.exit(1);
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code ?? signal}`));
    });
  });
}

async function waitForHttp(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

let server;
try {
  console.log("Building production app for E2E...");
  await run("npm", ["run", "build"]);

  console.log("Seeding QA world...");
  await run("npx", ["tsx", "--tsconfig", "scripts/qa/tsconfig.json", "scripts/qa/seed-world.ts"]);

  console.log("Starting production server...");
  server = spawn("npm", ["run", "start", "--", "-p", "3100"], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  await waitForHttp("http://127.0.0.1:3100/api/health", 180000);

  console.log("Running Playwright...");
  await run("npx", ["playwright", "test", ...process.argv.slice(2)]);
  console.log("E2E passed.");
} finally {
  if (server && !server.killed) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore", shell: true });
    } else {
      server.kill("SIGTERM");
    }
  }
}
