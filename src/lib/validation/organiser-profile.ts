// GCC — organiser profile edit schema.
//
// PATCH /api/organiser/profile accepts ONLY these fields. The uid, logo
// references and timestamps are written by the server from authenticated
// state, never accepted from the request body. Unknown keys are rejected.
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .nullable()
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .pipe(z.string().max(max, `Use at most ${max} characters.`).nullable().optional());

export const organiserProfileLinkSchema = z.strictObject({
  label: z
    .string()
    .trim()
    .min(1, "Name the link.")
    .max(40, "Use at most 40 characters for the label."),
  url: z.url("Enter a valid link address.").startsWith("https://", "Links must use https://."),
});

export const organiserProfileEditSchema = z.strictObject({
  organisationName: z
    .string()
    .trim()
    .min(2, "Enter your organisation's name.")
    .max(60, "Use at most 60 characters."),
  bio: optionalText(300),
  links: z.array(organiserProfileLinkSchema).max(3, "Add at most 3 links.").optional(),
});

export type OrganiserProfileLinkInput = z.infer<typeof organiserProfileLinkSchema>;
export type OrganiserProfileEditInput = z.infer<typeof organiserProfileEditSchema>;
