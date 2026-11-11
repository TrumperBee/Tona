"use client";

// GCC - registration form.
//
// The server is authoritative for validation and gamer-tag reservation. This
// form provides immediate feedback, then signs the new account in and goes
// straight to the dashboard. There is no email-verification step (ADR-046); the
// confirmation field only guards against a mistyped address.
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { CountryCombobox } from "@/components/auth/country-combobox";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input, Select } from "@/components/ui/input";
import { authErrorMessage, signInWithSession } from "@/lib/auth/client";
import { DEFAULT_COUNTRY_CODE } from "@/lib/config/countries";
import {
  GAMES,
  getGamePlatforms,
  PLATFORMS,
  type GameId,
  type PlatformId,
} from "@/lib/config/games";
import { GAMER_TAG_HINT, validateGamerTag } from "@/lib/validation/gamer-tag";
import { registrationSchema } from "@/lib/validation/registration";

type TagStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "unavailable";

interface TagState {
  readonly status: TagStatus;
  readonly message: string;
}

interface FormValues {
  fullName: string;
  gamerTag: string;
  email: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
  whatsapp: string;
  country: string;
  preferredGame: GameId;
  platform: PlatformId;
  acceptTerms: boolean;
}

const initialValues: FormValues = {
  fullName: "",
  gamerTag: "",
  email: "",
  confirmEmail: "",
  password: "",
  confirmPassword: "",
  whatsapp: "",
  country: DEFAULT_COUNTRY_CODE,
  preferredGame: "efootball",
  platform: "android",
  acceptTerms: false,
};

function SectionLegend({ children }: { readonly children: React.ReactNode }) {
  return (
    <legend className="mb-4 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-display text-grey-200">
      <span aria-hidden="true" className="h-px w-6 bg-electric-400/60" />
      {children}
    </legend>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tagCheck, setTagCheck] = useState<{ tag: string; state: TagState } | null>(null);

  const platformOptions = useMemo(
    () =>
      PLATFORMS.filter((platform) => getGamePlatforms(values.preferredGame).includes(platform.id)),
    [values.preferredGame],
  );

  const trimmedGamerTag = values.gamerTag.trim();
  const gamerTagValidation = trimmedGamerTag ? validateGamerTag(trimmedGamerTag) : null;

  useEffect(() => {
    if (!trimmedGamerTag || gamerTagValidation) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/gamer-tags/check?tag=${encodeURIComponent(trimmedGamerTag)}`,
          {
            signal: controller.signal,
          },
        );
        const data = (await response.json()) as {
          valid?: boolean;
          available?: boolean;
          error?: string;
        };

        if (!response.ok) {
          setTagCheck({
            tag: trimmedGamerTag,
            state: {
              status: "unavailable",
              message:
                "We could not check that tag right now. The server will confirm when you submit.",
            },
          });
          return;
        }

        if (data.valid === false) {
          setTagCheck({
            tag: trimmedGamerTag,
            state: { status: "invalid", message: data.error ?? GAMER_TAG_HINT },
          });
          return;
        }

        setTagCheck({
          tag: trimmedGamerTag,
          state: data.available
            ? { status: "available", message: "That gamer tag is available." }
            : { status: "taken", message: data.error ?? "That gamer tag is already taken." },
        });
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setTagCheck({
            tag: trimmedGamerTag,
            state: {
              status: "unavailable",
              message:
                "We could not check that tag right now. The server will confirm when you submit.",
            },
          });
        }
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedGamerTag, gamerTagValidation]);

  const tagState: TagState = !trimmedGamerTag
    ? { status: "idle", message: "" }
    : gamerTagValidation
      ? { status: "invalid", message: gamerTagValidation }
      : tagCheck && tagCheck.tag === trimmedGamerTag
        ? tagCheck.state
        : { status: "checking", message: "Checking availability..." };

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]): void {
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

    if (values.password !== values.confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    if (values.email.trim().toLowerCase() !== values.confirmEmail.trim().toLowerCase()) {
      setFieldErrors({ confirmEmail: "The email addresses do not match." });
      return;
    }

    const payload = {
      fullName: values.fullName,
      gamerTag: values.gamerTag,
      email: values.email,
      password: values.password,
      whatsapp: values.whatsapp,
      country: values.country,
      preferredGame: values.preferredGame,
      platform: values.platform,
      acceptTerms: values.acceptTerms,
    };
    const parsed = registrationSchema.safeParse(payload);

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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!response.ok) {
        setFieldErrors(body.fieldErrors ?? {});
        setFormError(body.error ?? "We could not create your account. Try again.");
        return;
      }

      try {
        await signInWithSession(parsed.data.email, parsed.data.password);
        router.push("/dashboard");
        router.refresh();
      } catch (error) {
        setFormError(
          `Your account was created, but we could not sign you in automatically. ${authErrorMessage(error)}`,
        );
      }
    } catch {
      setFormError("The connection failed. Check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const tagMessageTone =
    tagState.status === "available"
      ? "text-success-soft"
      : tagState.status === "checking"
        ? "text-grey-400"
        : "text-danger-soft";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm leading-6 text-danger-soft"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{formError}</p>
        </div>
      ) : null}

      <fieldset className="space-y-4">
        <SectionLegend>Account</SectionLegend>

        <FormField
          htmlFor="fullName"
          label="Full name"
          required
          hint="Use the name your community knows you by."
          error={fieldErrors.fullName}
        >
          <Input
            value={values.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            autoComplete="name"
            maxLength={60}
          />
        </FormField>

        <FormField
          htmlFor="email"
          label="Email"
          required
          hint="We send password-reset messages here."
          error={fieldErrors.email}
        >
          <Input
            type="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            autoComplete="email"
            inputMode="email"
          />
        </FormField>

        <FormField
          htmlFor="confirmEmail"
          label="Confirm email"
          required
          hint="Type the same address again to catch a typo."
          error={fieldErrors.confirmEmail}
        >
          <Input
            type="email"
            value={values.confirmEmail}
            onChange={(event) => update("confirmEmail", event.target.value)}
            autoComplete="email"
            inputMode="email"
          />
        </FormField>

        <FormField
          htmlFor="password"
          label="Password"
          required
          hint="At least 6 characters. A longer phrase is easier to remember and safer."
          error={fieldErrors.password}
        >
          <PasswordInput
            id="password"
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
            autoComplete="new-password"
            maxLength={128}
          />
          <PasswordStrength password={values.password} />
        </FormField>

        <FormField
          htmlFor="confirmPassword"
          label="Confirm password"
          required
          error={fieldErrors.confirmPassword}
        >
          <PasswordInput
            id="confirmPassword"
            value={values.confirmPassword}
            onChange={(event) => update("confirmPassword", event.target.value)}
            autoComplete="new-password"
            maxLength={128}
          />
        </FormField>
      </fieldset>

      <fieldset className="space-y-4 border-t border-white/10 pt-6">
        <SectionLegend>Gaming identity</SectionLegend>

        <FormField
          htmlFor="gamerTag"
          label="Gamer tag"
          required
          hint={GAMER_TAG_HINT}
          error={fieldErrors.gamerTag}
        >
          <Input
            value={values.gamerTag}
            onChange={(event) => update("gamerTag", event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={16}
            aria-describedby="gamerTag-hint gamerTag-status"
          />
          {tagState.status !== "idle" ? (
            <p
              id="gamerTag-status"
              className={`mt-1.5 text-xs leading-5 ${tagMessageTone}`}
              role="status"
            >
              {tagState.status === "checking" ? (
                <Loader2 aria-hidden="true" className="mr-1 inline h-3 w-3 animate-spin" />
              ) : tagState.status === "available" ? (
                <CheckCircle2 aria-hidden="true" className="mr-1 inline h-3 w-3" />
              ) : null}
              {tagState.message}
            </p>
          ) : null}
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
      </fieldset>

      <fieldset className="space-y-4 border-t border-white/10 pt-6">
        <SectionLegend>Contact</SectionLegend>

        <FormField
          htmlFor="country"
          label="Country"
          required
          hint="Used for flag and regional display. Your phone number is never public."
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
          hint="Include the country code, or use your national format with the country selected above."
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
      </fieldset>

      <div className="space-y-4 border-t border-white/10 pt-6">
        <Checkbox
          id="acceptTerms"
          checked={values.acceptTerms}
          onChange={(event) => update("acceptTerms", event.target.checked)}
          label="I accept the terms and privacy policy."
          description={
            <>
              Read the{" "}
              <Link href="/terms" className="text-electric-300 underline-offset-2 hover:underline">
                terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-electric-300 underline-offset-2 hover:underline"
              >
                privacy policy
              </Link>
              .
            </>
          }
          invalid={Boolean(fieldErrors.acceptTerms)}
        />
        {fieldErrors.acceptTerms ? (
          <p role="alert" className="text-xs font-medium text-danger-soft">
            {fieldErrors.acceptTerms}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          loading={submitting}
          loadingLabel="Creating account"
          className="w-full"
        >
          Create account
        </Button>

        <p className="text-sm text-grey-400">
          Already have an account?{" "}
          <Link href="/login" className="text-electric-300 underline-offset-2 hover:underline">
            Sign in
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
