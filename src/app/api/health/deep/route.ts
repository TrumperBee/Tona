// GCC - deep health check (Super Admin only).
// Never returns secrets. /api/health remains the fast public liveness probe.
import { NextResponse } from "next/server";

import { AuthenticationError, AuthorizationError, requireSuperAdmin } from "@/lib/auth/guards";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/http/respond";
import { logger } from "@/lib/observability/logger";
import { getPlatformSettings } from "@/lib/platform/settings";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; message: string };

export async function GET(): Promise<NextResponse> {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch (e) {
    if (e instanceof AuthenticationError) return jsonError("Sign in as the Super Admin.", 401);
    if (e instanceof AuthorizationError) return jsonError("Super Admin access is required.", 403);
    throw e;
  }

  const rate = await checkRateLimit(
    rateLimitPolicy("super-admin:health-deep", user.userId, 20, 60),
  );
  if (!rate.allowed)
    return jsonError("Too many requests.", 429, { "Retry-After": String(rate.retryAfterSeconds) });

  const checks: Check[] = [];
  const required = [
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_ADMIN_CLIENT_EMAIL",
    "FIREBASE_ADMIN_PRIVATE_KEY",
    "SUPER_ADMIN_EMAIL",
    "SUPER_ADMIN_UID",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  ];
  const missing = required.filter((k) => !process.env[k]?.trim());
  checks.push({
    name: "env.required",
    ok: missing.length === 0,
    message: missing.length ? `Missing: ${missing.join(", ")}` : "Required env vars present.",
  });

  const cloudinary = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
  const resend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  const resendWebhook = Boolean(process.env.RESEND_WEBHOOK_SECRET);
  const turnstile = Boolean(
    process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
  const appCheck = Boolean(process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY);
  checks.push({
    name: "config.cloudinary",
    ok: cloudinary,
    message: cloudinary
      ? "Cloudinary credentials configured."
      : "Cloudinary credentials missing; avatar/logo/uploads will fail.",
  });
  checks.push({
    name: "config.resend",
    ok: resend,
    message: resend
      ? "Resend API/from configured."
      : "Resend not configured; email delivery disabled (in-app still works).",
  });
  checks.push({
    name: "config.resend_webhook",
    ok: resendWebhook,
    message: resendWebhook
      ? "Resend webhook secret configured."
      : "RESEND_WEBHOOK_SECRET missing; bounce/complaint webhooks cannot be verified.",
  });
  checks.push({
    name: "config.turnstile",
    ok: turnstile,
    message: turnstile
      ? "Turnstile keys configured."
      : "Turnstile keys missing; production should fail closed for protected forms.",
  });
  checks.push({
    name: "config.app_check",
    ok: appCheck,
    message: appCheck
      ? "App Check site key configured."
      : "App Check site key missing; production should fail closed.",
  });

  try {
    await getFirebaseAdminFirestore().collection("platformSettings").limit(1).get();
    checks.push({ name: "firestore", ok: true, message: "Firestore reachable." });
  } catch (error) {
    checks.push({ name: "firestore", ok: false, message: "Firestore check failed." });
    logger.error("health.deep.firestore_failed", error, { route: "/api/health/deep" });
  }

  try {
    await getFirebaseAdminAuth().listUsers(1);
    checks.push({ name: "auth", ok: true, message: "Firebase Auth Admin reachable." });
  } catch (error) {
    checks.push({ name: "auth", ok: false, message: "Firebase Auth check failed." });
    logger.error("health.deep.auth_failed", error, { route: "/api/health/deep" });
  }

  try {
    const settings = await getPlatformSettings();
    checks.push({
      name: "platform.maintenance_mode",
      ok: true,
      message: settings.maintenanceMode
        ? `ON: ${settings.maintenanceMessage || "default message"}`
        : "Off.",
    });
  } catch (error) {
    checks.push({
      name: "platform.maintenance_mode",
      ok: false,
      message: "Unable to read platform settings.",
    });
    logger.error("health.deep.settings_failed", error, { route: "/api/health/deep" });
  }

  try {
    const usageSnap = await getFirebaseAdminFirestore()
      .collection("emailUsage")
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();
    const usage = usageSnap.docs[0]?.data() as
      { dailyCount?: number; monthlyCount?: number } | undefined;
    checks.push({
      name: "email.quota_state",
      ok: true,
      message: usage
        ? `Latest usage doc present (daily=${usage.dailyCount ?? "?"}, monthly=${usage.monthlyCount ?? "?"}).`
        : "No email usage document found yet.",
    });
  } catch {
    checks.push({
      name: "email.quota_state",
      ok: true,
      message: "Unable to read email usage; non-fatal.",
    });
  }

  const ok = checks.every((c) => c.ok);
  return NextResponse.json({
    status: ok ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    checks,
  });
}
