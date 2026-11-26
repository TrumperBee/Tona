// GCC — mass-assignment guard: every PATCH body schema rejects unknown keys.
// Keeping this list in one test makes it obvious when a new PATCH schema is
// added without strict parsing.
import { describe, expect, it } from "vitest";

import { announcementContentSchema } from "@/lib/validation/announcement";
import {
  changeEmailSchema,
  emailAnnouncementsSchema,
  notificationPreferencesSchema,
} from "@/lib/validation/email";
import { fixtureMatchdayUpdateSchema } from "@/lib/validation/fixtures";
import { organiserProfileEditSchema } from "@/lib/validation/organiser-profile";
import { platformSettingsSchema } from "@/lib/validation/platform-settings";
import { profileEditSchema } from "@/lib/validation/profile";
import { tournamentUpdateSchema } from "@/lib/validation/tournament";

const patchSchemas = [
  {
    name: "notificationPreferencesSchema",
    schema: notificationPreferencesSchema,
    valid: { important: true, resultEmails: true, announcementEmails: true },
  },
  { name: "changeEmailSchema", schema: changeEmailSchema, valid: { email: "player@example.com" } },
  {
    name: "emailAnnouncementsSchema",
    schema: emailAnnouncementsSchema,
    valid: { emailAnnouncements: true },
  },
  { name: "profileEditSchema", schema: profileEditSchema, valid: { fullName: "Player One" } },
  {
    name: "organiserProfileEditSchema",
    schema: organiserProfileEditSchema,
    valid: { organisationName: "Example Org" },
  },
  {
    name: "tournamentUpdateSchema",
    schema: tournamentUpdateSchema,
    valid: { name: "Example Tournament" },
  },
  {
    name: "fixtureMatchdayUpdateSchema",
    schema: fixtureMatchdayUpdateSchema,
    valid: { startsOn: "2026-11-26", endsOn: "2026-11-27" },
  },
  {
    name: "announcementContentSchema",
    schema: announcementContentSchema,
    valid: {
      title: "Platform notice",
      body: "A long enough announcement body.",
      severity: "info",
      pinned: false,
    },
  },
  {
    name: "platformSettingsSchema",
    schema: platformSettingsSchema,
    valid: {
      maintenanceMode: false,
      maintenanceMessage: "",
      registrationsOpen: true,
      maxActiveTournamentsPerOrganiser: 3,
      applicationCooldownDays: 7,
    },
  },
] as const;

describe("PATCH body schemas", () => {
  it.each(patchSchemas)("$name rejects injected privileged fields", ({ schema, valid }) => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, role: "super_admin", uid: "victim" }).success).toBe(false);
  });
});
