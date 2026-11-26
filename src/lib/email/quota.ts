// GCC - daily and monthly email quota.
//
// The counters live in `emailUsage/{yyyymmdd}` and `emailUsage/month-{yyyymm}`.
// A transaction reserves capacity BEFORE the network call so two concurrent
// requests cannot both spend the last unit. Sending never happens inside the
// transaction.
import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { getEmailConfig } from "@/lib/email/config";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { EmailUsageDocument } from "@/types/domain";

export const NORMAL_QUOTA_FRACTION = 0.8;

/** UTC `YYYYMMDD`, the documented daily document id. */
export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10).replace(/-/g, "");
}

/** UTC `month-YYYYMM`, separate from the eight-digit daily ids. */
export function utcMonthKey(now: Date = new Date()): string {
  return `month-${now.toISOString().slice(0, 7).replace(/-/g, "")}`;
}

/** Normal (important/optional) mail stops at this many sends per day. */
export function dailyNormalCap(dailyLimit: number): number {
  return Math.max(0, Math.floor(dailyLimit * NORMAL_QUOTA_FRACTION));
}

/** The monthly count at which the Super Admin warning appears. */
export function monthlyWarnThreshold(monthlyLimit: number): number {
  return Math.ceil(monthlyLimit * NORMAL_QUOTA_FRACTION);
}

export interface QuotaReservation {
  readonly allowed: number;
  readonly skipped: number;
  readonly critical: boolean;
  readonly dailyLimit: number;
  readonly normalCap: number;
}

export interface EmailUsageSnapshot {
  readonly dayKey: string;
  readonly monthKey: string;
  readonly daily: EmailUsageDocument;
  readonly monthly: EmailUsageDocument;
  readonly dailyLimit: number;
  readonly monthlyLimit: number;
  readonly normalCap: number;
  readonly monthlyWarnAt: number;
}

function readUsage(data: Partial<EmailUsageDocument> | undefined): EmailUsageDocument {
  return {
    sent: typeof data?.sent === "number" ? data.sent : 0,
    skipped: typeof data?.skipped === "number" ? data.skipped : 0,
    failed: typeof data?.failed === "number" ? data.failed : 0,
    updatedAt: data?.updatedAt ?? (Timestamp.now() as unknown as EmailUsageDocument["updatedAt"]),
  };
}

/**
 * Reserves up to `count` sends. Normal mail may use the first 80% of the daily
 * limit; critical mail may use the remainder. A partial reservation is normal:
 * the caller sends what was allowed and records the rest as skipped.
 */
export async function reserveEmailQuota(input: {
  readonly count: number;
  readonly critical: boolean;
  readonly now?: Date;
}): Promise<QuotaReservation> {
  const config = getEmailConfig();
  const count = Math.max(0, Math.trunc(input.count));
  const dailyKey = utcDayKey(input.now);
  const monthKey = utcMonthKey(input.now);
  const dailyReference = getFirebaseAdminFirestore().doc(paths.emailUsageDay(dailyKey));
  const monthlyReference = getFirebaseAdminFirestore().doc(paths.emailUsageDay(monthKey));
  const normalCap = dailyNormalCap(config.dailyLimit);

  if (count === 0) {
    return {
      allowed: 0,
      skipped: 0,
      critical: input.critical,
      dailyLimit: config.dailyLimit,
      normalCap,
    };
  }

  return getFirebaseAdminFirestore().runTransaction<QuotaReservation>(async (transaction) => {
    const [dailySnapshot, monthlySnapshot] = await Promise.all([
      transaction.get(dailyReference),
      transaction.get(monthlyReference),
    ]);
    const sent = readUsage(dailySnapshot.data() as Partial<EmailUsageDocument> | undefined).sent;
    const monthlySent = readUsage(
      monthlySnapshot.data() as Partial<EmailUsageDocument> | undefined,
    ).sent;
    const cap = input.critical ? config.dailyLimit : normalCap;
    // The monthly reference is a hard cap as well as the Super Admin warning
    // point, so a burst across days cannot exceed the Resend plan.
    const allowed = Math.max(0, Math.min(count, cap - sent, config.monthlyLimit - monthlySent));
    const skipped = count - allowed;
    const now = Timestamp.now();

    transaction.set(
      dailyReference,
      {
        sent: FieldValue.increment(allowed),
        skipped: FieldValue.increment(skipped),
        updatedAt: now,
      },
      { merge: true },
    );
    transaction.set(
      monthlyReference,
      {
        sent: FieldValue.increment(allowed),
        skipped: FieldValue.increment(skipped),
        updatedAt: now,
      },
      { merge: true },
    );

    return {
      allowed,
      skipped,
      critical: input.critical,
      dailyLimit: config.dailyLimit,
      normalCap,
    };
  });
}

/** Removes reserved sends that failed and records the failure count. */
export async function releaseFailedQuota(count: number, now: Date = new Date()): Promise<void> {
  const amount = Math.max(0, Math.trunc(count));
  if (amount === 0) return;

  const dailyReference = getFirebaseAdminFirestore().doc(paths.emailUsageDay(utcDayKey(now)));
  const monthlyReference = getFirebaseAdminFirestore().doc(paths.emailUsageDay(utcMonthKey(now)));

  await getFirebaseAdminFirestore().runTransaction(async (transaction) => {
    const [dailySnapshot, monthlySnapshot] = await Promise.all([
      transaction.get(dailyReference),
      transaction.get(monthlyReference),
    ]);
    const daily = readUsage(dailySnapshot.data() as Partial<EmailUsageDocument> | undefined);
    const monthly = readUsage(monthlySnapshot.data() as Partial<EmailUsageDocument> | undefined);
    const stamp = Timestamp.now();

    transaction.set(
      dailyReference,
      {
        sent: Math.max(0, daily.sent - amount),
        failed: daily.failed + amount,
        updatedAt: stamp,
      },
      { merge: true },
    );
    transaction.set(
      monthlyReference,
      {
        sent: Math.max(0, monthly.sent - amount),
        failed: monthly.failed + amount,
        updatedAt: stamp,
      },
      { merge: true },
    );
  });
}

/** Reads both counters for the Super Admin card. */
export async function readEmailUsage(now: Date = new Date()): Promise<EmailUsageSnapshot> {
  const config = getEmailConfig();
  const dayKey = utcDayKey(now);
  const monthKey = utcMonthKey(now);
  const firestore = getFirebaseAdminFirestore();
  const [dailySnapshot, monthlySnapshot] = await Promise.all([
    firestore.doc(paths.emailUsageDay(dayKey)).get(),
    firestore.doc(paths.emailUsageDay(monthKey)).get(),
  ]);

  return {
    dayKey,
    monthKey,
    daily: readUsage(dailySnapshot.data() as Partial<EmailUsageDocument> | undefined),
    monthly: readUsage(monthlySnapshot.data() as Partial<EmailUsageDocument> | undefined),
    dailyLimit: config.dailyLimit,
    monthlyLimit: config.monthlyLimit,
    normalCap: dailyNormalCap(config.dailyLimit),
    monthlyWarnAt: monthlyWarnThreshold(config.monthlyLimit),
  };
}
