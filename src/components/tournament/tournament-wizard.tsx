"use client";

// GCC - tournament creation wizard (Phase 8).
//
// Five steps: basics (creates the draft), schedule (naive wall-clock times in
// the competition's timezone, converted with the shared zoned-date helpers),
// branding (secure server-side uploads), rules and entry restrictions, and a
// review that publishes or keeps the draft. Every value is re-validated and
// re-authorised on the server; the client validation only shapes the
// experience. Nothing is faked: a step that cannot be saved says so.
import { Check, ChevronLeft, ChevronRight, FileText, Rocket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ZodError } from "zod";

import { CountryPicker } from "@/components/tournament/country-picker";
import { TournamentImageUploader } from "@/components/tournament/tournament-image-uploader";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { countryName } from "@/lib/config/countries";
import {
  DEFAULT_MATCH_DURATION_MINUTES,
  MATCH_DURATION_MINUTES_OPTIONS,
  STARTER_RULES_TEMPLATE,
} from "@/lib/config/formats";
import { GAMES, getGame, getGamePlatforms, type GameId, type PlatformId } from "@/lib/config/games";
import { DEFAULT_TOURNAMENT_TIMEZONE, timezoneOptions } from "@/lib/config/timezones";
import { isNaiveDateTime, zonedToUtcIso } from "@/lib/utils/zoned-dates";
import {
  tournamentBasicsSchema,
  validateStartsAtHorizon,
  validateTournamentDates,
} from "@/lib/validation/tournament";
import { cn } from "@/lib/utils/cn";

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: readonly { readonly id: Step; readonly label: string }[] = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Schedule" },
  { id: 3, label: "Branding" },
  { id: 4, label: "Rules & entry" },
  { id: 5, label: "Review" },
];

const MAX_DESCRIPTION = 1000;
const MAX_RULES = 4000;

interface ApiResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: {
    readonly error?: string;
    readonly fields?: Record<string, string>;
    readonly tournamentId?: string;
    readonly slug?: string;
  };
}

async function requestJson(url: string, init: RequestInit): Promise<ApiResponse> {
  try {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => ({}))) as ApiResponse["body"];

    return { ok: response.ok, status: response.status, body };
  } catch {
    return {
      ok: false,
      status: 0,
      body: { error: "The connection failed. Check your network and try again." },
    };
  }
}

function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !fields[field]) {
      fields[field] = issue.message;
    }
  }

  return fields;
}

export function TournamentWizard() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  // Step 1: basics.
  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [gameId, setGameId] = useState<GameId>("efootball");
  const [description, setDescription] = useState("");

  // Step 2: schedule (naive wall-clock values in the competition timezone).
  const [timezone, setTimezone] = useState<string>(DEFAULT_TOURNAMENT_TIMEZONE);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [startsAt, setStartsAt] = useState("");

  // Step 3: branding (uploads persist immediately; the wizard only remembers).
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Step 4: rules and entry restrictions.
  const [rules, setRules] = useState("");
  const [matchDurationMinutes, setMatchDurationMinutes] = useState<number>(
    DEFAULT_MATCH_DURATION_MINUTES,
  );
  const [allowedPlatforms, setAllowedPlatforms] = useState<readonly PlatformId[]>(
    getGamePlatforms("efootball"),
  );
  const [allowedCountries, setAllowedCountries] = useState<readonly string[]>([]);

  // Shared UI state.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const game = getGame(gameId);
  const gamePlatforms = game.platforms;
  const allPlatformsAllowed = allowedPlatforms.length === gamePlatforms.length;

  function resetErrors(): void {
    setFieldErrors({});
    setFormError(null);
  }

  function applyResponse(failure: ApiResponse, fallback: string): void {
    setFieldErrors(failure.body.fields ?? {});
    setFormError(failure.body.error ?? fallback);
  }

  function changeGame(next: GameId): void {
    setGameId(next);
    // Platform restrictions restart from the new game's full support list.
    setAllowedPlatforms(getGamePlatforms(next));
  }

  function togglePlatform(platform: PlatformId): void {
    setAllowedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((value) => value !== platform)
        : [...current, platform],
    );
  }

  /** Step 1: create the draft (first save) or patch the basics (later edits). */
  async function saveBasics(): Promise<void> {
    resetErrors();

    const parsed = tournamentBasicsSchema.safeParse({ name, season, gameId, description });

    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    setSaving(true);

    try {
      const response = tournamentId
        ? await requestJson(`/api/organiser/tournaments/${tournamentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
          })
        : await requestJson("/api/organiser/tournaments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
          });

      if (!response.ok) {
        applyResponse(
          response,
          tournamentId
            ? "We could not save those details. Try again."
            : "We could not create the draft. Try again.",
        );
        return;
      }

      if (response.body.tournamentId) {
        setTournamentId(response.body.tournamentId);
        setSlug(response.body.slug ?? null);
      }

      setStep(2);
    } finally {
      setSaving(false);
    }
  }

  /** Step 2: convert naive wall-clock times to UTC and patch the schedule. */
  async function saveSchedule(): Promise<void> {
    resetErrors();

    const errors: Record<string, string> = {};

    for (const [field, value] of [
      ["registrationOpensAt", opensAt],
      ["registrationClosesAt", closesAt],
      ["startsAt", startsAt],
    ] as const) {
      if (!isNaiveDateTime(value)) {
        errors[field] = "Choose a date and time.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const dates = {
      registrationOpensAt: new Date(zonedToUtcIso(opensAt, timezone)),
      registrationClosesAt: new Date(zonedToUtcIso(closesAt, timezone)),
      startsAt: new Date(zonedToUtcIso(startsAt, timezone)),
    };

    Object.assign(errors, validateTournamentDates(dates));

    const horizon = validateStartsAtHorizon(dates.startsAt, new Date());

    if (horizon) {
      errors.startsAt = horizon;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);

    try {
      const response = await requestJson(`/api/organiser/tournaments/${tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          registrationOpensAt: dates.registrationOpensAt.toISOString(),
          registrationClosesAt: dates.registrationClosesAt.toISOString(),
          startsAt: dates.startsAt.toISOString(),
        }),
      });

      if (!response.ok) {
        applyResponse(response, "We could not save the schedule. Try again.");
        return;
      }

      setStep(3);
    } finally {
      setSaving(false);
    }
  }

  /** Step 4: rules, match length and entry restrictions. */
  async function saveRulesAndEntry(): Promise<void> {
    resetErrors();

    const errors: Record<string, string> = {};

    if (rules.trim().length > MAX_RULES) {
      errors.rules = `Keep the rules under ${MAX_RULES} characters.`;
    }

    if (allowedPlatforms.length === 0) {
      errors.allowedPlatforms = "Allow at least one platform.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);

    try {
      const response = await requestJson(`/api/organiser/tournaments/${tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules,
          matchDurationMinutes,
          allowedPlatforms,
          allowedCountries,
        }),
      });

      if (!response.ok) {
        applyResponse(response, "We could not save the rules and restrictions. Try again.");
        return;
      }

      setStep(5);
    } finally {
      setSaving(false);
    }
  }

  async function publish(): Promise<void> {
    if (!tournamentId || publishing) {
      return;
    }

    resetErrors();
    setPublishing(true);

    try {
      const response = await requestJson(`/api/organiser/tournaments/${tournamentId}/publish`, {
        method: "POST",
      });

      if (!response.ok) {
        applyResponse(
          response,
          "We could not publish this competition. Check the review and try again.",
        );
        return;
      }

      router.push(`/organiser/tournaments/${tournamentId}`);
    } finally {
      setPublishing(false);
    }
  }

  function continueStep(): void {
    if (step === 1) {
      void saveBasics();
    } else if (step === 2) {
      void saveSchedule();
    } else if (step === 3) {
      resetErrors();
      setStep(4);
    } else if (step === 4) {
      void saveRulesAndEntry();
    }
  }

  const stepFields: Record<string, string> = fieldErrors;

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Wizard progress">
        {STEPS.map((entry, index) => {
          const done = step > entry.id;
          const current = step === entry.id;

          return (
            <li key={entry.id} className="flex items-center gap-2">
              <span
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                  current
                    ? "border-electric-400/60 bg-electric-500/15 text-white"
                    : done
                      ? "border-success/40 bg-success/10 text-success-soft"
                      : "border-white/10 bg-navy-900/60 text-grey-400",
                )}
              >
                {done ? (
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <span className="tabular-nums">{entry.id}</span>
                )}
                {entry.label}
              </span>
              {index < STEPS.length - 1 ? (
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-grey-600" />
              ) : null}
            </li>
          );
        })}
      </ol>

      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger-soft"
        >
          {formError}
        </p>
      ) : null}

      {/* Step 1: basics */}
      {step === 1 ? (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-grey-400">
              Saving this step creates a private draft. Only you can see it until you publish it.
              The format is fixed: the 36-team league phase used by every GCC competition.
            </p>

            <FormField
              htmlFor="wizard-name"
              label="Tournament name"
              hint="Shown on cards, lists and the competition page. 3-80 characters."
              error={stepFields.name}
              required
            >
              <Input
                id="wizard-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Nairobi eFootball Champions Cup"
              />
            </FormField>

            <FormField
              htmlFor="wizard-season"
              label="Season"
              hint="For example 2026/27. Part of the public page address."
              error={stepFields.season}
              required
            >
              <Input
                id="wizard-season"
                value={season}
                onChange={(event) => setSeason(event.target.value)}
                maxLength={40}
                placeholder="2026/27"
              />
            </FormField>

            <FormField
              htmlFor="wizard-game"
              label="Game"
              hint="Entries are only accepted on the platforms this game supports."
              error={stepFields.gameId}
              required
            >
              <Select
                id="wizard-game"
                value={gameId}
                onChange={(event) => changeGame(event.target.value as GameId)}
              >
                {GAMES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              htmlFor="wizard-description"
              label="Short description"
              hint={`Up to ${MAX_DESCRIPTION} characters. Shown at the top of the competition page.`}
              error={stepFields.description}
              required
            >
              <Textarea
                id="wizard-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={MAX_DESCRIPTION + 1}
                placeholder="What makes this competition worth entering?"
              />
              <p className="mt-1 text-right text-xs tabular-nums text-grey-500">
                {description.length} / {MAX_DESCRIPTION}
              </p>
            </FormField>
          </CardContent>
        </Card>
      ) : null}

      {/* Step 2: schedule */}
      {step === 2 ? (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-grey-400">
              Enter the times as wall-clock times in the competition&apos;s timezone — exactly what
              players will see. The platform stores them in UTC and shows them in this timezone with
              a local-time toggle.
            </p>

            <FormField
              htmlFor="wizard-timezone"
              label="Competition timezone"
              hint="Every published time on the tournament page uses this timezone."
              error={stepFields.timezone}
              required
            >
              <Select
                id="wizard-timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {timezoneOptions().map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid gap-5 sm:grid-cols-3">
              <FormField
                htmlFor="wizard-opens"
                label="Registration opens"
                error={stepFields.registrationOpensAt}
                required
              >
                <Input
                  id="wizard-opens"
                  type="datetime-local"
                  value={opensAt}
                  onChange={(event) => setOpensAt(event.target.value)}
                />
              </FormField>

              <FormField
                htmlFor="wizard-closes"
                label="Registration closes"
                error={stepFields.registrationClosesAt}
                required
              >
                <Input
                  id="wizard-closes"
                  type="datetime-local"
                  value={closesAt}
                  onChange={(event) => setClosesAt(event.target.value)}
                />
              </FormField>

              <FormField
                htmlFor="wizard-starts"
                label="Competition starts"
                hint="No earlier than the registration deadline, within 18 months."
                error={stepFields.startsAt}
                required
              >
                <Input
                  id="wizard-starts"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </FormField>
            </div>

            <p className="rounded-lg border border-white/10 bg-navy-950/50 p-3 text-xs leading-5 text-grey-500">
              The draft is saved. You can leave any time and continue from the tournament&apos;s
              settings page.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Step 3: branding */}
      {step === 3 ? (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <p className="text-sm leading-6 text-grey-400">
              Both images are optional — publishing works without them and honest placeholders show
              until you upload one. Files are uploaded with the platform&apos;s own credentials; a
              URL is never sent from your browser.
            </p>

            {tournamentId ? (
              <>
                <div className="space-y-3">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-display text-white">
                    Cover image
                  </h3>
                  <TournamentImageUploader
                    kind="cover"
                    tournamentId={tournamentId}
                    name={name.trim() || "Your tournament"}
                    initialUrl={coverUrl}
                    onChange={setCoverUrl}
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-display text-white">
                    Logo
                  </h3>
                  <TournamentImageUploader
                    kind="logo"
                    tournamentId={tournamentId}
                    name={name.trim() || "Your tournament"}
                    initialUrl={logoUrl}
                    onChange={setLogoUrl}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Step 4: rules and entry restrictions */}
      {step === 4 ? (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Rules &amp; entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-grey-400">
              Players must accept these rules to enter, and the full text is shown before
              registration. Restrictions are checked again on the server for every entry.
            </p>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <FormField
                htmlFor="wizard-rules"
                label="Competition rules"
                hint={`Up to ${MAX_RULES} characters. Players see the full text before they enter.`}
                error={stepFields.rules}
                required
                className="min-w-0 flex-1"
              >
                <Textarea
                  id="wizard-rules"
                  value={rules}
                  onChange={(event) => setRules(event.target.value)}
                  rows={12}
                  maxLength={MAX_RULES + 1}
                  placeholder="Entry rules, match rules, fair play and dispute handling."
                />
                <p className="mt-1 text-right text-xs tabular-nums text-grey-500">
                  {rules.length} / {MAX_RULES}
                </p>
              </FormField>
            </div>

            {rules.trim().length === 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<FileText aria-hidden="true" className="h-4 w-4" />}
                onClick={() => setRules(STARTER_RULES_TEMPLATE)}
              >
                Insert the starter template
              </Button>
            ) : null}

            <FormField
              htmlFor="wizard-duration"
              label="Match length"
              hint="Minutes per match, shown on the tournament page."
              error={stepFields.matchDurationMinutes}
              required
            >
              <Select
                id="wizard-duration"
                value={String(matchDurationMinutes)}
                onChange={(event) => setMatchDurationMinutes(Number(event.target.value))}
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
                {game.name} supports {gamePlatforms.length} platforms. Leave all selected to accept
                every one of them.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {gamePlatforms.map((platform) => (
                  <label
                    key={platform}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/10 bg-navy-950/50 px-3 py-2.5 text-sm text-grey-200 transition-colors hover:border-electric-400/30"
                  >
                    <Checkbox
                      checked={allowedPlatforms.includes(platform)}
                      onChange={() => togglePlatform(platform)}
                    />
                    {platformLabel(platform)}
                  </label>
                ))}
              </div>
              {stepFields.allowedPlatforms ? (
                <p role="alert" className="text-sm font-medium text-danger-soft">
                  {stepFields.allowedPlatforms}
                </p>
              ) : null}
              {allPlatformsAllowed ? (
                <p className="text-xs text-grey-500">
                  All platforms selected — every supported platform can enter.
                </p>
              ) : null}
            </fieldset>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="wizard-countries" className="text-sm font-semibold text-grey-300">
                  Allowed countries
                </label>
                <p className="text-xs text-grey-500">
                  {allowedCountries.length === 0
                    ? "None selected — players from every country are welcome."
                    : `${allowedCountries.length} selected`}
                </p>
              </div>
              <CountryPicker
                id="wizard-countries"
                selected={allowedCountries}
                onChange={setAllowedCountries}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Step 5: review */}
      {step === 5 ? (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Review &amp; publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm leading-6 text-grey-400">
              Publishing moves the competition to &quot;registration open&quot; immediately and it
              appears in public tournament lists. Check every detail — after players register, some
              fields lock.
            </p>

            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Name", value: name },
                { label: "Season", value: season },
                {
                  label: "Game",
                  value: `${game.name} (${allPlatformsAllowed ? "all platforms" : `${allowedPlatforms.length} of ${gamePlatforms.length} platforms`})`,
                },
                { label: "Timezone", value: timezone },
                {
                  label: "Registration opens",
                  value: opensAt ? `${opensAt.replace("T", " ")} (${timezone})` : "—",
                },
                {
                  label: "Registration closes",
                  value: closesAt ? `${closesAt.replace("T", " ")} (${timezone})` : "—",
                },
                {
                  label: "Competition starts",
                  value: startsAt ? `${startsAt.replace("T", " ")} (${timezone})` : "—",
                },
                { label: "Match length", value: `${matchDurationMinutes} minutes` },
                { label: "Field size", value: "36 players (36-team league phase)" },
                {
                  label: "Countries",
                  value:
                    allowedCountries.length === 0
                      ? "Every country"
                      : allowedCountries.map((code) => countryName(code) ?? code).join(", "),
                },
                { label: "Cover image", value: coverUrl ? "Uploaded" : "Placeholder" },
                { label: "Logo", value: logoUrl ? "Uploaded" : "Placeholder" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border border-white/10 bg-navy-950/50 p-3.5"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-grey-100">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-3 rounded-lg border border-white/10 bg-navy-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                Description
              </p>
              <p className="text-sm leading-6 text-grey-300">{description}</p>
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                Rules ({rules.length} characters)
              </p>
              <p className="max-h-40 overflow-y-auto whitespace-pre-line text-sm leading-6 text-grey-300">
                {rules}
              </p>
            </div>

            {slug ? (
              <p className="text-xs text-grey-500">
                Public address after publishing: /tournaments/{slug}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => void publish()}
                loading={publishing}
                loadingLabel="Publishing"
                leftIcon={<Rocket aria-hidden="true" className="h-4 w-4" />}
              >
                Publish competition
              </Button>
              {tournamentId ? (
                <Link
                  href={`/organiser/tournaments/${tournamentId}/settings`}
                  className={buttonStyles({ variant: "secondary", size: "md" })}
                >
                  Keep as draft
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {step > 1 ? (
          <Button
            variant="secondary"
            leftIcon={<ChevronLeft aria-hidden="true" className="h-4 w-4" />}
            onClick={() => {
              resetErrors();
              setStep((current) => (current - 1) as Step);
            }}
            disabled={saving || publishing}
          >
            Back
          </Button>
        ) : (
          <Link
            href="/organiser/tournaments"
            className={buttonStyles({ variant: "ghost", size: "md" })}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            Cancel
          </Link>
        )}

        {step < 5 ? (
          <Button
            onClick={continueStep}
            loading={saving}
            loadingLabel="Saving"
            rightIcon={<ChevronRight aria-hidden="true" className="h-4 w-4" />}
          >
            {step === 1
              ? tournamentId
                ? "Save & continue"
                : "Create draft & continue"
              : "Save & continue"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function platformLabel(id: PlatformId): string {
  const labels: Record<PlatformId, string> = {
    android: "Android",
    ios: "iOS",
    pc: "PC",
    playstation: "PlayStation",
    xbox: "Xbox",
  };

  return labels[id];
}
