// GCC - Super Admin transfers tournament ownership.
//
// POST /api/super-admin/tournaments/[id]/transfer
// The new owner must hold the organiser role (verified against the Firebase
// custom claim, never the client). The owner snapshots on the tournament are
// re-written so public surfaces never need a join. Both organisers are
// notified.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { transferTournamentOwnership } from "@/lib/super-admin/tournaments";
import { reasonSchema } from "@/lib/validation/super-admin";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";

export const runtime = "nodejs";

const transferSchema = z.strictObject({
  uid: z.string().trim().min(1, "Choose the new owner.").max(128),
  reason: reasonSchema,
});

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "tournament-transfer", 20, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = transferSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await transferTournamentOwnership(guard.user, id, parsed.data.uid, parsed.data.reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
