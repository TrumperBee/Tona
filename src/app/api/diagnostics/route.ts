// TEMPORARY DIAGNOSTIC ROUTE - remove once the Vercel runtime failure is fixed.
// Deliberately imports nothing from the application so it can still respond
// when firebase-admin fails to load.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function describe(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  return {
    name: error.name,
    message: error.message,
    code: (error as { code?: unknown }).code,
    stack: error.stack?.split("\n").slice(0, 12),
  };
}

export async function GET() {
  const result: Record<string, unknown> = {
    node: process.version,
    platform: process.platform,
    vercel: process.env.VERCEL ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    region: process.env.VERCEL_REGION ?? null,
    cwd: process.cwd(),
  };

  try {
    const app = await import("firebase-admin/app");
    result.adminApp = { ok: true, keys: Object.keys(app).length };
  } catch (error) {
    result.adminApp = { ok: false, error: describe(error) };
  }

  try {
    const auth = await import("firebase-admin/auth");
    result.adminAuth = { ok: true, keys: Object.keys(auth).length };
  } catch (error) {
    result.adminAuth = { ok: false, error: describe(error) };
  }

  try {
    const firestore = await import("firebase-admin/firestore");
    result.adminFirestore = { ok: true, keys: Object.keys(firestore).length };
  } catch (error) {
    result.adminFirestore = { ok: false, error: describe(error) };
  }

  try {
    const env = await import("@/lib/config/env.server");
    const parsed = env.getServerEnv();
    result.serverEnv = {
      ok: true,
      projectId: parsed.FIREBASE_ADMIN_PROJECT_ID,
      clientEmailDomain: parsed.FIREBASE_ADMIN_CLIENT_EMAIL.split("@")[1] ?? null,
      privateKeyLength: parsed.FIREBASE_ADMIN_PRIVATE_KEY.length,
      privateKeyHasBegin: parsed.FIREBASE_ADMIN_PRIVATE_KEY.includes("BEGIN PRIVATE KEY"),
    };
  } catch (error) {
    result.serverEnv = { ok: false, error: describe(error) };
  }

  return NextResponse.json(result);
}
