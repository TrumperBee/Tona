// GCC - Resend delivery webhook.
//
// POST /api/webhooks/resend
// Resend signs requests with a Svix-style HMAC. A hard bounce or a spam
// complaint suppresses the address permanently and marks the owner's account
// as undeliverable so the dashboard can prompt a fix. The handler always
// answers 200 after a valid signature so Resend stops retrying a processed
// event, and 401 for a bad signature so an unsigned caller learns nothing.
import { NextResponse, type NextRequest } from "next/server";

import { getEmailConfig } from "@/lib/email/config";
import { suppressEmail, type SuppressionReason } from "@/lib/email/suppression";
import { verifySvixSignature } from "@/lib/email/svix";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";

export const runtime = "nodejs";

interface ResendWebhookPayload {
  readonly type?: unknown;
  readonly data?: {
    readonly to?: unknown;
    readonly bounce?: { readonly type?: unknown } | null;
  } | null;
}

function recipientsFrom(value: unknown): readonly string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is string => typeof entry === "string" && entry.trim() !== "",
    );
  }

  return [];
}

function suppressionReason(type: string, payload: ResendWebhookPayload): SuppressionReason | null {
  if (type === "email.complained") {
    return "complained";
  }

  if (type === "email.bounced") {
    const bounceType = payload.data?.bounce?.type;
    // Only a permanent bounce suppresses. A transient bounce may succeed on a
    // later send and must not lock the owner out of email.
    return typeof bounceType === "string" && bounceType.toLowerCase() === "permanent"
      ? "bounced"
      : null;
  }

  return null;
}

async function markOwnerUndeliverable(address: string): Promise<void> {
  try {
    const record = await getFirebaseAdminAuth().getUserByEmail(address);
    await getFirebaseAdminFirestore()
      .doc(paths.user(record.uid))
      .set({ emailDeliverable: false }, { merge: true });
  } catch {
    // The address may not belong to an account, or may already be deleted.
    // The suppression list still protects future sends.
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const secret = getEmailConfig().webhookSecret;

  const valid = verifySvixSignature({
    secret,
    headers: {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    rawBody,
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: ResendWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const type = typeof payload.type === "string" ? payload.type : "";
  const reason = suppressionReason(type, payload);

  if (!reason) {
    return NextResponse.json({ ok: true, handled: false });
  }

  const addresses = recipientsFrom(payload.data?.to);

  await Promise.all(
    addresses.map(async (address) => {
      await suppressEmail(address, reason);
      await markOwnerUndeliverable(address);
    }),
  );

  return NextResponse.json({ ok: true, handled: true, suppressed: addresses.length });
}
