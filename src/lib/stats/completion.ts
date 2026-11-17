// GCC - tournament completion side effects for statistics.
//
// Runs after the final result transaction commits. It rebuilds every
// participant's public stats, writes their career history, replays the
// tournament into the per-game Elo ladder and records the Hall of Fame entry.
//
// Every write is keyed (tournament id, uid) and every step can run twice: the
// Elo replay is guarded by `ratingsAppliedAt`, Hall of Fame entries are stored
// under the tournament id, and history documents are written with `merge`.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { computePlayerStats } from "@/lib/stats/player-stats";
import { replayTournament } from "@/lib/stats/replay";
import { refreshPlayerStats, refreshPlayersStats } from "@/lib/stats/server";
import type { StatsMatch } from "@/lib/stats/types";
import type {
  HallOfFamePlayerRef,
  HallOfFameStandingRow,
  HallOfFameStats,
  HallOfFameTournamentStats,
  PlayerHistoryDocument,
  PlayerFinalStage,
  RankingDocument,
  TournamentDocument,
} from "@/types/domain";

export interface TournamentCompletionResult {
  readonly tournamentId: string;
  readonly players: number;
  readonly ratingsApplied: boolean;
  readonly hallOfFameWritten: boolean;
  readonly championUid: string | null;
}

interface Participant {
  readonly uid: string;
  readonly tag: string;
  readonly avatarUrl: string | null;
  readonly country: string;
}

interface StoredMatch {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

interface StoredTie {
  readonly id: string;
  readonly round: string;
  readonly higherUid: string;
  readonly lowerUid: string;
  readonly higherTag: string;
  readonly lowerTag: string;
  readonly winnerUid: string;
}

function readText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readResult(value: unknown): { homeGoals: number; awayGoals: number } | null {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;

  return typeof data.homeGoals === "number" && typeof data.awayGoals === "number"
    ? { homeGoals: data.homeGoals, awayGoals: data.awayGoals }
    : null;
}

function readUid(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  return readText((value as Record<string, unknown>).uid);
}

function readTag(value: unknown): string {
  if (typeof value !== "object" || value === null) return "Player";
  return readText((value as Record<string, unknown>).gamerTag, "Player");
}

function matchStats(
  tournamentId: string,
  tournament: TournamentDocument,
  match: StoredMatch,
): StatsMatch | null {
  const result = readResult(match.data.result);
  const homeUid = readText(match.data.homeUid);
  const awayUid = readText(match.data.awayUid);

  if (!result || !homeUid || !awayUid || homeUid === awayUid) return null;

  const stage = match.data.stage;
  const parsedStage =
    stage === "playoff" || stage === "r16" || stage === "qf" || stage === "sf" || stage === "final"
      ? stage
      : "league";

  return {
    id: match.id,
    tournamentId,
    gameId: tournament.gameId,
    stage: parsedStage,
    matchday: readNumber(match.data.matchday),
    leg: typeof match.data.leg === "number" ? match.data.leg : null,
    homeUid,
    awayUid,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
  };
}

const LOST_STAGE: Readonly<Record<string, PlayerFinalStage>> = {
  sf: "semi_finalist",
  qf: "quarter_finalist",
  r16: "round_of_16",
  playoff: "playoffs",
};

const POSITION_FOR_STAGE: Readonly<Record<PlayerFinalStage, number>> = {
  champion: 1,
  runner_up: 2,
  semi_finalist: 3,
  quarter_finalist: 5,
  round_of_16: 9,
  playoffs: 17,
  league_phase: 25,
};

function finalStageFor(
  uid: string,
  championUid: string,
  runnerUpUid: string,
  lostRound: Readonly<Map<string, string>>,
): PlayerFinalStage {
  if (uid === championUid) return "champion";
  if (uid === runnerUpUid) return "runner_up";

  const round = lostRound.get(uid);
  return round ? (LOST_STAGE[round] ?? "league_phase") : "league_phase";
}

async function applyRatings(input: {
  readonly tournament: TournamentDocument;
  readonly tournamentId: string;
  readonly participants: readonly Participant[];
  readonly matches: readonly StatsMatch[];
}): Promise<{
  readonly ratings: Readonly<Record<string, number>>;
  readonly deltas: Readonly<Record<string, number>>;
  readonly initialRatings: Readonly<Record<string, number>>;
} | null> {
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(input.tournamentId));
  const rankingReferences = input.participants.map((participant) =>
    firestore.doc(paths.ranking(input.tournament.gameId, participant.uid)),
  );

  return firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) return null;

    if (tournamentSnapshot.data()?.ratingsAppliedAt) {
      return null;
    }

    const rankingSnapshots = await Promise.all(
      rankingReferences.map((reference) => transaction.get(reference)),
    );
    const initialRatings: Record<string, number> = {};
    const states = new Map<string, Partial<RankingDocument>>();

    input.participants.forEach((participant, index) => {
      const data = rankingSnapshots[index]?.exists
        ? (rankingSnapshots[index]?.data() as Partial<RankingDocument>)
        : {};
      initialRatings[participant.uid] = readNumber(data.rating, 1000);
      states.set(participant.uid, data);
    });

    const replay = replayTournament({
      matches: input.matches,
      initialRatings,
    });
    const now = Timestamp.now();

    input.participants.forEach((participant, index) => {
      const record = replay.records[participant.uid];

      // A player with no completed match in this tournament keeps their row.
      if (!record) return;

      const previous = states.get(participant.uid) ?? {};
      const rating = replay.ratings[participant.uid] ?? initialRatings[participant.uid] ?? 1000;
      const next = {
        gamerTag: participant.tag,
        gamerTagLower: participant.tag.toLowerCase(),
        avatarUrl: participant.avatarUrl,
        country: participant.country,
        rating,
        ratedMatches: readNumber(previous.ratedMatches) + record.played,
        played: readNumber(previous.played) + record.played,
        wins: readNumber(previous.wins) + record.wins,
        draws: readNumber(previous.draws) + record.draws,
        losses: readNumber(previous.losses) + record.losses,
        updatedAt: now,
      };

      transaction.set(rankingReferences[index]!, next, { merge: true });
    });

    transaction.update(tournamentRef, {
      ratingsAppliedAt: now,
      ratingSnapshot: initialRatings,
    });

    return {
      ratings: replay.ratings,
      deltas: replay.deltas,
      initialRatings,
    };
  });
}

function buildTournamentStats(input: {
  readonly matches: readonly StoredMatch[];
  readonly participants: ReadonlyMap<string, Participant>;
  readonly standings: readonly Record<string, unknown>[];
}): HallOfFameTournamentStats {
  let completed = 0;
  let goals = 0;
  const leagueGoals = new Map<string, number>();

  for (const match of input.matches) {
    const result = readResult(match.data.result);

    if (!result) continue;

    completed += 1;
    goals += result.homeGoals + result.awayGoals;

    if (match.data.stage === "league") {
      const homeUid = readText(match.data.homeUid);
      const awayUid = readText(match.data.awayUid);

      if (homeUid) leagueGoals.set(homeUid, (leagueGoals.get(homeUid) ?? 0) + result.homeGoals);
      if (awayUid) leagueGoals.set(awayUid, (leagueGoals.get(awayUid) ?? 0) + result.awayGoals);
    }
  }

  const scorer = [...leagueGoals.entries()]
    .map(([uid, value]) => ({
      uid,
      tag: input.participants.get(uid)?.tag ?? "Player",
      goals: value,
    }))
    .sort((left, right) =>
      right.goals !== left.goals ? right.goals - left.goals : left.tag.localeCompare(right.tag),
    )[0];

  const defence = [...input.standings]
    .map((row) => ({
      uid: readText(row.id),
      tag: readText(row.gamerTag, "Player"),
      goalsAgainst: readNumber(row.goalsAgainst),
      position: readNumber(row.position, Number.MAX_SAFE_INTEGER),
    }))
    .sort((left, right) =>
      left.goalsAgainst !== right.goalsAgainst
        ? left.goalsAgainst - right.goalsAgainst
        : left.position - right.position,
    )[0];

  return {
    matches: completed,
    goals,
    goalsPerMatch: completed > 0 ? Math.round((goals / completed) * 100) / 100 : 0,
    topScorer: scorer && scorer.goals > 0 ? scorer : null,
    bestDefence: defence ?? null,
  };
}

function buildStandings(
  rows: readonly Record<string, unknown>[],
  participants: ReadonlyMap<string, Participant>,
): HallOfFameStandingRow[] {
  return rows
    .map((row): HallOfFameStandingRow => {
      const uid = readText(row.id);
      const participant = participants.get(uid);

      return {
        uid,
        tag: readText(row.gamerTag, participant?.tag ?? "Player"),
        avatarUrl: participant?.avatarUrl ?? null,
        position: readNumber(row.position, Number.MAX_SAFE_INTEGER),
        played: readNumber(row.played),
        wins: readNumber(row.won),
        draws: readNumber(row.drawn),
        losses: readNumber(row.lost),
        goalsFor: readNumber(row.goalsFor),
        goalsAgainst: readNumber(row.goalsAgainst),
      };
    })
    .filter((row) => row.uid.length > 0)
    .sort((left, right) => left.position - right.position)
    .slice(0, 8);
}

/**
 * Rebuilds every completion-derived document for one completed tournament.
 * Safe to call repeatedly. Returns null when the tournament is not complete.
 */
export async function finaliseTournamentCompletion(
  tournamentId: string,
): Promise<TournamentCompletionResult | null> {
  const firestore = getFirebaseAdminFirestore();
  const tournamentSnapshot = await firestore.doc(paths.tournament(tournamentId)).get();

  if (!tournamentSnapshot.exists) return null;

  const tournament = tournamentSnapshot.data() as TournamentDocument;

  if (tournament.status !== "completed") return null;

  const [registrationSnapshot, matchSnapshot, tieSnapshot, standingSnapshot, hallSnapshot] =
    await Promise.all([
      firestore
        .collection(paths.tournamentRegistrations(tournamentId))
        .where("status", "==", "registered")
        .get(),
      firestore.collection(paths.tournamentMatches(tournamentId)).get(),
      firestore.collection(paths.tournamentKnockoutTies(tournamentId)).get(),
      firestore.collection(paths.tournamentStandings(tournamentId)).get(),
      firestore.doc(paths.hallOfFameEntry(tournamentId)).get(),
    ]);

  const participants: Participant[] = registrationSnapshot.docs.map((document) => {
    const data = document.data();

    return {
      uid: document.id,
      tag: readText(data.gamerTag, "Player"),
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
      country: readText(data.country),
    };
  });
  const participantMap = new Map(participants.map((participant) => [participant.uid, participant]));
  const matches: StoredMatch[] = matchSnapshot.docs.map((document) => ({
    id: document.id,
    data: document.data(),
  }));
  const ties: StoredTie[] = tieSnapshot.docs.map((document) => {
    const data = document.data();

    return {
      id: document.id,
      round: readText(data.round, "r16"),
      higherUid: readUid(data.higher),
      lowerUid: readUid(data.lower),
      higherTag: readTag(data.higher),
      lowerTag: readTag(data.lower),
      winnerUid: readText(data.winnerUid),
    };
  });
  const standingRows: Record<string, unknown>[] = standingSnapshot.docs.map((document) => ({
    ...document.data(),
    id: document.id,
  }));
  const statsMatches = matches
    .map((match) => matchStats(tournamentId, tournament, match))
    .filter((match): match is StatsMatch => match !== null);

  const championUid = readText(tournament.championUid);
  const runnerUpUid = readText(tournament.runnerUpUid);
  const lostRound = new Map<string, string>();

  for (const tie of ties) {
    if (!tie.winnerUid) continue;

    const loser =
      tie.winnerUid === tie.higherUid
        ? tie.lowerUid
        : tie.winnerUid === tie.lowerUid
          ? tie.higherUid
          : "";
    const existing = lostRound.get(loser);

    if (
      loser &&
      (!existing ||
        ["playoff", "r16", "qf", "sf"].indexOf(tie.round) <
          ["playoff", "r16", "qf", "sf"].indexOf(existing))
    ) {
      lostRound.set(loser, tie.round);
    }
  }

  const stageByUid = new Map<string, PlayerFinalStage>();

  for (const participant of participants) {
    stageByUid.set(
      participant.uid,
      finalStageFor(participant.uid, championUid, runnerUpUid, lostRound),
    );
  }

  const ratings = await applyRatings({
    tournament,
    tournamentId,
    participants,
    matches: statsMatches,
  });
  const completedAt = tournament.completedAt ?? Timestamp.now();
  const champion = participantMap.get(championUid);
  const runnerUp = participantMap.get(runnerUpUid);
  const semiFinalists: HallOfFamePlayerRef[] = ties
    .filter((tie) => tie.round === "sf")
    .map((tie) => {
      const loserUid = tie.winnerUid === tie.higherUid ? tie.lowerUid : tie.higherUid;
      const participant = participantMap.get(loserUid);

      return {
        uid: loserUid,
        tag: participant?.tag ?? (loserUid === tie.higherUid ? tie.higherTag : tie.lowerTag),
        avatarUrl: participant?.avatarUrl ?? null,
      };
    })
    .filter((player) => player.uid.length > 0);
  const championStats = computePlayerStats(statsMatches, championUid).overall;
  const championRecord: HallOfFameStats = {
    played: championStats.played,
    wins: championStats.wins,
    draws: championStats.draws,
    losses: championStats.losses,
    goalsFor: championStats.goalsFor,
    goalsAgainst: championStats.goalsAgainst,
  };
  const tournamentStats = buildTournamentStats({
    matches,
    participants: participantMap,
    standings: standingRows,
  });
  const hallOfFame = {
    tournamentId,
    tournamentName: tournament.name,
    slug: tournament.slug,
    season: tournament.season,
    gameId: tournament.gameId,
    championUid,
    championTag: champion?.tag ?? "Champion",
    championAvatarUrl: champion?.avatarUrl ?? null,
    finalistUid: runnerUpUid,
    finalistTag: runnerUp?.tag ?? "Runner-up",
    finalistAvatarUrl: runnerUp?.avatarUrl ?? null,
    semiFinalists,
    thirdPlace: null,
    standings: buildStandings(standingRows, participantMap),
    stats: championRecord,
    tournamentStats,
    completedAt,
  };

  await firestore.doc(paths.hallOfFameEntry(tournamentId)).set(hallOfFame);

  const historyReferences = participants.map((participant) =>
    firestore.doc(paths.publicProfileHistoryEntry(participant.uid, tournamentId)),
  );
  const previousHistory = await Promise.all(historyReferences.map((reference) => reference.get()));

  await Promise.all(
    participants.map(async (participant, index) => {
      const record = computePlayerStats(statsMatches, participant.uid).overall;
      const stage = stageByUid.get(participant.uid) ?? "league_phase";
      const standing = standingRows.find((row) => row.id === participant.uid);
      const finalPosition =
        stage === "league_phase"
          ? readNumber(standing?.position, POSITION_FOR_STAGE.league_phase)
          : POSITION_FOR_STAGE[stage];
      const previous = previousHistory[index]?.data() as Partial<PlayerHistoryDocument> | undefined;
      const history = {
        tournamentId,
        tournamentName: tournament.name,
        slug: tournament.slug,
        season: tournament.season,
        gameId: tournament.gameId,
        finalPosition,
        finalStage: stage,
        played: record.played,
        wins: record.wins,
        draws: record.draws,
        losses: record.losses,
        goalsFor: record.goalsFor,
        goalsAgainst: record.goalsAgainst,
        wonTitle: participant.uid === championUid,
        ratingAfter:
          ratings?.ratings[participant.uid] ??
          (typeof previous?.ratingAfter === "number" ? previous.ratingAfter : null),
        ratingChange:
          ratings?.deltas[participant.uid] ??
          (typeof previous?.ratingChange === "number" ? previous.ratingChange : null),
        completedAt,
      };

      await historyReferences[index]!.set(history, { merge: true });
    }),
  );

  // The Hall of Fame entry must exist before stats are refreshed: titles are
  // counted from champion entries, not incremented by hand.
  await refreshPlayersStats(participants.map((participant) => participant.uid));

  if (!hallSnapshot.exists) {
    await writeAuditLog({
      actorUid: "system",
      actorRole: "super_admin",
      action: "hall_of_fame.inducted",
      targetType: "tournament",
      targetId: tournamentId,
      tournamentId,
      before: null,
      after: {
        championUid,
        runnerUpUid,
        players: participants.length,
        ratingsApplied: Boolean(ratings),
      },
      reason: "Tournament completion",
    });
  }

  return {
    tournamentId,
    players: participants.length,
    ratingsApplied: Boolean(ratings),
    hallOfFameWritten: true,
    championUid: championUid || null,
  };
}

/** Refresh one profile from a Super Admin repair action. */
export async function recomputePlayerStats(uid: string): Promise<void> {
  await refreshPlayerStats(uid);
}

/** Re-derives every completion document, or just the players of a live event. */
export async function recomputeTournamentStats(tournamentId: string): Promise<{
  readonly players: number;
  readonly completed: boolean;
  readonly ratingsApplied: boolean;
} | null> {
  const firestore = getFirebaseAdminFirestore();
  const snapshot = await firestore.doc(paths.tournament(tournamentId)).get();

  if (!snapshot.exists) return null;

  const tournament = snapshot.data() as TournamentDocument;

  if (tournament.status === "completed") {
    const result = await finaliseTournamentCompletion(tournamentId);

    return result
      ? {
          players: result.players,
          completed: true,
          ratingsApplied: result.ratingsApplied,
        }
      : { players: 0, completed: true, ratingsApplied: false };
  }

  const registrations = await firestore
    .collection(paths.tournamentRegistrations(tournamentId))
    .where("status", "==", "registered")
    .get();

  await refreshPlayersStats(registrations.docs.map((document) => document.id));

  return {
    players: registrations.size,
    completed: false,
    ratingsApplied: Boolean(tournament.ratingsAppliedAt),
  };
}

export interface RecomputeBatchResult {
  readonly refreshed: number;
  readonly nextCursor: string | null;
}

/** Refreshes profiles in stable uid order so a repair run can resume. */
export async function recomputeAllStats(
  options: { readonly cursor?: string | null; readonly batchSize?: number } = {},
): Promise<RecomputeBatchResult> {
  const firestore = getFirebaseAdminFirestore();
  const batchSize = Math.min(100, Math.max(10, options.batchSize ?? 50));
  let query = firestore.collection(paths.publicProfiles()).orderBy("__name__").limit(batchSize);

  if (options.cursor) {
    const cursor = await firestore.doc(paths.publicProfile(options.cursor)).get();

    if (cursor.exists) {
      query = query.startAfter(cursor);
    }
  }

  const snapshot = await query.get();
  await refreshPlayersStats(snapshot.docs.map((document) => document.id));

  return {
    refreshed: snapshot.size,
    nextCursor: snapshot.size === batchSize ? (snapshot.docs.at(-1)?.id ?? null) : null,
  };
}
