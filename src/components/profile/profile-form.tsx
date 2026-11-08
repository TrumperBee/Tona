"use client";

// GCC - edit the editable part of a profile.
//
// The schema is strict: gamer tag, email, role, status and avatar URLs are not
// accepted here. The server updates the private and public documents together.
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { CountryCombobox } from "@/components/auth/country-combobox";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select } from "@/components/ui/input";
import {
  GAMES,
  getGamePlatforms,
  PLATFORMS,
  type GameId,
  type PlatformId,
} from "@/lib/config/games";
import { profileEditSchema } from "@/lib/validation/profile";

export interface ProfileFormProps {
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly initial: {
    readonly fullName: string;
    readonly community: string | null;
    readonly favouriteClub: string | null;
    readonly whatsappE164: string | null;
    readonly country: string;
    readonly preferredGame: GameId;
    readonly platform: PlatformId;
  };
}

export function ProfileForm({ gamerTag, avatarUrl, initial }: ProfileFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    fullName: initial.fullName,
    community: initial.community ?? "",
    favouriteClub: initial.favouriteClub ?? "",
    whatsapp: initial.whatsappE164 ?? "",
    country: initial.country,
    preferredGame: initial.preferredGame,
    platform: initial.platform,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const platformOptions = useMemo(
    () =>
      PLATFORMS.filter((platform) => getGamePlatforms(values.preferredGame).includes(platform.id)),
    [values.preferredGame],
  );

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const payload = {
      fullName: values.fullName,
      community: values.community.trim() ? values.community : null,
      favouriteClub: values.favouriteClub.trim() ? values.favouriteClub : null,
      whatsapp: values.whatsapp.trim() ? values.whatsapp : null,
      country: values.country,
      preferredGame: values.preferredGame,
      platform: values.platform,
    };
    const parsed = profileEditSchema.safeParse(payload);

    if (!parsed.success) {
      const errors: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (typeof field === "string" && !errors[field]) {
          errors[field] = issue.message;
        }
      }

      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!response.ok) {
        setFieldErrors(body.fieldErrors ?? {});
        setFormError(body.error ?? "We could not save your profile. Try again.");
        return;
      }

      router.push("/dashboard/profile");
      router.refresh();
    } catch {
      setFormError("The connection failed. Check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm leading-6 text-danger-soft"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{formError}</p>
        </div>
      ) : null}

      <div className="rounded-lg border border-white/10 bg-navy-900/50 p-4">
        <AvatarUploader name={gamerTag} initialAvatarUrl={avatarUrl} />
      </div>

      <FormField
        htmlFor="fullName"
        label="Full name"
        required
        hint="Shown on your profile. Use at most 60 characters."
        error={fieldErrors.fullName}
      >
        <Input
          value={values.fullName}
          onChange={(event) => update("fullName", event.target.value)}
          autoComplete="name"
          maxLength={60}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="community"
          label="Community"
          optional
          hint="Club, group or community you represent."
          error={fieldErrors.community}
        >
          <Input
            value={values.community}
            onChange={(event) => update("community", event.target.value)}
            maxLength={40}
          />
        </FormField>

        <FormField
          htmlFor="favouriteClub"
          label="Favourite club"
          optional
          hint="Plain text. Club logos are not used."
          error={fieldErrors.favouriteClub}
        >
          <Input
            value={values.favouriteClub}
            onChange={(event) => update("favouriteClub", event.target.value)}
            maxLength={40}
          />
        </FormField>
      </div>

      <FormField
        htmlFor="country"
        label="Country"
        required
        hint="Used for your flag and regional display."
        error={fieldErrors.country}
      >
        <CountryCombobox
          id="country"
          value={values.country}
          onChange={(country) => update("country", country)}
          invalid={Boolean(fieldErrors.country)}
          required
        />
      </FormField>

      <FormField
        htmlFor="whatsapp"
        label="WhatsApp number"
        optional
        hint="Private. It is stored as an international number and never appears on your public profile."
        error={fieldErrors.whatsapp}
      >
        <Input
          type="tel"
          value={values.whatsapp}
          onChange={(event) => update("whatsapp", event.target.value)}
          autoComplete="tel"
          inputMode="tel"
          placeholder="+254 712 345 678"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="preferredGame" label="Preferred game" required>
          <Select
            value={values.preferredGame}
            onChange={(event) => {
              const game = event.target.value as GameId;
              update("preferredGame", game);
              const platforms = getGamePlatforms(game);

              if (!platforms.includes(values.platform)) {
                update("platform", platforms[0] ?? "android");
              }
            }}
          >
            {GAMES.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField htmlFor="platform" label="Platform" required>
          <Select
            value={values.platform}
            onChange={(event) => update("platform", event.target.value as PlatformId)}
          >
            {platformOptions.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-grey-400">
        Your gamer tag and email address are not editable here. The gamer tag anchors your
        competitive record; contact the GCC team if it needs correction.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={submitting} loadingLabel="Saving">
          Save changes
        </Button>
        <Link
          href="/dashboard/profile"
          className="text-sm font-semibold text-grey-300 underline-offset-4 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
