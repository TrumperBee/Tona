// GCC — authentication input schemas.
// All schemas are validated again on the server; client-side validation is a
// usability nicety only.
//
// Password policy (ADR-045): Firebase Authentication's platform minimum is six
// characters and cannot be lowered, so the platform enforces length only — 6 to
// 128 characters, no complexity rules, no trimming. Any characters are allowed,
// including spaces and emoji. The strength indicator is advisory, never a gate.

import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_REQUIREMENT_TEXT = "At least 6 characters";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENT_TEXT)
  .max(PASSWORD_MAX_LENGTH, "Use at most 128 characters.");

// Sign-in must never re-apply the current policy: existing accounts always need
// to be able to sign in, even if their password predates a policy change.
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(PASSWORD_MAX_LENGTH, "Use at most 128 characters."),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const sessionExchangeSchema = z.object({
  idToken: z.string().trim().min(20).max(10000),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type SessionExchangeInput = z.infer<typeof sessionExchangeSchema>;
