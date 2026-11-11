"use client";

// GCC - tournament settings editor.
//
// The editable-fields matrix computed on the server decides which controls are
// enabled; the same matrix is re-enforced inside the PATCH transaction, so the
// UI can only ever preview what the server allows. Locked fields render with
// the honest reason. Only changed fields are sent — an unchanged registration
// deadline must not trip the extend-only rule.
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CountryPicker } from "@/components/tournament/country-picker";
import { TournamentImageUploader } from "@/components/tournament/tournament-image-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { countryName } from "@/lib/config/countries";
import { MATCH_DURATION_MINUTES_OPTIONS, STARTER_RULES_TEMPLATE } from "@/lib/config/formats";
import { GAMES, getGame, getGamePlatforms, type GameId, type PlatformId } from "@/lib/config/games";
import { timezoneOptions } from "@/lib/config/timezones";
import { isNaiveDateTime, zonedToUtcIso } from "@/lib/utils/zoned-dates";
import { validateStartsAtHorizon } from "@/lib/validation/tournament";
import type { TournamentStatus } from "@/types/domain";

export interface TournamentSettingsInitial {
  readonly name: string;
  readonly season: string;
  readonly gameId: GameId;
  readonly description: string;
  readonly timezone: string;
  /** Naive wall-clock values in the stored competition timezone. */
  readonly opensAt: string;
  readonly closesAt: string;
  readonly startsAt: string;
  readonly coverImageUrl: string | null;
  readonly logoUrl: string | null;
  readonly rules: string;
  readonly matchDurationMinutes: number;
  readonly allowedPlatforms: readonly PlatformId[] | null;
  readonly allowedCountries: readonly string[] | null;
}

export interface TournamentSettingsFormProps {
  readonly tournamentId: string;
  readonly name: string;
  readonly status: TournamentStatus;
  readonly initial: TournamentSettingsInitial;
  /** Fields the server currently accepts in a patch (editable-fields matrix). */
  readonly editable: readonly string[];
}

const MAX_DESCRIPTION = 1000;
const MAX_RULES = 4000;

const PLATFORM_LABELS: Readonly<Record<PlatformId, string>> = {
  android: "Android",
  ios: "iOS",
  pc: "PC",
  playstation: "PlayStation",
  xbox: "Xbox",
};

export function TournamentSettingsForm({
  tournamentId,
  name,
  status,
  initial,
  editable,
}: TournamentSettingsFormProps) {
  const router = useRouter();
  const isDraft = status === "draft";
  const can = (field: string): boolean => editable.includes(field);

  const [values, setValues] = useState({
    name: initial.name,
    season: initial.season,
    gameId: initial.gameId,
    description: initial.description,
    timezone: initial.timezone,
    opensAt: initial.opensAt,
    closesAt: initial.closesAt,
    startsAt: initial.startsAt,
    rules: initial.rules,
    matchDurationMinutes: initial.matchDurationMinutes,
    allowedPlatforms: initial.allowedPlatforms ?? getGamePlatforms(initial.gameId),
    allowedCountries: initial.allowedCountries ?? [],
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const game = getGame(values.gameId);
  const gamePlatforms = game.platforms;

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function changeGame(next: GameId): void {
    setValues((current) => ({
      ...current,
      gameId: next,
      // Restrictions restart from the new game's full support list.
      allowedPlatforms: getGamePlatforms(next),
    }));
    setSaved(false);
  }

  function togglePlatform(platform: PlatformId): void {
    set(
      "allowedPlatforms",
      values.allowedPlatforms.includes(platform)
        ? values.allowedPlatforms.filter((value) => value !== platform)
        : [...values.allowedPlatforms, platform],
    );
  }

  async function save(): Promise<void> {
    setFieldErrors({});
    setFormError(null);
    setSaved(false);

    // Only changed fields are sent. Unchanged values (especially the
    // registration deadline) must not re-trigger extend-only checks.
    const patch: Record<string, unknown> = {};

    if (values.name !== initial.name) patch.name = values.name;
    if (values.season !== initial.season) patch.season = values.season;
    if (values.gameId !== initial.gameId) patch.gameId = values.gameId;
    if (values.description !== initial.description) patch.description = values.description;
    if (values.timezone !== initial.timezone) patch.timezone = values.timezone;
    if (values.rules !== initial.rules) patch.rules = values.rules;
    if (values.matchDurationMinutes !== initial.matchDurationMinutes) {
      patch.matchDurationMinutes = values.matchDurationMinutes;
    }

    const datesChanged = {
      registrationOpensAt: values.opensAt !== initial.opensAt,
      registrationClosesAt: values.closesAt !== initial.closesAt,
      startsAt: values.startsAt !== initial.startsAt,
    };

    if (datesChanged.registrationOpensAt) patch.registrationOpensAt = values.opensAt;
    if (datesChanged.registrationClosesAt) patch.registrationClosesAt = values.closesAt;
    if (datesChanged.startsAt) patch.startsAt = values.startsAt;

    const initialPlatforms = initial.allowedPlatforms ?? getGamePlatforms(initial.gameId);
    const initialCountries = initial.allowedCountries ?? [];

    if (!platformListsEqual(values.allowedPlatforms, initialPlatforms)) {
      patch.allowedPlatforms = values.allowedPlatforms;
    }

    if (!countryListsEqual(values.allowedCountries, initialCountries)) {
      patch.allowedCountries = values.allowedCountries;
    }

    if (Object.keys(patch).length === 0) {
      setFormError("Nothing has changed yet.");
      return;
    }

    // Client-side shape checks; the server re-validates everything.
    const errors: Record<string, string> = {};

    for (const field of ["registrationOpensAt", "registrationClosesAt", "startsAt"] as const) {
      if (patch[field] !== undefined && !isNaiveDateTime(patch[field] as string)) {
        errors[field] = "Choose a date and time.";
      }
    }

    if (patch.rules !== undefined && (patch.rules as string).length > MAX_RULES) {
      errors.rules = `Keep the rules under ${MAX_RULES} characters.`;
    }

    if (patch.description !== undefined && (patch.description as string).length > MAX_DESCRIPTION) {
      errors.description = `Keep the description under ${MAX_DESCRIPTION} characters.`;
    }

    if (
      values.allowedPlatforms.length === 0 &&
      (patch.allowedPlatforms !== undefined || patch.gameId !== undefined)
    ) {
      errors.allowedPlatforms = "Allow at least one platform.";
    }

    // Validate the merged schedule (patch values override stored ones).
    const merged = {
      opensAt: datesChanged.registrationOpensAt
        ? parseNaive(values.opensAt, values.timezone)
        : initial.opensAt
          ? parseNaive(initial.opensAt, initial.timezone)
          : null,
      closesAt: datesChanged.registrationClosesAt
        ? parseNaive(values.closesAt, values.timezone)
        : initial.closesAt
          ? parseNaive(initial.closesAt, initial.timezone)
          : null,
      startsAt: datesChanged.startsAt
        ? parseNaive(values.startsAt, values.timezone)
        : initial.startsAt
          ? parseNaive(initial.startsAt, initial.timezone)
          : null,
    };

    if (merged.opensAt && merged.closesAt && merged.opensAt >= merged.closesAt) {
      errors.registrationClosesAt = "Registration must close after it opens.";
    }

    if (merged.startsAt && merged.closesAt && merged.startsAt < merged.closesAt) {
      errors.startsAt = "The competition cannot start before registration closes.";
    }

    if (merged.startsAt) {
      const horizon = validateStartsAtHorizon(merged.startsAt, new Date());

      if (horizon) {
        errors.startsAt = horizon;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Convert the naive datetimes to ISO strings for the API.
    if (patch.registrationOpensAt !== undefined) {
      patch.registrationOpensAt = zonedToUtcIso(values.opensAt, values.timezone);
    }

    if (patch.registrationClosesAt !== undefined) {
      patch.registrationClosesAt = zonedToUtcIso(values.closesAt, values.timezone);
    }

    if (patch.startsAt !== undefined) {
      patch.startsAt = zonedToUtcIso(values.startsAt, values.timezone);
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/organiser/tournaments/${tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await response.json().catch(() => ({}))) as {
        readonly error?: string;
        readonly fields?: Record<string, string>;
      };

      if (!response.ok) {
        setFieldErrors(body.fields ?? {});
        setFormError(body.error ?? "We could not save these settings. Try again.");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setFormError("The connection failed. Check your network and try again.");
    } finally {
      setSaving(false);
    }
  }

  const lockNotice = (field: string, reason: string): React.ReactNode =>
    can(field) ? null : (
      <p className="text-xs leading-5 text-grey-500">
        <span className="font-semibold text-grey-400">Locked:</span> {reason}
      </p>
    );

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormField
            htmlFor="settings-name"
            label="Tournament name"
            error={fieldErrors.name}
            required={can("name")}
          >
            <Input
              id="settings-name"
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              maxLength={80}
              disabled={!can("name")}
            />
          </FormField>
          {lockNotice(
            "name",
            "players have entered under this name, so it stays until the competition ends.",
          )}

          <FormField
            htmlFor="settings-season"
            label="Season"
            error={fieldErrors.season}
            required={can("season")}
          >
            <Input
              id="settings-season"
              value={values.season}
              onChange={(event) => set("season", event.target.value)}
              maxLength={40}
              disabled={!can("season")}
            />
          </FormField>
          {lockNotice(
            "season",
            "players have entered under this season, so it stays until the competition ends.",
          )}

          <FormField
            htmlFor="settings-game"
            label="Game"
            hint="Changing the game resets the allowed platforms."
            error={fieldErrors.gameId}
            required={can("gameId")}
          >
            <Select
              id="settings-game"
              value={values.gameId}
              onChange={(event) => changeGame(event.target.value as GameId)}
              disabled={!can("gameId")}
            >
              {GAMES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </FormField>
          {lockNotice(
            "gameId",
            "players have entered on this game, so it stays until the competition ends.",
          )}

          <FormField
            htmlFor="settings-description"
            label="Short description"
            hint={`Up to ${MAX_DESCRIPTION} characters.`}
            error={fieldErrors.description}
            required
          >
            <Textarea
              id="settings-description"
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
              rows={4}
              maxLength={MAX_DESCRIPTION + 1}
            />
            <p className="mt-1 text-right text-xs tabular-nums text-grey-500">
              {values.description.length} / {MAX_DESCRIPTION}
            </p>
          </FormField>
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormField
            htmlFor="settings-timezone"
            label="Competition timezone"
            hint="Times below are wall-clock times in this timezone."
            error={fieldErrors.timezone}
            required={can("timezone")}
          >
            <Select
              id="settings-timezone"
              value={values.timezone}
              onChange={(event) => set("timezone", event.target.value)}
              disabled={!can("timezone")}
            >
              {timezoneOptions().map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          {lockNotice(
            "timezone",
            "published times use the competition timezone, so it is fixed once the competition is live.",
          )}

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField
              htmlFor="settings-opens"
              label="Registration opens"
              error={fieldErrors.registrationOpensAt}
              required={can("registrationOpensAt") && !initial.opensAt}
            >
              <Input
                id="settings-opens"
                type="datetime-local"
                value={values.opensAt}
                onChange={(event) => set("opensAt", event.target.value)}
                disabled={!can("registrationOpensAt")}
              />
            </FormField>
            {lockNotice(
              "registrationOpensAt",
              "the opening moment is fixed once the competition is published.",
            )}

            <FormField
              htmlFor="settings-closes"
              label="Registration closes"
              hint={isDraft ? undefined : "Extend-only: the deadline can only move later."}
              error={fieldErrors.registrationClosesAt}
              required={!initial.closesAt}
            >
              <Input
                id="settings-closes"
                type="datetime-local"
                value={values.closesAt}
                onChange={(event) => set("closesAt", event.target.value)}
              />
            </FormField>

            <FormField
              htmlFor="settings-starts"
              label="Competition starts"
              hint="No earlier than the registration deadline."
              error={fieldErrors.startsAt}
              required={!initial.startsAt}
            >
              <Input
                id="settings-starts"
                type="datetime-local"
                value={values.startsAt}
                onChange={(event) => set("startsAt", event.target.value)}
              />
            </FormField>
          </div>

          <p className="rounded-lg border border-white/10 bg-navy-950/50 p-3 text-xs leading-5 text-grey-500">
            Publishing requires all three moments. A missing entry window simply reads as
            &quot;closed&quot; to players — no date is ever guessed.
          </p>
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-3">
            <h3 className="font-display text-sm font-semibold uppercase tracking-display text-white">
              Cover image
            </h3>
            <TournamentImageUploader
              kind="cover"
              tournamentId={tournamentId}
              name={name}
              initialUrl={initial.coverImageUrl}
            />
          </div>

          <div className="space-y-3">
            <h3 className="font-display text-sm font-semibold uppercase tracking-display text-white">
              Logo
            </h3>
            <TournamentImageUploader
              kind="logo"
              tournamentId={tournamentId}
              name={name}
              initialUrl={initial.logoUrl}
            />
          </div>
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Rules &amp; entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormField
            htmlFor="settings-rules"
            label="Competition rules"
            hint={`Up to ${MAX_RULES} characters. Players must accept them to enter.`}
            error={fieldErrors.rules}
          >
            <Textarea
              id="settings-rules"
              value={values.rules}
              onChange={(event) => set("rules", event.target.value)}
              rows={12}
              maxLength={MAX_RULES + 1}
            />
            <p className="mt-1 text-right text-xs tabular-nums text-grey-500">
              {values.rules.length} / {MAX_RULES}
            </p>
          </FormField>

          {values.rules.trim().length === 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => set("rules", STARTER_RULES_TEMPLATE)}
            >
              Insert the starter template
            </Button>
          ) : null}

          <FormField
            htmlFor="settings-duration"
            label="Match length"
            hint="Minutes per match, shown on the tournament page."
            error={fieldErrors.matchDurationMinutes}
            required
          >
            <Select
              id="settings-duration"
              value={String(values.matchDurationMinutes)}
              onChange={(event) => set("matchDurationMinutes", Number(event.target.value))}
            >
              {MATCH_DURATION_MINUTES_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </Select>
          </FormField>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-grey-300">Allowed platforms</legend>
            <p className="text-xs leading-5 text-grey-500">
              {game.name} supports {gamePlatforms.length} platforms.{" "}
              {values.allowedPlatforms.length === gamePlatforms.length
                ? "All are currently accepted."
                : `${values.allowedPlatforms.length} of ${gamePlatforms.length} accepted.`}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {gamePlatforms.map((platform) => (
                <label
                  key={platform}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/10 bg-navy-950/50 px-3 py-2.5 text-sm text-grey-200 transition-colors hover:border-electric-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Checkbox
                    checked={values.allowedPlatforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                    disabled={!can("allowedPlatforms")}
                  />
                  {PLATFORM_LABELS[platform]}
                </label>
              ))}
            </div>
            {fieldErrors.allowedPlatforms ? (
              <p role="alert" className="text-sm font-medium text-danger-soft">
                {fieldErrors.allowedPlatforms}
              </p>
            ) : null}
            {lockNotice(
              "allowedPlatforms",
              "entry restrictions are locked once the first player registers.",
            )}
          </fieldset>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="settings-countries" className="text-sm font-semibold text-grey-300">
                Allowed countries
              </label>
              <p className="text-xs text-grey-500">
                {values.allowedCountries.length === 0
                  ? "Every country is welcome."
                  : `${values.allowedCountries.length} selected: ${values.allowedCountries
                      .map((code) => countryName(code) ?? code)
                      .join(", ")}`}
              </p>
            </div>
            <div className={can("allowedCountries") ? undefined : "opacity-60"}>
              <CountryPicker
                id="settings-countries"
                selected={values.allowedCountries}
                onChange={(codes) => set("allowedCountries", [...codes])}
                disabled={!can("allowedCountries")}
              />
            </div>
            {lockNotice(
              "allowedCountries",
              "entry restrictions are locked once the first player registers.",
            )}
          </div>
        </CardContent>
      </Card>

      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger-soft"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          loading={saving}
          loadingLabel="Saving"
          leftIcon={<Save aria-hidden="true" className="h-4 w-4" />}
        >
          Save changes
        </Button>
        {saved ? (
          <p role="status" className="text-sm font-medium text-success-soft">
            Saved. Every change is recorded in the audit log.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function parseNaive(naive: string, timeZone: string): Date | null {
  return isNaiveDateTime(naive) ? new Date(zonedToUtcIso(naive, timeZone)) : null;
}

function platformListsEqual(left: readonly PlatformId[], right: readonly PlatformId[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function countryListsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}
