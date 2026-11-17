// GCC - Super Admin statistics repair.
//
// POST /api/super-admin/stats/recompute
// One player, one tournament, or every public profile in uid-ordered batches.
// Every run is audited. The repair never fabricates a value: it re-reads the
// recorded matches and replaces the derived documents.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import {
  recomputeAllStats,
  recomputePlayerStats,
  recomputeTournamentStats,
} from "@/lib/stats/completion";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";

export const runtime = "nodejs";

const bodySchema = z.strictObject({
  playerUid: z.string().trim().min(1).max(128).optional(),
  tournamentId: z.string().trim().min(1).max(128).optional(),
  all: z.boolean().optional(),
  cursor: z.string().trim().min(1).max(128).nullable().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "stats-recompute", 10, 300);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Check the request fields." }, { status: 400 });
  }

  const modes = [parsed.data.playerUid, parsed.data.tournamentId, parsed.data.all].filter(Boolean);

  if (modes.length !== 1) {
    return NextResponse.json(
      { error: "Choose exactly one: a player, a tournament, or everyone." },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.playerUid) {
      await recomputePlayerStats(parsed.data.playerUid);
      await writeAuditLog({
        actorUid: guard.user.userId,
        actorRole: guard.user.role,
        action: "stats.recomputed",
        targetType: "user",
        targetId: parsed.data.playerUid,
        tournamentId: null,
        before: null,
        after: { scope: "player" },
        reason: "Super Admin statistical repair",
      });

      return NextResponse.json({ ok: true, scope: "player", playerUid: parsed.data.playerUid });
    }

    if (parsed.data.tournamentId) {
      const result = await recomputeTournamentStats(parsed.data.tournamentId);

      if (!result) {
        return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
      }

      await writeAuditLog({
        actorUid: guard.user.userId,
        actorRole: guard.user.role,
        action: "stats.recomputed",
        targetType: "tournament",
        targetId: parsed.data.tournamentId,
        tournamentId: parsed.data.tournamentId,
        before: null,
        after: { scope: "tournament", ...result },
        reason: "Super Admin statistical repair",
      });

      return NextResponse.json({ ok: true, scope: "tournament", ...result });
    }

    const result = await recomputeAllStats({ cursor: parsed.data.cursor ?? null });

    await writeAuditLog({
      actorUid: guard.user.userId,
      actorRole: guard.user.role,
      action: "stats.recomputed",
      targetType: "platform",
      targetId: "publicProfiles",
      tournamentId: null,
      before: { cursor: parsed.data.cursor ?? null },
      after: { scope: "all", ...result },
      reason: "Super Admin statistical repair",
    });

    return NextResponse.json({ ok: true, scope: "all", ...result });
  } catch {
    return NextResponse.json(
      { error: "The recompute failed. Existing documents were left unchanged where possible." },
      { status: 500 },
    );
  }
}
