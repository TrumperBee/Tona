"use client";

// GCC - edit the public organiser profile.
//
// The schema is strict: uid, logo references and timestamps are never accepted
// here. The server writes the single public organiser document.
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { LogoUploader } from "@/components/organiser/logo-uploader";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { organiserProfileEditSchema } from "@/lib/validation/organiser-profile";

export interface OrganiserProfileFormProps {
  readonly initial: {
    readonly organisationName: string;
    readonly bio: string | null;
    readonly links: readonly { readonly label: string; readonly url: string }[];
    readonly logoUrl: string | null;
  };
  /** False until the first successful save creates the public document. */
  readonly profileExists: boolean;
}

interface LinkRow {
  readonly label: string;
  readonly url: string;
}

const MAX_BIO = 300;

function toRows(links: readonly { readonly label: string; readonly url: string }[]): LinkRow[] {
  return links.slice(0, 3).map((link) => ({ label: link.label, url: link.url }));
}

export function OrganiserProfileForm({ initial, profileExists }: OrganiserProfileFormProps) {
  const router = useRouter();
  const [organisationName, setOrganisationName] = useState(initial.organisationName);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [links, setLinks] = useState<LinkRow[]>(toRows(initial.links));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function addLink(): void {
    setLinks((current) => (current.length >= 3 ? current : [...current, { label: "", url: "" }]));
  }

  function removeLink(index: number): void {
    setLinks((current) => current.filter((_, position) => position !== index));
  }

  function updateLink(index: number, key: keyof LinkRow, value: string): void {
    setLinks((current) =>
      current.map((row, position) => (position === index ? { ...row, [key]: value } : row)),
    );
    setFieldErrors((current) => {
      if (!current.links) {
        return current;
      }

      const next = { ...current };
      delete next.links;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaved(false);

    // Rows the organiser left completely empty are dropped, not rejected.
    const filledLinks = links.filter((row) => row.label.trim() || row.url.trim());

    const payload = {
      organisationName,
      bio: bio.trim() ? bio : null,
      links: filledLinks.length > 0 ? filledLinks : [],
    };
    const parsed = organiserProfileEditSchema.safeParse(payload);

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
      const response = await fetch("/api/organiser/profile", {
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

      setSaved(true);
      setLinks(toRows(parsed.data.links ?? []));
      router.refresh();
    } catch {
      setFormError("The connection failed. Check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold uppercase tracking-display text-white">
          Organisation logo
        </h2>
        <LogoUploader
          name={organisationName.trim() || "Your organisation"}
          initialLogoUrl={initial.logoUrl}
          canUpload={profileExists}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold uppercase tracking-display text-white">
          Organisation details
        </h2>

        <FormField
          htmlFor="organisationName"
          label="Organisation name"
          hint="Shown as “Organised by …” on every one of your tournaments."
          error={fieldErrors.organisationName}
          required
        >
          <Input
            id="organisationName"
            name="organisationName"
            value={organisationName}
            onChange={(event) => setOrganisationName(event.target.value)}
            maxLength={60}
            autoComplete="organization"
          />
        </FormField>

        <FormField
          htmlFor="bio"
          label="About your organisation"
          hint={`Up to ${MAX_BIO} characters. Shown on your public organiser page.`}
          error={fieldErrors.bio}
          optional
        >
          <Textarea
            id="bio"
            name="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={4}
            maxLength={MAX_BIO + 1}
          />
          <p className="mt-1 text-right text-xs tabular-nums text-grey-500">
            {bio.length} / {MAX_BIO}
          </p>
        </FormField>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold uppercase tracking-display text-white">
            Links
          </h2>
          <p className="text-xs text-grey-500">Up to 3, https only</p>
        </div>

        {fieldErrors.links ? (
          <p role="alert" className="text-sm font-medium text-danger-soft">
            {fieldErrors.links}
          </p>
        ) : null}

        {links.map((row, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border border-white/10 p-4 sm:grid-cols-2"
          >
            <FormField
              htmlFor={`link-label-${index}`}
              label={index === 0 ? "Label" : `Label ${index + 1}`}
              hint="For example “Community” or “Streaming”."
            >
              <Input
                id={`link-label-${index}`}
                value={row.label}
                onChange={(event) => updateLink(index, "label", event.target.value)}
                maxLength={40}
              />
            </FormField>

            <FormField
              htmlFor={`link-url-${index}`}
              label={index === 0 ? "Address" : `Address ${index + 1}`}
            >
              <div className="flex items-start gap-2">
                <Input
                  id={`link-url-${index}`}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={row.url}
                  onChange={(event) => updateLink(index, "url", event.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                  onClick={() => removeLink(index)}
                >
                  <span className="sr-only">Remove link {index + 1}</span>
                </Button>
              </div>
            </FormField>
          </div>
        ))}

        {links.length < 3 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
            onClick={addLink}
          >
            Add a link
          </Button>
        ) : null}
      </section>

      {formError ? (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-danger-soft">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={submitting} loadingLabel="Saving">
          Save profile
        </Button>
        <Link href="/organiser" className={buttonLinkStyles()}>
          Back to overview
        </Link>
        {saved ? (
          <p role="status" className="text-sm font-medium text-success-soft">
            Saved. Your public page is updated.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function buttonLinkStyles(): string {
  return "text-sm font-medium text-grey-300 underline-offset-4 transition-colors hover:text-white hover:underline";
}
