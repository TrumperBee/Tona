// GCC - deterministic fake-player candidates.
//
// The list is intentionally varied for UI testing: three-character tags,
// sixteen-character stress tags, mixed case, underscores/dots/hyphens, tags
// that start with a digit, and roughly half Kenyan players. Selection always
// moves down this list, so skipped tags (a real account already owns one) never
// change which account comes next.
import { getGamePlatforms, type GameId, type PlatformId } from "@/lib/config/games";
import type { RegistrationInput } from "@/lib/validation/registration";

import { SeedError } from "./manifest";

export interface SeedCandidate {
  readonly slot: number;
  readonly gamerTag: string;
  readonly fullName: string;
  readonly country: string;
  readonly preferredGame: GameId;
  readonly platform: PlatformId;
}

/**
 * 60 candidates for a maximum of 36 test accounts. The head-room lets the
 * seeder skip tags that real accounts already own without ever reusing an
 * identity or exceeding the account cap.
 */
export const SEED_CANDIDATES: readonly SeedCandidate[] = [
  {
    slot: 1,
    gamerTag: "Ace",
    fullName: "Amani Otieno",
    country: "KE",
    preferredGame: "efootball",
    platform: "android",
  },
  {
    slot: 2,
    gamerTag: "J4Y",
    fullName: "Joy Wambui",
    country: "KE",
    preferredGame: "dream-league-soccer",
    platform: "ios",
  },
  {
    slot: 3,
    gamerTag: "K1D",
    fullName: "Kevin Odhiambo",
    country: "KE",
    preferredGame: "efootball",
    platform: "playstation",
  },
  {
    slot: 4,
    gamerTag: "4T7",
    fullName: "Brian Mwangi",
    country: "KE",
    preferredGame: "ea-sports-fc",
    platform: "pc",
  },
  {
    slot: 5,
    gamerTag: "9Lives",
    fullName: "Zedekiah Kariuki",
    country: "KE",
    preferredGame: "efootball",
    platform: "xbox",
  },
  {
    slot: 6,
    gamerTag: "Zed_99",
    fullName: "Maya Kamau",
    country: "KE",
    preferredGame: "efootball",
    platform: "pc",
  },
  {
    slot: 7,
    gamerTag: "Maya.K",
    fullName: "Dennis Onyango",
    country: "KE",
    preferredGame: "dream-league-soccer",
    platform: "android",
  },
  {
    slot: 8,
    gamerTag: "Obi-Wan7",
    fullName: "Obi Njoroge",
    country: "UG",
    preferredGame: "efootball",
    platform: "playstation",
  },
  {
    slot: 9,
    gamerTag: "D_RO",
    fullName: "Dennis Ochieng",
    country: "UG",
    preferredGame: "dream-league-soccer",
    platform: "android",
  },
  {
    slot: 10,
    gamerTag: "Blaze_16",
    fullName: "Blaze Achieng",
    country: "UG",
    preferredGame: "efootball",
    platform: "xbox",
  },
  {
    slot: 11,
    gamerTag: "Nia-7",
    fullName: "Nia Chebet",
    country: "TZ",
    preferredGame: "efootball",
    platform: "android",
  },
  {
    slot: 12,
    gamerTag: "Tunde_X",
    fullName: "Tunde Balogun",
    country: "NG",
    preferredGame: "ea-sports-fc",
    platform: "playstation",
  },
  {
    slot: 13,
    gamerTag: "ShadowStriker_16",
    fullName: "Shadrack Kiptoo",
    country: "KE",
    preferredGame: "efootball",
    platform: "playstation",
  },
  {
    slot: 14,
    gamerTag: "K3nMara.United_7",
    fullName: "Kennedy Maina",
    country: "KE",
    preferredGame: "efootball",
    platform: "pc",
  },
  {
    slot: 15,
    gamerTag: "DeterminedDynamo",
    fullName: "Dynamo Mwenda",
    country: "KE",
    preferredGame: "ea-sports-fc",
    platform: "xbox",
  },
  {
    slot: 16,
    gamerTag: "QueenOfThePitch1",
    fullName: "Queenter Atieno",
    country: "KE",
    preferredGame: "efootball",
    platform: "playstation",
  },
  {
    slot: 17,
    gamerTag: "xX_Sniper_Xx",
    fullName: "Samuel Ouma",
    country: "KE",
    preferredGame: "efootball",
    platform: "pc",
  },
  {
    slot: 18,
    gamerTag: "0v3rDr1ve",
    fullName: "Oliver Bennett",
    country: "GB",
    preferredGame: "ea-sports-fc",
    platform: "playstation",
  },
  {
    slot: 19,
    gamerTag: "Lagos_Lion",
    fullName: "Lionel Eze",
    country: "NG",
    preferredGame: "ea-sports-fc",
    platform: "pc",
  },
  {
    slot: 20,
    gamerTag: "NBO_Express",
    fullName: "Peter Njoroge",
    country: "KE",
    preferredGame: "efootball",
    platform: "xbox",
  },
  {
    slot: 21,
    gamerTag: "Mombasa_10",
    fullName: "Salim Ali",
    country: "KE",
    preferredGame: "efootball",
    platform: "android",
  },
  {
    slot: 22,
    gamerTag: "Kibera_Kid",
    fullName: "Brian Ochieng",
    country: "KE",
    preferredGame: "dream-league-soccer",
    platform: "android",
  },
  {
    slot: 23,
    gamerTag: "Mwangi.M",
    fullName: "Moses Mwangi",
    country: "KE",
    preferredGame: "efootball",
    platform: "pc",
  },
  {
    slot: 24,
    gamerTag: "Achieng_7",
    fullName: "Faith Achieng",
    country: "KE",
    preferredGame: "efootball",
    platform: "playstation",
  },
  {
    slot: 25,
    gamerTag: "Wanjiku-3",
    fullName: "Grace Wanjiku",
    country: "KE",
    preferredGame: "dream-league-soccer",
    platform: "ios",
  },
  {
    slot: 26,
    gamerTag: "Omondi_X",
    fullName: "Collins Omondi",
    country: "KE",
    preferredGame: "efootball",
    platform: "xbox",
  },
  {
    slot: 27,
    gamerTag: "Hassan_11",
    fullName: "Hassan Noor",
    country: "KE",
    preferredGame: "efootball",
    platform: "pc",
  },
  {
    slot: 28,
    gamerTag: "Amara.9",
    fullName: "Amara Ndiaye",
    country: "SN",
    preferredGame: "ea-sports-fc",
    platform: "playstation",
  },
  {
    slot: 29,
    gamerTag: "Zuri_K",
    fullName: "Zuri Makena",
    country: "KE",
    preferredGame: "dream-league-soccer",
    platform: "android",
  },
  {
    slot: 30,
    gamerTag: "Tafari_8",
    fullName: "Tafari Bekele",
    country: "ET",
    preferredGame: "efootball",
    platform: "xbox",
  },
  {
    slot: 31,
    gamerTag: "Neema_5",
    fullName: "Neema Mushi",
    country: "TZ",
    preferredGame: "efootball",
    platform: "android",
  },
  {
    slot: 32,
    gamerTag: "Jabari_7",
    fullName: "Jabari Okello",
    country: "KE",
    preferredGame: "ea-sports-fc",
    platform: "pc",
  },
  {
    slot: 33,
    gamerTag: "Kofi_22",
    fullName: "Kofi Mensah",
    country: "GH",
    preferredGame: "ea-sports-fc",
    platform: "playstation",
  },
  {
    slot: 34,
    gamerTag: "Abebe_4",
    fullName: "Abebe Tadesse",
    country: "ET",
    preferredGame: "efootball",
    platform: "playstation",
  },
  {
    slot: 35,
    gamerTag: "Sanele_6",
    fullName: "Sanele Dlamini",
    country: "ZA",
    preferredGame: "ea-sports-fc",
    platform: "xbox",
  },
  {
    slot: 36,
    gamerTag: "Thabo_10",
    fullName: "Thabo Nkosi",
    country: "ZA",
    preferredGame: "ea-sports-fc",
    platform: "pc",
  },
  {
    slot: 37,
    gamerTag: "Chidi_8",
    fullName: "Chidi Okafor",
    country: "NG",
    preferredGame: "ea-sports-fc",
    platform: "playstation",
  },
  {
    slot: 38,
    gamerTag: "Lulu_3",
    fullName: "Lulu Hassan",
    country: "KE",
    preferredGame: "dream-league-soccer",
    platform: "ios",
  },
  {
    slot: 39,
    gamerTag: "Baraka_9",
    fullName: "Baraka Juma",
    country: "TZ",
    preferredGame: "efootball",
    platform: "android",
  },
  {
    slot: 40,
    gamerTag: "Imani_2",
    fullName: "Imani Waweru",
    country: "KE",
    preferredGame: "efootball",
    platform: "pc",
  },
  {
    slot: 41,
    gamerTag: "Kamau_5",
    fullName: "Kamau Ndegwa",
    country: "KE",
    preferredGame: "efootball",
    platform: "xbox",
  },
  {
    slot: 42,
    gamerTag: "Otieno_6",
    fullName: "Otieno Owino",
    country: "KE",
    preferredGame: "efootball",
    platform: "playstation",
  },
  {
    slot: 43,
    gamerTag: "Adhiambo_1",
    fullName: "Adhiambo Nyongo",
    country: "KE",
    preferredGame: "dream-league-soccer",
    platform: "android",
  },
  {
    slot: 44,
    gamerTag: "Kiptoo_4",
    fullName: "Kiptoo Rono",
    country: "KE",
    preferredGame: "efootball",
    platform: "pc",
  },
  {
    slot: 45,
    gamerTag: "Chebet_7",
    fullName: "Chebet Sang",
    country: "KE",
    preferredGame: "efootball",
    platform: "playstation",
  },
  {
    slot: 46,
    gamerTag: "Njeri_3",
    fullName: "Njeri Kariuki",
    country: "KE",
    preferredGame: "dream-league-soccer",
    platform: "ios",
  },
  {
    slot: 47,
    gamerTag: "Maina_8",
    fullName: "Maina Githinji",
    country: "KE",
    preferredGame: "efootball",
    platform: "xbox",
  },
  {
    slot: 48,
    gamerTag: "Wairimu_2",
    fullName: "Wairimu Karanja",
    country: "KE",
    preferredGame: "dream-league-soccer",
    platform: "android",
  },
  {
    slot: 49,
    gamerTag: "Odhiambo_5",
    fullName: "Odhiambo Were",
    country: "UG",
    preferredGame: "efootball",
    platform: "pc",
  },
  {
    slot: 50,
    gamerTag: "Nala_7",
    fullName: "Nala Osei",
    country: "GH",
    preferredGame: "dream-league-soccer",
    platform: "android",
  },
  {
    slot: 51,
    gamerTag: "Simba_9",
    fullName: "Simba Moyo",
    country: "ZA",
    preferredGame: "ea-sports-fc",
    platform: "pc",
  },
  {
    slot: 52,
    gamerTag: "Kito_4",
    fullName: "Kito Ssemakula",
    country: "UG",
    preferredGame: "efootball",
    platform: "xbox",
  },
  {
    slot: 53,
    gamerTag: "Mosi_3",
    fullName: "Mosi Ndlovu",
    country: "ZA",
    preferredGame: "ea-sports-fc",
    platform: "playstation",
  },
  {
    slot: 54,
    gamerTag: "Zola_8",
    fullName: "Zola Dube",
    country: "ZA",
    preferredGame: "dream-league-soccer",
    platform: "ios",
  },
  {
    slot: 55,
    gamerTag: "Ayo_9",
    fullName: "Ayo Adeyemi",
    country: "NG",
    preferredGame: "ea-sports-fc",
    platform: "xbox",
  },
  {
    slot: 56,
    gamerTag: "Sefu_5",
    fullName: "Sefu Mwinyi",
    country: "TZ",
    preferredGame: "efootball",
    platform: "playstation",
  },
  {
    slot: 57,
    gamerTag: "Tau_2",
    fullName: "Tau Molefe",
    country: "ZA",
    preferredGame: "efootball",
    platform: "android",
  },
  {
    slot: 58,
    gamerTag: "Kaya_6",
    fullName: "Kaya Ssentongo",
    country: "UG",
    preferredGame: "dream-league-soccer",
    platform: "android",
  },
  {
    slot: 59,
    gamerTag: "Dalia_4",
    fullName: "Dalia Haddad",
    country: "MA",
    preferredGame: "ea-sports-fc",
    platform: "pc",
  },
  {
    slot: 60,
    gamerTag: "Rui_8",
    fullName: "Rui Fernandes",
    country: "PT",
    preferredGame: "efootball",
    platform: "playstation",
  },
];

/** Reserved UK Ofcom drama number: nobody can ever be contacted. */
export function dramaPhone(slot: number): string {
  return `+447700900${String(slot).padStart(3, "0")}`;
}

export interface TournamentRestrictions {
  readonly gameId: GameId;
  readonly allowedPlatforms: readonly string[] | null;
  readonly allowedCountries: readonly string[] | null;
}

/**
 * Picks a country that satisfies the tournament restriction. Unrestricted
 * tournaments keep the candidate's varied country; restricted tournaments
 * deterministically fall back to an allowed country.
 */
export function chooseCountry(
  candidate: SeedCandidate,
  restrictions: TournamentRestrictions,
): string {
  if (!restrictions.allowedCountries) {
    return candidate.country;
  }

  const allowed = restrictions.allowedCountries.map((country) => country.toUpperCase());

  if (allowed.includes(candidate.country)) {
    return candidate.country;
  }

  if (allowed.length === 0) {
    throw new SeedError("This tournament allows no countries, so registration cannot succeed.");
  }

  return allowed[candidate.slot % allowed.length] ?? allowed[0]!;
}

/**
 * Picks a platform the tournament accepts and the player's preferred game
 * supports. The candidate's own platform is kept whenever possible.
 */
export function choosePlatform(
  candidate: SeedCandidate,
  restrictions: TournamentRestrictions,
): PlatformId {
  if (!restrictions.allowedPlatforms) {
    return candidate.platform;
  }

  const gamePlatforms = getGamePlatforms(candidate.preferredGame);
  const allowed = restrictions.allowedPlatforms.filter((platform): platform is PlatformId =>
    (gamePlatforms as readonly string[]).includes(platform),
  );

  if (allowed.includes(candidate.platform)) {
    return candidate.platform;
  }

  if (allowed.length === 0) {
    throw new SeedError(
      `This tournament only accepts ${restrictions.allowedPlatforms.join(", ")}, ` +
        `which ${candidate.preferredGame} does not support.`,
    );
  }

  return allowed[candidate.slot % allowed.length] ?? allowed[0]!;
}

/** Builds the exact payload the real `/api/auth/register` service accepts. */
export function registrationInputFor(
  candidate: SeedCandidate,
  restrictions: TournamentRestrictions,
  password: string,
  email: string,
): RegistrationInput {
  return {
    fullName: candidate.fullName,
    gamerTag: candidate.gamerTag,
    email: email,
    password: password,
    // The production validator rejects the reserved Ofcom drama range because
    // it is intentionally non-dialable. The seeder stores that value directly
    // on the test account after creation (see service.ts).
    whatsapp: undefined,
    country: chooseCountry(candidate, restrictions),
    preferredGame: candidate.preferredGame,
    platform: choosePlatform(candidate, restrictions),
    acceptTerms: true,
  };
}
