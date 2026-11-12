// GCC - Pots and draw.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. This page renders the real draw: five editing columns before
// confirmation and four read-only pots afterwards. The draw opens only when
// registration has closed with exactly 36 registered players; the exact reason
// comes from the same pure workspace model that drives the stepper.
import { notFound } from "next/navigation";

import { PotsBoard, type PotsBoardPlayer } from "@/components/organiser/pots-board";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { getOrganiserDraw } from "@/lib/tournament/draw";
import { getWorkspaceSteps } from "@/lib/tournament/workspace";
import { formatDateTime } from "@/lib/utils/dates";
import type { DrawPlayerSnapshot, PotNumber } from "@/types/domain";

export const metadata = { title: "Pots and draw" };

const POT_KEYS = ["1", "2", "3", "4"] as const;

interface PotsPageProps {
  readonly params: Promise<{ id: string }>;
}

function toBoardPlayer(
  uid: string,
  snapshots: Readonly<Record<string, DrawPlayerSnapshot>>,
  registered: Readonly<Record<string, DrawPlayerSnapshot>>,
): PotsBoardPlayer {
  const snapshot = registered[uid] ?? snapshots[uid];

  return {
    uid,
    gamerTag: snapshot?.gamerTag ?? "Player",
    avatarUrl: snapshot?.avatarUrl ?? null,
    country: snapshot?.country ?? "",
  };
}

export default async function PotsPage({ params }: PotsPageProps) {
  const { id } = await params;

  let view: Awaited<ReturnType<typeof getOrganiserDraw>>;

  try {
    view = await getOrganiserDraw(id);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const { tournament, draw, registeredIds } = view;
  const potsStep = getWorkspaceSteps(tournament).find((step) => step.id === "pots");
  const availabilityReason =
    draw?.status === "confirmed"
      ? null
      : tournament.status === "registration_closed"
        ? ((potsStep?.state === "locked" ? potsStep.lockReason : null) ?? null)
        : (potsStep?.lockReason ?? "The draw is not available at this stage.");

  const drawPots = draw?.pots;

  const pots = Object.fromEntries(
    POT_KEYS.map((key) => [
      key,
      (drawPots ? drawPots[key as PotNumber] : []).map((uid) =>
        toBoardPlayer(uid, draw?.playersSnapshot ?? {}, view.players),
      ),
    ]),
  ) as Record<(typeof POT_KEYS)[number], PotsBoardPlayer[]>;

  // A player registered after the draft was generated must still be visible and
  // assignable; union the stored unassigned list with the live field so nothing
  // can be silently missing from the board.
  const placedIds = new Set(POT_KEYS.flatMap((key) => pots[key].map((player) => player.uid)));
  const unassignedIds = [
    ...new Set([
      ...(draw ? draw.unassigned : []),
      ...registeredIds.filter((uid) => !placedIds.has(uid)),
    ]),
  ];
  const unassigned = unassignedIds.map((uid) =>
    toBoardPlayer(uid, draw?.playersSnapshot ?? {}, view.players),
  );

  const boardStatus = draw?.status ?? "draft";
  const confirmedAt = draw?.confirmedAt ? formatDateTime(draw.confirmedAt.toDate()) : null;

  return (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardHeader>
          <h2 className="font-display text-xl font-semibold uppercase tracking-display text-white">
            Pot allocation
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-grey-400">
            Four pots of nine. Every registered player appears in exactly one pot. Pots carry no
            country or association restrictions. Pins keep a player in place across a re-shuffle;
            the server generates every seed and records the method, the operator and the result.
          </p>
        </CardContent>
      </Card>

      <PotsBoard
        tournamentId={id}
        status={boardStatus}
        pots={pots}
        unassigned={unassigned}
        locks={(draw?.locks ?? {}) as Readonly<Record<string, (typeof POT_KEYS)[number]>>}
        method={draw?.method ?? null}
        shuffleSeed={draw?.shuffleSeed ?? null}
        confirmedAt={confirmedAt}
        registeredIds={registeredIds}
        canReplace={
          tournament.status === "registration_closed" || tournament.status === "pots_confirmed"
        }
        availabilityReason={availabilityReason}
      />
    </div>
  );
}
