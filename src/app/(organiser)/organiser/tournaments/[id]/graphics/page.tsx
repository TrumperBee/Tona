// GCC - organiser graphics gallery.
//
// Every card is built from the same server-written documents the public pages
// read: standings, fixtures, the confirmed draw and the knockout bracket. A
// template with no real data is omitted rather than previewed with placeholders.
import { Image as ImageIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { GraphicsGallery, type GraphicsGalleryItem } from "@/components/graphics/graphics-gallery";
import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";
import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { SITE_URL } from "@/lib/config/site";
import { getGame } from "@/lib/config/games";
import { getPublicFixtures } from "@/lib/data/public-fixtures";
import { getPublicKnockout } from "@/lib/data/public-knockout";
import { getPublicStandings } from "@/lib/data/public-standings";
import { getPublicDraw, getTournamentParticipants } from "@/lib/data/public-tournaments";
import {
  avatarLookup,
  championGraphicData,
  fixturesGraphicData,
  graphicBranding,
  knockoutGraphicData,
  leagueTableGraphicData,
  potsGraphicData,
  announcementGraphicData,
} from "@/lib/graphics/data";
import { qrSvgDataUrl } from "@/lib/graphics/qr";
import { getTournamentWorkspace } from "@/lib/organiser/workspace-access";

export const metadata = { title: "Graphics" };

interface GraphicsPageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function GraphicsPage({ params }: GraphicsPageProps) {
  const { id } = await params;

  let access: Awaited<ReturnType<typeof getTournamentWorkspace>>;

  try {
    access = await getTournamentWorkspace(id);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const { tournament } = access;
  const [participants, publicDraw, publicFixtures, publicStandings, publicKnockout] =
    await Promise.all([
      getTournamentParticipants(id),
      getPublicDraw(id),
      getPublicFixtures(id, tournament.status),
      getPublicStandings(id, tournament.status),
      getPublicKnockout(id, tournament.status),
    ]);

  const branding = graphicBranding({
    tournamentName: tournament.name,
    tournamentSlug: tournament.slug,
    season: tournament.season,
    gameName: getGame(tournament.gameId).name,
    logoSrc: tournament.logoUrl,
    coverSrc: tournament.coverImageUrl,
    organiserName: tournament.organisationName,
  });
  const avatars = avatarLookup([...participants, ...(publicStandings?.rows ?? [])]);
  const leagueMatches = publicFixtures?.matches.filter((match) => match.matchday > 0) ?? [];
  const matchdays = [...new Set(leagueMatches.map((match) => match.matchday))].sort(
    (a, b) => a - b,
  );
  const completedMatchdays = [
    ...new Set(
      leagueMatches.filter((match) => match.status === "completed").map((match) => match.matchday),
    ),
  ].sort((a, b) => a - b);
  const latestCompleted =
    completedMatchdays.length > 0 ? completedMatchdays[completedMatchdays.length - 1] : null;

  const items: GraphicsGalleryItem[] = [];

  if (publicDraw) {
    items.push({
      key: "pots",
      title: "Confirmed draw",
      description: "Four pots of nine, exactly as drawn and confirmed.",
      payload: { template: "pots", data: potsGraphicData(publicDraw) },
    });
  }

  if (publicStandings && publicStandings.rows.length > 0) {
    const final = !publicStandings.provisional;

    items.push({
      key: "league-table",
      title: final ? "Final league table" : "League table",
      description: `All ${publicStandings.rows.length} rows with the qualification bands and legend.`,
      payload: {
        template: "league-table",
        data: leagueTableGraphicData(publicStandings.rows, {
          provisional: publicStandings.provisional,
          title: final
            ? "Final table"
            : latestCompleted
              ? `Matchday ${latestCompleted}`
              : "League table",
          subtitle: final
            ? "Final positions"
            : `${publicStandings.rows.length} players · provisional positions`,
        }),
      },
    });
  }

  for (const matchday of matchdays) {
    const rows = leagueMatches.filter((match) => match.matchday === matchday);

    items.push({
      key: `fixtures-${matchday}`,
      title: `Matchday ${matchday} fixtures`,
      description: `${rows.length} ${rows.length === 1 ? "fixture" : "fixtures"}, home versus away.`,
      payload: {
        template: "fixtures",
        data: fixturesGraphicData(rows, matchday, avatars, { showScores: false }),
      },
    });
  }

  for (const matchday of completedMatchdays) {
    const rows = leagueMatches.filter(
      (match) => match.matchday === matchday && match.status === "completed",
    );

    items.push({
      key: `results-${matchday}`,
      title: `Matchday ${matchday} results`,
      description: `${rows.length} recorded ${rows.length === 1 ? "score" : "scores"}.`,
      payload: {
        template: "results",
        data: fixturesGraphicData(rows, matchday, avatars, { showScores: true }),
      },
    });
  }

  if (publicKnockout && publicKnockout.rounds.length > 0) {
    items.push({
      key: "knockout",
      title: "Knockout bracket",
      description: `${publicKnockout.ties.length} ties from the play-offs to the final.`,
      payload: { template: "knockout", data: knockoutGraphicData(publicKnockout) },
    });
  }

  const championGraphic = publicKnockout ? championGraphicData(publicKnockout) : null;

  if (championGraphic) {
    items.push({
      key: "champion",
      title: "Champion card",
      description: `${championGraphic.champion.gamerTag}, the final score and the runner-up.`,
      payload: { template: "champion", data: championGraphic },
    });
  }

  if (tournament.status === "registration_open") {
    const registrationUrl = `${SITE_URL}/tournaments/${tournament.slug}`;
    const qrSvg = await qrSvgDataUrl(registrationUrl);

    items.push({
      key: "announcement",
      title: "Announcement poster",
      description: "Registration open, with the entry link and a QR code.",
      payload: {
        template: "announcement",
        data: announcementGraphicData({
          startsAt: tournament.startsAt?.toDate().toISOString() ?? null,
          slots: tournament.maxParticipants,
          registered: tournament.registrationCount,
          registrationUrl,
          organiserName: tournament.organisationName,
          qrSvg,
        }),
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-navy-900/40 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <ImageIcon aria-hidden="true" className="h-4 w-4 text-electric-300" />
          Graphics
        </p>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-grey-400">
          Every image is generated in your browser from this competition&apos;s real data and
          exported at 2× as a PNG. Nothing is sent to a graphics service, and a template only
          appears once the data it needs exists.
        </p>
      </div>

      {items.length === 0 ? (
        <WorkspaceToolNotice
          icon={ImageIcon}
          title="Graphics"
          description="Generate competition graphics from the same standings and fixture data used by the platform. Every action here applies to this competition only."
          availabilityTitle="No graphic is available yet"
          availabilityDescription="Confirm the draw or publish fixtures first. Nothing is rendered from sample data, so a template appears only when the real competition data exists."
        />
      ) : (
        <GraphicsGallery branding={branding} items={items} />
      )}
    </div>
  );
}
