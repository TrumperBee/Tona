// GCC - WhatsApp contact messages for players arranging a match.
//
// PURE: no Firebase, no framework, no I/O. The server picks a template from the
// stored match, renders it, appends the organiser's optional contact note and
// caps the result. The number never appears here: it only exists inside the
// wa.me link built for one authorised request.
import { renderWhatsAppTemplate, type WhatsAppTemplateId } from "@/lib/whatsapp/templates";
import type { StageType } from "@/types/domain";

export const CONTACT_NOTE_MAX_LENGTH = 140;
export const CONTACT_MESSAGE_MAX_LENGTH = 500;

export type MatchContactTemplateId = Extract<
  WhatsAppTemplateId,
  | "match-contact-league"
  | "match-contact-knockout-leg-1"
  | "match-contact-knockout-leg-2"
  | "match-contact-knockout-single"
  | "match-contact-final"
>;

/** The five messages a player may pick from (or edit away from). */
export const MATCH_CONTACT_TEMPLATE_IDS: readonly MatchContactTemplateId[] = [
  "match-contact-league",
  "match-contact-knockout-leg-1",
  "match-contact-knockout-leg-2",
  "match-contact-knockout-single",
  "match-contact-final",
];

export function isMatchContactTemplateId(value: unknown): value is MatchContactTemplateId {
  return (
    typeof value === "string" && (MATCH_CONTACT_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export interface MatchContactShape {
  readonly stage: StageType;
  /** 1 or 2 for knockout legs; null for league matches. */
  readonly leg?: number | null;
  /** Set for knockout matches only. */
  readonly tieId?: string | null;
}

export interface MatchContactMessageInput {
  readonly opponentTag: string;
  readonly senderTag: string;
  readonly tournamentName: string;
  readonly matchLabel: string;
  readonly contactNote?: string | null;
}

/**
 * Chooses the message for a match. A knockout match is a two-legged tie unless
 * the stored stage is the final (always one match), so leg 2 gets its own body.
 */
export function selectMatchContactTemplate(match: MatchContactShape): MatchContactTemplateId {
  if (match.stage === "league") {
    return "match-contact-league";
  }

  if (match.stage === "final" || match.tieId === null) {
    return "match-contact-final";
  }

  if (match.leg === 1) {
    return "match-contact-knockout-leg-1";
  }

  if (match.leg === 2) {
    return "match-contact-knockout-leg-2";
  }

  return "match-contact-knockout-single";
}

/**
 * Collapses a free-text organiser note into one printable line. Returns null
 * when the note is empty after trimming, so no dangling punctuation is added.
 */
export function normaliseContactNote(note: string | null | undefined): string | null {
  if (typeof note !== "string") {
    return null;
  }

  const collapsed = note.replace(/\s+/g, " ").trim();

  if (collapsed.length === 0) {
    return null;
  }

  return collapsed.slice(0, CONTACT_NOTE_MAX_LENGTH).trimEnd();
}

/**
 * Builds the suggested message. The note is a separate paragraph so a player
 * reading it in WhatsApp can still see where the organiser's words start.
 */
export function buildMatchContactMessage(
  templateId: MatchContactTemplateId,
  input: MatchContactMessageInput,
): string {
  const body = renderWhatsAppTemplate(templateId, {
    opponentTag: input.opponentTag,
    senderTag: input.senderTag,
    tournamentName: input.tournamentName,
    matchLabel: input.matchLabel,
  });
  const note = normaliseContactNote(input.contactNote);
  const message = note ? `${body}\n\n${note}` : body;

  return message.slice(0, CONTACT_MESSAGE_MAX_LENGTH);
}

/** Trims a player-edited message to the allowed length without breaking words mid-way. */
export function clampContactMessage(message: string): string {
  const trimmed = message.trim();

  if (trimmed.length <= CONTACT_MESSAGE_MAX_LENGTH) {
    return trimmed;
  }

  return trimmed.slice(0, CONTACT_MESSAGE_MAX_LENGTH).trimEnd();
}

/** Human label for the match, used in every template. */
export function matchContactLabel(match: {
  readonly stage: StageType;
  readonly matchday: number;
  readonly leg?: number | null;
}): string {
  if (match.stage === "league") {
    return `Matchday ${match.matchday}`;
  }

  return ROUND_LABELS[match.stage] ?? "Knockout";
}

const ROUND_LABELS: Readonly<Record<StageType, string>> = {
  league: "League phase",
  playoff: "Knockout play-off",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "Final",
};
