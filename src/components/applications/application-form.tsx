"use client";

// GCC - organiser application form.
//
// Every field is checked again by the server route with the same strict schema.
// Identity, email and status are never sent from this component.
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { GAMES } from "@/lib/config/games";
import { COMMUNITY_TYPE_LABELS } from "@/lib/applications/labels";
import { COMMUNITY_TYPES, EXPECTED_PLAYER_RANGES, type CommunityType } from "@/types/domain";

const EXPERIENCE_MIN = 50;
const MOTIVATION_MIN = 50;

interface FormState {
  communityName: string;
  communityType: CommunityType | "";
  communityLink: string;
  expectedPlayers: string;
  gamesPlanned: string[];
  experience: string;
  motivation: string;
  agreesToRules: boolean;
}

const emptyForm: FormState = {
  communityName: "",
  communityType: "",
  communityLink: "",
  expectedPlayers: "",
  gamesPlanned: [],
  experience: "",
  motivation: "",
  agreesToRules: false,
};

export function ApplicationForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setError(null);
  }

  function toggleGame(gameId: string) {
    setForm((current) => ({
      ...current,
      gamesPlanned: current.gamesPlanned.includes(gameId)
        ? current.gamesPlanned.filter((id) => id !== gameId)
        : [...current.gamesPlanned, gameId],
    }));
    setFieldErrors((current) => ({ ...current, gamesPlanned: "" }));
    setError(null);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      communityName: form.communityName,
      communityType: form.communityType,
      communityLink: form.communityLink.trim() || null,
      expectedPlayers: form.expectedPlayers,
      gamesPlanned: form.gamesPlanned,
      experience: form.experience,
      motivation: form.motivation,
      agreesToRules: form.agreesToRules,
    };

    try {
      const response = await fetch("/api/admin-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
        reapplyAt?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "The application could not be submitted.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setSubmitted(true);
      router.refresh();
    } catch {
      setError("The application could not be submitted. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <Card variant="gold">
        <CardContent className="flex items-start gap-4 p-6">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-gold-300" />
          <div>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-display text-white">
              Application received
            </h2>
            <p className="mt-2 text-sm leading-6 text-grey-300">
              The Super Admin will review it. You will receive a notification and this page will
              show the outcome.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Organiser application</CardTitle>
        <p className="mt-2 text-sm leading-6 text-grey-400">
          Tell us about your community and how you run competitions. Applications are reviewed
          manually; approval is never automatic.
        </p>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <CardContent className="space-y-6">
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger-soft"
            >
              {error}
            </div>
          ) : null}

          <FormField
            htmlFor="communityName"
            label="Community name"
            required
            hint="2-60 characters. This is the name players will recognise."
            error={fieldErrors.communityName}
          >
            <Input
              id="communityName"
              value={form.communityName}
              maxLength={60}
              onChange={(event) => update("communityName", event.currentTarget.value)}
              placeholder="e.g. Lagos Elite FC"
            />
          </FormField>

          <FormField
            htmlFor="communityType"
            label="Community type"
            required
            error={fieldErrors.communityType}
          >
            <Select
              id="communityType"
              value={form.communityType}
              onChange={(event) =>
                update("communityType", event.currentTarget.value as CommunityType)
              }
            >
              <option value="">Choose a community type</option>
              {COMMUNITY_TYPES.map((value) => (
                <option key={value} value={value}>
                  {COMMUNITY_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            htmlFor="communityLink"
            label="Community link"
            optional
            hint="An https:// link to your group, channel or page. Leave blank if you do not have one."
            error={fieldErrors.communityLink}
          >
            <Input
              id="communityLink"
              type="url"
              inputMode="url"
              value={form.communityLink}
              onChange={(event) => update("communityLink", event.currentTarget.value)}
              placeholder="https://"
            />
          </FormField>

          <FormField
            htmlFor="expectedPlayers"
            label="Expected players"
            required
            hint="A realistic range for the competitions you want to run."
            error={fieldErrors.expectedPlayers}
          >
            <Select
              id="expectedPlayers"
              value={form.expectedPlayers}
              onChange={(event) => update("expectedPlayers", event.currentTarget.value)}
            >
              <option value="">Choose a range</option>
              {EXPECTED_PLAYER_RANGES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FormField>

          <fieldset>
            <legend className="text-sm font-medium text-grey-100">
              Games you plan to run
              <span aria-hidden="true" className="ml-1 text-danger-soft">
                *
              </span>
            </legend>
            <p className="mt-1 text-xs leading-5 text-grey-400">
              Choose at least one supported game.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {GAMES.map((game) => (
                <Checkbox
                  key={game.id}
                  id={`game-${game.id}`}
                  label={game.name}
                  checked={form.gamesPlanned.includes(game.id)}
                  onChange={() => toggleGame(game.id)}
                />
              ))}
            </div>
            {fieldErrors.gamesPlanned ? (
              <p role="alert" className="mt-2 text-xs font-medium text-danger-soft">
                {fieldErrors.gamesPlanned}
              </p>
            ) : null}
          </fieldset>

          <FormField
            htmlFor="experience"
            label="Experience"
            required
            hint={`${EXPERIENCE_MIN}-1000 characters. Tell us what you have organised before.`}
            error={fieldErrors.experience}
          >
            <Textarea
              id="experience"
              value={form.experience}
              rows={5}
              maxLength={1000}
              onChange={(event) => update("experience", event.currentTarget.value)}
              placeholder="Competitions, leagues or events you have run, and for how many players."
            />
          </FormField>

          <FormField
            htmlFor="motivation"
            label="Why do you want to organise on GCC?"
            required
            hint={`${MOTIVATION_MIN}-1000 characters.`}
            error={fieldErrors.motivation}
          >
            <Textarea
              id="motivation"
              value={form.motivation}
              rows={5}
              maxLength={1000}
              onChange={(event) => update("motivation", event.currentTarget.value)}
              placeholder="What you want to build for your community and how you will run it fairly."
            />
          </FormField>

          <div>
            <Checkbox
              id="agreesToRules"
              checked={form.agreesToRules}
              onChange={(event) => update("agreesToRules", event.currentTarget.checked)}
              label={
                <>
                  I have read and agree to the{" "}
                  <Link
                    href="/organiser-code"
                    className="font-semibold text-electric-300 underline-offset-4 hover:underline"
                  >
                    organiser code of conduct
                  </Link>
                  .
                </>
              }
            />
            {fieldErrors.agreesToRules ? (
              <p role="alert" className="mt-2 text-xs font-medium text-danger-soft">
                {fieldErrors.agreesToRules}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
            <Button type="submit" loading={saving} loadingLabel="Submitting">
              Submit application
            </Button>
            <p className="text-xs text-grey-500">
              One pending application at a time. Rejected applicants may reapply after the cooldown.
            </p>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
